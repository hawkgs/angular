/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {MessageBus} from '../../../protocol';

// Conventional RPC

const DTLINK_API_REQUEST = 'dtlink#api-list-request';
const DTLINK_API_RESPONSE = 'dtlink#api-list-response';

export type DtLinkApi = ApiMetadata[];

export type DtLinkCallApi<T extends DtLinkApi> = {
  [M in T[number] as M['name']]: (
    ...args: Parameters<M['callable']>
  ) => ReturnType<M['callable']> extends Promise<unknown>
    ? ReturnType<M['callable']>
    : Promise<ReturnType<M['callable']>>;
};

type GeneratorResponse = {d: boolean; v?: any};

export class DtLink<T extends DtLinkApi = any> {
  private cleanUpFns: (() => void)[] = [];
  private remoteApiResolver?: (d: SerializedApiMetadata) => void;
  private remoteApi = new Promise<SerializedApiMetadata>((res) => (this.remoteApiResolver = res));

  constructor(private messageBus: MessageBus<any>) {
    let interval: ReturnType<typeof setInterval>;

    messageBus.once(DTLINK_API_RESPONSE, (remoteApi: SerializedApiMetadata) => {
      clearInterval(interval);
      this.remoteApiResolver?.(remoteApi);
    });
    messageBus.emit(DTLINK_API_REQUEST);

    interval = setInterval(() => {
      messageBus.emit(DTLINK_API_REQUEST);
    }, 1000);
  }

  call: DtLinkCallApi<T> = new Proxy({} as any, {
    get: (_, prop) => {
      return async (...args: any[]) => {
        if (typeof prop === 'symbol') {
          return;
        }

        const callType = (await this.remoteApi).get(prop);

        if (callType === undefined) {
          throw new Error(`DevTools: Call ${prop} is missing`);
        }

        if (callType === CallType.AsyncGenerator) {
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

        const shouldReturn = callType === CallType.Async || callType === CallType.Sync;

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
    const names = new Set<string>();

    for (const {name, callable: fn, type} of api) {
      if (names.has(name)) {
        throw new Error(`DevTools: ${name} api already exists`);
      }
      names.add(name);

      const cleanUp = this.messageBus.on(requestTopic(name), (...args: any[]) => {
        const responseTopicStr = responseTopic(name);

        if (isAsyncFn(fn, type) || isVoidAsyncFn(fn, type)) {
          // Handle promises/async vals
          fn(...args).then((resp) => {
            if (isAsyncFn(fn, type)) {
              this.messageBus.emit(responseTopicStr, [resp]);
            }
          });
        } else if (isAsyncGeneratorFn(fn, type)) {
          // Handle async generators
          const generator = fn(...args);
          const step = (): Promise<void> =>
            generator.next().then((result) => {
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
        } else {
          // Handle standard sync vals
          const response = fn(...args);
          if (isSyncFn(fn, type)) {
            this.messageBus.emit(responseTopicStr, [response]);
          }
        }
      });

      this.cleanUpFns.push(cleanUp);
    }

    const cleanUp = this.messageBus.on(DTLINK_API_REQUEST, () => {
      const serialized: SerializedApiMetadata = api.reduce(
        (map, b) => map.set(b.name, b.type),
        new Map<string, CallType>(),
      );

      this.messageBus.emit(DTLINK_API_RESPONSE, [serialized]);
    });
    this.cleanUpFns.push(cleanUp);
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

// else if (isRemoteSignal(fnResult)) {
//           // Patch remote signals
//           const signal = fnResult as RemoteSignalInternal<unknown>;
//           signal.__patch(this.messageBus, new Set());
//         }

// Metadata FNs

enum CallType {
  Sync,
  Async,
  VoidSync,
  VoidAsync,
  AsyncGenerator,
  RemoteSignal,
}

type SyncFn = (...args: any[]) => unknown;
type AsyncFn = (...args: any[]) => Promise<unknown>;
type VoidSyncFn = (...args: any[]) => void;
type VoidAsyncFn = (...args: any[]) => Promise<void>;
type AsyncGeneratorFn = (...args: any[]) => AsyncGenerator<unknown>;

type ApiCallable = SyncFn | AsyncFn | VoidSyncFn | VoidAsyncFn | AsyncGeneratorFn;

export interface ApiMetadata<N extends string = string, F extends ApiCallable = ApiCallable> {
  name: N;
  type: CallType;
  callable: F;
}

type SerializedApiMetadata = Map<string, CallType>;

type NamedFn<N extends string, F> = Record<N, F>;

function fnMetadata<N extends string, F extends ApiCallable>(
  namedFn: NamedFn<N, F>,
  type: CallType,
): ApiMetadata<N, F> {
  const name = Object.keys(namedFn)[0] as N;
  return {
    name,
    type,
    callable: namedFn[name],
  };
}

export function syncFn<N extends string, F extends SyncFn>(
  namedFn: NamedFn<N, F>,
): ApiMetadata<N, F> {
  return fnMetadata(namedFn, CallType.Sync);
}

export function asyncFn<N extends string, F extends AsyncFn>(
  namedFn: NamedFn<N, F>,
): ApiMetadata<N, F> {
  return fnMetadata(namedFn, CallType.Async);
}

export function voidSyncFn<N extends string, F extends VoidSyncFn>(
  namedFn: NamedFn<N, F>,
): ApiMetadata<N, F> {
  return fnMetadata(namedFn, CallType.VoidSync);
}

export function voidAsyncFn<N extends string, F extends VoidAsyncFn>(
  namedFn: NamedFn<N, F>,
): ApiMetadata<N, F> {
  return fnMetadata(namedFn, CallType.VoidAsync);
}

export function asyncGeneratorFn<N extends string, F extends AsyncGeneratorFn>(
  namedFn: NamedFn<N, F>,
): ApiMetadata<N, F> {
  return fnMetadata(namedFn, CallType.AsyncGenerator);
}

// export function remoteSignalObj(signal: RemoteSignal<unknown>): ApiMetadata {
//   return {
//     name: (signal as RemoteSignalInternal<unknown>).__name,
//     type: CallType.RemoteSignal,
//     callable: signal as any, // Check why it's breaking
//   };
// }

//

function isSyncFn(fn: ApiCallable, type: CallType): fn is SyncFn {
  return type === CallType.Sync;
}

function isAsyncFn(fn: ApiCallable, type: CallType): fn is AsyncFn {
  return type === CallType.Async;
}

function isVoidSyncFn(fn: ApiCallable, type: CallType): fn is VoidSyncFn {
  return type === CallType.VoidSync;
}

function isVoidAsyncFn(fn: ApiCallable, type: CallType): fn is VoidAsyncFn {
  return type === CallType.VoidAsync;
}

function isAsyncGeneratorFn(fn: ApiCallable, type: CallType): fn is AsyncGeneratorFn {
  return type === CallType.AsyncGenerator;
}

//
//
//
//
//
// Remote signals (WORK IN PROGRESS)
//
//
//
//

interface RemoteSignalInternal<T> {
  (): T;
  set(value: T): void;
  update(updater: (value: T) => T): void;
  __name: string;
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
  signal.__name = name;

  signal.set = (newValue: T) => {
    if (!messageBus) {
      throw new Error('DevTools: Not patched');
    }
    value = newValue;
    messageBus?.emit(responseTopic, [value]);
  };

  signal.update = (updater: Parameters<RemoteSignal<T>['update']>[0]) => {
    if (!messageBus) {
      throw new Error('DevTools: Not patched');
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
