/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {signal as createSignal, Signal} from '@angular/core';
import {MessageBus} from '../../../../protocol';
import {
  DtLinkApi,
  DtLinkRemoteApi,
  RemoteSignalInternal,
  RemoteApiMetadata,
  DestinationCallType,
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
  serializeApiMetadata,
  isRemoteSignalDest,
} from './utils';

const API_REQUEST_RETRY = 2500;

type GeneratorResponse = {d: boolean; v?: any};

/** RPC abstraction layer over a `MessageBus`. */
export class DtLink<T extends DtLinkApi = any> {
  private cleanUpFns: (() => void)[] = [];
  private remoteApiMetadataResolver?: (d: RemoteApiMetadata) => void;
  private remoteApiMetadata = new Promise<RemoteApiMetadata>(
    (res) => (this.remoteApiMetadataResolver = res),
  );
  private apiRequestRetryInterval?: ReturnType<typeof setInterval>;
  private remoteSignalsCache = new Map<string, Signal<unknown>>();

  constructor(private messageBus: MessageBus<any>) {
    // Request the remote API from the source.
    messageBus.once(DTLINK_API_RESPONSE, (remoteApi: RemoteApiMetadata) => {
      clearInterval(this.apiRequestRetryInterval);
      this.remoteApiMetadataResolver?.(remoteApi);
    });
    messageBus.emit(DTLINK_API_REQUEST);

    this.apiRequestRetryInterval = setInterval(() => {
      messageBus.emit(DTLINK_API_REQUEST);
    }, API_REQUEST_RETRY);
  }

  /** API on the destination available to call from the source. */
  api: DtLinkRemoteApi<T> = new Proxy({} as any, {
    get: (_, prop) => {
      if (typeof prop === 'symbol') {
        return;
      }
      if (isRemoteSignalDest(prop)) {
        let readOnly = this.remoteSignalsCache.get(prop);

        if (!readOnly) {
          const signal = createSignal<unknown>(undefined);
          const cleanUp = this.messageBus.on(dtlinkResponseTopic(prop), (value: unknown) => {
            signal.set(value);
          });
          this.messageBus.emit(dtlinkRequestTopic(prop));
          this.cleanUpFns.push(cleanUp);

          readOnly = signal.asReadonly();
          this.remoteSignalsCache.set(prop, readOnly);
        }

        return readOnly;
      }

      return async (...args: any[]) => {
        const type = (await this.remoteApiMetadata).get(prop);

        if (type === undefined) {
          // TBD: Use AngularDevtoolsError
          throw new Error(
            `AngularDevtoolsError: "${prop}" remote API is not available to call from the destination. Check what is exposed on the source.`,
          );
        }

        if (type === DestinationCallType.AsyncGenerator) {
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

        const shouldReturn = type === DestinationCallType.Async;

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

    for (const metadata of api) {
      if (names.has(metadata.name)) {
        // TBD: Use AngularDevtoolsError
        throw new Error(
          `AngularDevTools: API with name "${metadata.name}" already exists. Please pick a different name`,
        );
      }
      names.add(metadata.name);

      // Handle remote signals
      if (isRemoteSignalMetadata(metadata)) {
        (metadata.signal as RemoteSignalInternal<unknown>).__patch(this.messageBus);
        continue;
      }

      const {name, fn, type} = metadata;
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

    this.listenForApiRequests(api);
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

  private listenForApiRequests(api: DtLinkApi) {
    // Emit the exposed API to the destination.
    const apiRequestCleanUpFn = this.messageBus.on(DTLINK_API_REQUEST, () => {
      const serialized = serializeApiMetadata(api);
      this.messageBus.emit(DTLINK_API_RESPONSE, [serialized]);
    });
    this.cleanUpFns.push(apiRequestCleanUpFn);
  }
}
