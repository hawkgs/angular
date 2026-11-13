/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  ApiCallable,
  ApiMetadata,
  AsyncFn,
  AsyncGeneratorFn,
  CallableMetadata,
  TargetCallType,
  RemoteSignal,
  RemoteSignalMetadata,
  SyncFn,
  VoidAsyncFn,
  VoidSyncFn,
  RemoteSignalInternal,
  InitiatorApiType,
  DtLinkApi,
  RemoteApiMetadata,
} from './types';

//
// Consts
//

export const REMOTE_SIGNAL_PREFIX = '$';

//
// `MessageBus` topics
//

export const DTLINK_API_REQUEST = 'dtlink#remote-api-request';
export const DTLINK_API_RESPONSE = 'dtlink#remote-api-response';
export const DTLINK_DISPOSE_SIGNALS = 'dtlink#dispose-remote-signals';

export function dtlinkRequestTopic(name: string) {
  return `dtlink#${name}-request`;
}

export function dtlinkResponseTopic(name: string) {
  return `dtlink#${name}-response`;
}

//
// Metadata decorators
//

type NamedFn<N extends string, F> = Record<N, F>;

function fnMetadata<N extends string, F extends ApiCallable>(
  namedFn: NamedFn<N, F>,
  type: TargetCallType,
): CallableMetadata<N, F> {
  const name = Object.keys(namedFn)[0] as N;
  return {
    name,
    type,
    fn: namedFn[name],
  };
}

/** Decorate a synchronous function when exposing to DtLink. */
export function syncFn<N extends string, F extends SyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, TargetCallType.Sync);
}

/** Decorate an asynchronous function when exposing to DtLink. */
export function asyncFn<N extends string, F extends AsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, TargetCallType.Async);
}

/** Decorate a synchronous function that doesn't return a value when exposing to DtLink. */
export function voidSyncFn<N extends string, F extends VoidSyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, TargetCallType.VoidSync);
}

/** Decorate an asynchronous function that doesn't return a value when exposing to DtLink. */
export function voidAsyncFn<N extends string, F extends VoidAsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, TargetCallType.VoidAsync);
}

/** Decorate an asynchronous generator when exposing to DtLink. */
export function asyncGeneratorFn<N extends string, F extends AsyncGeneratorFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, TargetCallType.AsyncGenerator);
}

/** Decorate a remote signal when exposing to DtLink. */
export function remoteSignalObj<N extends string, T>(
  signalObj: Record<N, RemoteSignal<T>>,
): RemoteSignalMetadata<N, T> {
  const name = Object.keys(signalObj)[0] as N;
  return {
    name,
    type: TargetCallType.RemoteSignal,
    signal: signalObj[name],
  };
}

//
// Callable/signal checkers
//

export function isSyncFn(fn: ApiCallable, type: TargetCallType): fn is SyncFn {
  return type === TargetCallType.Sync;
}

export function isAsyncFn(fn: ApiCallable, type: TargetCallType): fn is AsyncFn {
  return type === TargetCallType.Async;
}

export function isVoidSyncFn(fn: ApiCallable, type: TargetCallType): fn is VoidSyncFn {
  return type === TargetCallType.VoidSync;
}

export function isVoidAsyncFn(fn: ApiCallable, type: TargetCallType): fn is VoidAsyncFn {
  return type === TargetCallType.VoidAsync;
}

export function isAsyncGeneratorFn(fn: ApiCallable, type: TargetCallType): fn is AsyncGeneratorFn {
  return type === TargetCallType.AsyncGenerator;
}

export function isRemoteSignal(value: unknown): value is RemoteSignal<unknown> {
  return (value as RemoteSignalInternal<unknown>).__NG_DTLINK_REMOTE_SIGNAL;
}

/** Checks whether a remote signal metadata. */
export function isRemoteSignalMetadata(data: ApiMetadata): data is RemoteSignalMetadata {
  return !!(data as RemoteSignalMetadata).signal;
}

/** Checks whether a async/sync function or an async generator metadata. */
export function isCallableMetadata(data: ApiMetadata): data is CallableMetadata {
  return !!(data as CallableMetadata).fn;
}

export function isRemoteSignalInitiator(name: string) {
  return name.startsWith(REMOTE_SIGNAL_PREFIX);
}

export function remoteSignalName(name: string) {
  return REMOTE_SIGNAL_PREFIX + name;
}

//
// Mapping
//

const TO_INITIATOR_API: {[key in TargetCallType]: InitiatorApiType} = {
  [TargetCallType.Sync]: InitiatorApiType.Async,
  [TargetCallType.Async]: InitiatorApiType.Async,
  [TargetCallType.VoidSync]: InitiatorApiType.VoidAsync,
  [TargetCallType.VoidAsync]: InitiatorApiType.VoidAsync,
  [TargetCallType.AsyncGenerator]: InitiatorApiType.AsyncGenerator,
  [TargetCallType.RemoteSignal]: InitiatorApiType.RemoteSignal,
};

export function serializeApiMetadata(api: DtLinkApi): RemoteApiMetadata {
  return api.reduce((map, metadata) => {
    return map.set(metadata.name, TO_INITIATOR_API[metadata.type]);
  }, new Map<string, InitiatorApiType>());
}
