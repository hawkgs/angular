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
  SourceCallType,
  DtLinkApi,
  DtLinkRemoteApi,
  RemoteSignalInternal,
  SerializedApiMetadata,
} from './types';
import {
  isAsyncFn,
  isAsyncGeneratorFn,
  isSyncFn,
  isVoidAsyncFn,
  dtlinkRequestTopic,
  dtlinkResponseTopic,
  DTLINK_API_RESPONSE,
  DTLINK_API_REQUEST,
  DTLINK_DISPOSE_SIGNALS,
  isRemoteSignalMetadata,
} from './utils';

const API_REQUEST_RETRY = 2500;

type GeneratorResponse = {d: boolean; v?: any};

/** RPC abstraction layer over a `MessageBus`. */
export class DtLink<T extends DtLinkApi = any> {
  private cleanUpFns: (() => void)[] = [];
  private remoteApiResolver?: (d: SerializedApiMetadata) => void;
  private remoteApi = new Promise<SerializedApiMetadata>((res) => (this.remoteApiResolver = res));
  private apiRequestRetryInterval?: ReturnType<typeof setInterval>;

  constructor(private messageBus: MessageBus<any>) {
    // Request the remote API from the source.
    messageBus.once(DTLINK_API_RESPONSE, (remoteApi: SerializedApiMetadata) => {
      clearInterval(this.apiRequestRetryInterval);
      this.remoteApiResolver?.(remoteApi);
    });
    messageBus.emit(DTLINK_API_REQUEST);

    this.apiRequestRetryInterval = setInterval(() => {
      messageBus.emit(DTLINK_API_REQUEST);
    }, API_REQUEST_RETRY);
  }

  /** API on the destination available to call from the source. */
  api: DtLinkRemoteApi<T> = new Proxy({} as any, {
    get: (_, prop) => {
      return async (...args: any[]) => {
        if (typeof prop === 'symbol') {
          return;
        }

        const type = (await this.remoteApi).get(prop);

        if (type === undefined) {
          // TBD: Use AngularDevtoolsError
          throw new Error(
            `AngularDevtoolsError: "${prop}" remote API is not available to call from the destination. Check what is exposed on the source.`,
          );
        }

        if (type === SourceCallType.RemoteSignal) {
          const sig = signal<any>(undefined);
          const cleanUp = this.messageBus.on(dtlinkResponseTopic(prop), (value: any) => {
            sig.set(value);
          });
          this.messageBus.emit(dtlinkRequestTopic(prop));
          this.cleanUpFns.push(cleanUp);

          return sig.asReadonly();
        } else if (type === SourceCallType.AsyncGenerator) {
          const that = this;

          return (async function* () {
            const queue: any[] = [];
            let wake: (() => void) | null = null;
            let done = false;

            const cleanUp = that.messageBus.on(
              dtlinkResponseTopic(prop),
              ({d, v}: GeneratorResponse) => {
                queue.push(v);
                done = d;
                wake?.();
              },
            );
            that.messageBus.emit(dtlinkRequestTopic(prop), args);

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

        const shouldReturn = type === SourceCallType.Async || type === SourceCallType.Sync;

        return new Promise((resolve) => {
          if (shouldReturn) {
            this.messageBus.once(dtlinkResponseTopic(prop), resolve);
          }

          this.messageBus.emit(dtlinkRequestTopic(prop), args);
        });
      };
    },
  });

  /** Exposes the provided API to be callable from the destination. */
  expose(api: DtLinkApi) {
    const names = new Set<string>();

    for (const data of api) {
      if (names.has(data.name)) {
        // TBD: Use AngularDevtoolsError
        throw new Error(
          `AngularDevTools: API with name "${data.name}" already exists. Please pick a different name`,
        );
      }
      names.add(data.name);

      // Handle remote signals
      if (isRemoteSignalMetadata(data)) {
        (data.signal as RemoteSignalInternal<unknown>).__patch(this.messageBus);
        continue;
      }

      const {name, fn, type} = data;
      const requestTopic = dtlinkRequestTopic(name);
      const responseTopic = dtlinkResponseTopic(name);
      let cleanUpFn: () => void | undefined;

      if (isAsyncFn(fn, type) || isVoidAsyncFn(fn, type)) {
        // Handle promises/async callables
        cleanUpFn = this.messageBus.on(requestTopic, (...args: any[]) => {
          fn(...args).then((resp) => {
            if (isAsyncFn(fn, type)) {
              this.messageBus.emit(responseTopic, [resp]);
            }
          });
        });
      } else if (isAsyncGeneratorFn(fn, type)) {
        // Handle async generators
        cleanUpFn = this.messageBus.on(requestTopic, (...args: any[]) => {
          const generator = fn(...args);
          const step = (): Promise<void> =>
            generator.next().then((result) => {
              if (!result.done) {
                this.messageBus.emit(responseTopic, [
                  {d: false, v: result.value} satisfies GeneratorResponse,
                ]);
                return step();
              }

              this.messageBus.emit(responseTopic, [
                {d: true, v: result.value} satisfies GeneratorResponse,
              ]);
              return;
            });

          step();
        });
      } else {
        // Handle standard sync callables
        cleanUpFn = this.messageBus.on(requestTopic, (...args: any[]) => {
          const response = fn(...args);
          if (isSyncFn(fn, type)) {
            this.messageBus.emit(responseTopic, [response]);
          }
        });
      }

      this.cleanUpFns.push(cleanUpFn);
    }

    // Emit the exposed API to the destination.
    const apiRequestCleanUpFn = this.messageBus.on(DTLINK_API_REQUEST, () => {
      const serialized: SerializedApiMetadata = api.reduce(
        (map, b) => map.set(b.name, b.type),
        new Map<string, SourceCallType>(),
      );

      this.messageBus.emit(DTLINK_API_RESPONSE, [serialized]);
    });
    this.cleanUpFns.push(apiRequestCleanUpFn);
  }

  /** Destroys and disposes the DtLink instance along with all remote signals. */
  destroy() {
    for (const cleanUp of this.cleanUpFns) {
      cleanUp();
    }
    this.cleanUpFns = [];
    this.messageBus.emit(DTLINK_DISPOSE_SIGNALS);
    clearInterval(this.apiRequestRetryInterval);
  }
}
