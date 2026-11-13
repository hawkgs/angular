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
  RemoteApiMetadata,
  InitiatorApiType,
  AsyncFn,
  VoidAsyncFn,
  ApiMetadata,
  AsyncGeneratorFn,
  SyncFn,
  VoidSyncFn,
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
  serializeApiMetadata,
} from './utils';

const API_REQUEST_RETRY = 2500;

type GeneratorResponse = {d: boolean; v?: any};

export class DtLinkInitiator<T extends DtLinkApi = any> {
  private cleanUpFns: (() => void)[] = [];
  private apiRequestRetryInterval?: ReturnType<typeof setInterval>;
  private remoteSignalsCache = new Map<string, Signal<unknown>>();
  private remoteApiMetadataResolver?: (d: RemoteApiMetadata) => void;
  private remoteApiMetadata = new Promise<RemoteApiMetadata>(
    (res) => (this.remoteApiMetadataResolver = res),
  );

  constructor(private messageBus: MessageBus<any>) {
    // Request the remote API from the target.
    messageBus.once(DTLINK_API_RESPONSE, (remoteApi: RemoteApiMetadata) => {
      clearInterval(this.apiRequestRetryInterval);
      this.remoteApiMetadataResolver?.(remoteApi);
    });
    messageBus.emit(DTLINK_API_REQUEST);

    this.apiRequestRetryInterval = setInterval(() => {
      messageBus.emit(DTLINK_API_REQUEST);
    }, API_REQUEST_RETRY);
  }

  /** Initiator API that allows remote calls to the target. */
  api: DtLinkRemoteApi<T> = new Proxy({} as any, {
    get: (_, prop) => {
      if (typeof prop === 'symbol') {
        return;
      }

      return async (...args: any[]) => {
        const type = (await this.remoteApiMetadata).get(prop);

        if (type === undefined) {
          // TBD: Use AngularDevtoolsError
          throw new Error(
            `AngularDevtoolsError: "${prop}" remote API is not available to call from the initiator. Check what is exposed on the target.`,
          );
        }

        if (type === InitiatorApiType.AsyncGenerator) {
          return this.constructAsyncGenerator(prop, ...args);
        }

        return this.constructAsyncFn(type, prop, ...args);
      };
    },
  });

  /** Destroys and disposes the DtLink instance along with all remote signals. */
  destroy() {
    for (const cleanUp of this.cleanUpFns) {
      cleanUp();
    }
    this.cleanUpFns = [];
    clearInterval(this.apiRequestRetryInterval);
  }

  private constructAsyncGenerator(name: string, ...args: any[]) {
    const that = this;

    return (async function* () {
      const queue: any[] = [];
      let wake: (() => void) | null = null;
      let done = false;

      const cleanUp = that.messageBus.on(dtlinkResponseTopic(name), ({d, v}: GeneratorResponse) => {
        queue.push(v);
        done = d;
        wake?.();
      });
      that.messageBus.emit(dtlinkRequestTopic(name), args);

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

  private constructAsyncFn(type: InitiatorApiType, name: string, ...args: any[]) {
    return new Promise((resolve) => {
      // Should return
      if (type === InitiatorApiType.Async) {
        this.messageBus.once(dtlinkResponseTopic(name), resolve);
      }

      this.messageBus.emit(dtlinkRequestTopic(name), args);
    });
  }
}

/**
 * Exposes the provided API to be callable from the initiator.
 */
export function exposeDtLinkApi(messageBus: MessageBus<any>, api: DtLinkApi) {
  const names = new Set<string>();
  const cleanUpFns: (() => void)[] = [];

  for (const metadata of api) {
    if (names.has(metadata.name)) {
      // TBD: Use AngularDevtoolsError
      throw new Error(
        `AngularDevTools: API with name "${metadata.name}" already exists. Please pick a different name`,
      );
    }
    names.add(metadata.name);

    const {fn, type} = metadata;
    let exposeCleanUp: () => void;

    if (isAsyncFn(fn, type) || isVoidAsyncFn(fn, type)) {
      exposeCleanUp = exposeAsyncFn(messageBus, metadata, fn);
    } else if (isAsyncGeneratorFn(fn, type)) {
      exposeCleanUp = exposeAsyncGenerator(messageBus, metadata, fn);
    } else {
      exposeCleanUp = exposeSyncFn(messageBus, metadata, fn);
    }
    cleanUpFns.push(exposeCleanUp);
  }

  const metadataCleanUp = listenForApiRequests(messageBus, api);

  return () => {
    for (const fn of cleanUpFns) {
      fn();
    }
    metadataCleanUp();
  };
}

function exposeAsyncFn(
  messageBus: MessageBus<any>,
  {name, type}: ApiMetadata,
  fn: AsyncFn | VoidAsyncFn,
) {
  const requestTopic = dtlinkRequestTopic(name);
  const responseTopic = dtlinkResponseTopic(name);

  return messageBus.on(requestTopic, (...args: any[]) => {
    fn(...args).then((resp) => {
      if (isAsyncFn(fn, type)) {
        messageBus.emit(responseTopic, [resp]);
      }
    });
  });
}

function exposeAsyncGenerator(
  messageBus: MessageBus<any>,
  {name}: ApiMetadata,
  fn: AsyncGeneratorFn,
) {
  const requestTopic = dtlinkRequestTopic(name);
  const responseTopic = dtlinkResponseTopic(name);

  return messageBus.on(requestTopic, (...args: any[]) => {
    const generator = fn(...args);
    const step = (): Promise<void> =>
      generator.next().then((result) => {
        if (!result.done) {
          messageBus.emit(responseTopic, [{d: false, v: result.value} satisfies GeneratorResponse]);
          return step();
        }

        messageBus.emit(responseTopic, [{d: true, v: result.value} satisfies GeneratorResponse]);
        return;
      });

    step();
  });
}

function exposeSyncFn(
  messageBus: MessageBus<any>,
  {name, type}: ApiMetadata,
  fn: SyncFn | VoidSyncFn,
) {
  const requestTopic = dtlinkRequestTopic(name);
  const responseTopic = dtlinkResponseTopic(name);

  return messageBus.on(requestTopic, (...args: any[]) => {
    const response = fn(...args);
    if (isSyncFn(fn, type)) {
      messageBus.emit(responseTopic, [response]);
    }
  });
}

function listenForApiRequests(messageBus: MessageBus<any>, api: DtLinkApi) {
  // Emit the exposed API to the initiator.
  return messageBus.on(DTLINK_API_REQUEST, () => {
    const serialized = serializeApiMetadata(api);
    messageBus.emit(DTLINK_API_RESPONSE, [serialized]);
  });
}
