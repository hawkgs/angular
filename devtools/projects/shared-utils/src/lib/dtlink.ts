/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../protocol';

// Conventional RPC

export type DtLinkApi = Record<
  string,
  (...args: any[]) => unknown | Promise<unknown> | AsyncGenerator<unknown>
>;

type Promisify<R> = R extends AsyncGenerator<unknown, unknown, unknown> ? R : Promise<Awaited<R>>;

export type DtLinkCallApi<T extends DtLinkApi> = {
  [K in keyof T]: (...args: Parameters<T[K]>) => Promisify<ReturnType<T[K]>>;
};

type GeneratorResponse = {d: boolean; v?: any};

export class DtLink<T extends DtLinkApi = any> {
  private cleanUpFns: (() => void)[] = [];

  constructor(private messageBus: MessageBus<any>) {}

  call: DtLinkCallApi<T> = new Proxy({} as DtLinkCallApi<T>, {
    get: (_, prop) => {
      return (...args: any[]) => {
        if (typeof prop === 'symbol') {
          return;
        }

        if (isGeneratorFn(prop)) {
          const that = this;

          return (async function* () {
            const queue: any[] = [];
            let wake: (() => void) | null = null;
            let done = false;

            const cleanUp = that.messageBus.on(responseTopic(prop), ({d, v}: GeneratorResponse) => {
              queue.push(v);
              done = d;
              wake?.();
            });
            that.messageBus.emit(requestTopic(prop), args);

            while (!done) {
              while (queue.length) {
                yield queue.shift();
              }
              await new Promise<void>((res) => (wake = res));
              wake = null;
            }
            if (queue.length) {
              return queue[0];
            }
            cleanUp();
          })();
        }

        const shouldReturn = shouldFnReturn(prop);

        return new Promise((resolve) => {
          if (shouldReturn) {
            this.messageBus.once(responseTopic(prop), resolve);
          }

          this.messageBus.emit(requestTopic(prop), args);
        });
      };
    },
  });

  expose(api: DtLinkApi) {
    for (const [name, fn] of Object.entries(api)) {
      const cleanUp = this.messageBus.on(requestTopic(name), (...args: any[]) => {
        const fnResult = fn(...args);
        const responseTopicStr = responseTopic(name);

        if (isPromise(fnResult)) {
          // Handle promises/async vals
          fnResult.then((resp) => {
            if (resp !== undefined) {
              this.messageBus.emit(responseTopicStr, [resp]);
            }
          });
        } else if (isAsyncGenerator(fnResult)) {
          // Handle async generators
          const step = (): Promise<void> =>
            fnResult.next().then((result) => {
              if (!result.done) {
                this.messageBus.emit(responseTopicStr, [
                  {d: false, v: result.value} satisfies GeneratorResponse,
                ]);
                return step();
              }

              this.messageBus.emit(responseTopicStr, [
                {d: true, v: result.value} satisfies GeneratorResponse,
              ]);
              return;
            });

          step();
        } else if (isRemoteSignal(fnResult)) {
          // Patch remote signals
          const signal = fnResult as RemoteSignalInternal<unknown>;
          signal.__patch(this.messageBus, new Set());
        } else if (fnResult !== undefined) {
          // Handle standard sync vals
          this.messageBus.emit(responseTopicStr, [fnResult]);
        }
      });

      this.cleanUpFns.push(cleanUp);
    }
  }

  destroy() {
    for (const cleanUp of this.cleanUpFns) {
      cleanUp();
    }
    this.cleanUpFns = [];
  }
}

const requestTopic = (name: string) => `dtlink#${name}_request`;
const responseTopic = (name: string) => `dtlink#${name}_response`;
const isGeneratorFn = (name: string) => name.endsWith('$');
const shouldFnReturn = (name: string) => name.startsWith('get') || name.startsWith('request');

function isPromise(result: any): result is Promise<any> {
  return result != null && typeof result.then === 'function';
}

function isAsyncGenerator(result: any): result is AsyncGenerator<any> {
  return result != null && typeof result[Symbol.asyncIterator] === 'function';
}

// Remote signals (WORK IN PROGRESS)

interface RemoteSignalInternal<T> {
  (): T;
  set(value: T): void;
  update(updater: (value: T) => T): void;
  __patch: (messageBus: MessageBus<any>, registry: Set<string>) => void;
  __patched: () => boolean;
  __NG_REMOTE_SIGNAL: true;
}

export type RemoteSignal<T> = Omit<
  RemoteSignalInternal<T>,
  Extract<keyof RemoteSignalInternal<T>, `__${string}`>
>;

const signalResponseTopic = (name: string) => `dtlink_remote_signal#${name}_response`;
const signalRequestTopic = (name: string) => `dtlink_remote_signal#${name}_request`;

export function remoteSignal<T>(name: string, initialValue: T): RemoteSignal<T> {
  // if (name) {
  //   throw new AngularDevtoolsError(`A remote signal with the name "${name}" already exists.`);
  // }
  // this.registered.add(name);

  let value: T = initialValue;
  let messageBus: MessageBus<any> | undefined;

  const signal = () => value;
  const responseTopic = signalResponseTopic(name);

  signal.__NG_REMOTE_SIGNAL = true;

  signal.set = (newValue: T) => {
    if (!messageBus) {
      throw new Error('Not patched');
    }
    value = newValue;
    messageBus?.emit(responseTopic, [value]);
  };

  signal.update = (updater: Parameters<RemoteSignal<T>['update']>[0]) => {
    if (!messageBus) {
      throw new Error('Not patched');
    }
    value = updater(value);
    messageBus?.emit(responseTopic, [value]);
  };

  signal.__patch = (bus: MessageBus<any>, registry: Set<string>) => {
    messageBus = bus;

    // This will be leaking
    messageBus.on(signalRequestTopic(name), () => {
      messageBus!.emit(responseTopic, [value]);
    });
  };

  signal.__patched = () => !!messageBus;

  return signal;
}

function isRemoteSignal(value: any): value is RemoteSignal<unknown> {
  return value.__NG_REMOTE_SIGNAL;
}
