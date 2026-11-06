/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {signal} from '@angular/core';
import {MessageBus} from '../../../../protocol';
import {
  OriginCallType,
  DtLinkApi,
  DtLinkCallApi,
  GeneratorResponse,
  RemoteSignalInternal,
  SerializedApiMetadata,
} from './types';
import {
  isAsyncFn,
  isAsyncGeneratorFn,
  isCallableMetadata,
  isRemoteSignal,
  isSyncFn,
  isVoidAsyncFn,
  requestTopic,
  responseTopic,
} from './utils';

// Conventional RPC

const DTLINK_API_REQUEST = 'dtlink#api-list-request';
const DTLINK_API_RESPONSE = 'dtlink#api-list-response';
const RETRY = 3000;

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
    }, RETRY);
  }

  api: DtLinkCallApi<T> = new Proxy({} as any, {
    get: (_, prop) => {
      return async (...args: any[]) => {
        if (typeof prop === 'symbol') {
          return;
        }

        const callType = (await this.remoteApi).get(prop);

        if (callType === undefined) {
          throw new Error(`DevTools: Call ${prop} is missing`);
        }

        if (callType === OriginCallType.RemoteSignal) {
          const sig = signal<any>(undefined);
          const cleanUp = this.messageBus.on(responseTopic(prop), (value: any) => {
            sig.set(value);
          });
          this.messageBus.emit(requestTopic(prop));
          this.cleanUpFns.push(cleanUp);

          return sig.asReadonly();
        } else if (callType === OriginCallType.AsyncGenerator) {
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

        const shouldReturn = callType === OriginCallType.Async || callType === OriginCallType.Sync;

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

    for (const data of api) {
      if (names.has(data.name)) {
        throw new Error(`DevTools: ${data.name} api already exists`);
      }
      names.add(data.name);

      // DOESN'T SUPPORT SIGNALS ATM
      if (!isCallableMetadata(data)) {
        (data.signal as RemoteSignalInternal<unknown>).__patch(this.messageBus);
        continue;
      }

      const {name, callable: fn, type} = data;

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
        new Map<string, OriginCallType>(),
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
