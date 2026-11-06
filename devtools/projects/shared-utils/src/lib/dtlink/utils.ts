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
  SourceCallType,
  RemoteSignal,
  RemoteSignalMetadata,
  SyncFn,
  VoidAsyncFn,
  VoidSyncFn,
  RemoteSignalInternal,
  DestinationCallType,
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
  type: SourceCallType,
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
  return fnMetadata(namedFn, SourceCallType.Sync);
}

/** Decorate an asynchronous function when exposing to DtLink. */
export function asyncFn<N extends string, F extends AsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, SourceCallType.Async);
}

/** Decorate a synchronous function that doesn't return a value when exposing to DtLink. */
export function voidSyncFn<N extends string, F extends VoidSyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, SourceCallType.VoidSync);
}

/** Decorate an asynchronous function that doesn't return a value when exposing to DtLink. */
export function voidAsyncFn<N extends string, F extends VoidAsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, SourceCallType.VoidAsync);
}

/** Decorate an asynchronous generator when exposing to DtLink. */
export function asyncGeneratorFn<N extends string, F extends AsyncGeneratorFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, SourceCallType.AsyncGenerator);
}

/** Decorate a remote signal when exposing to DtLink. */
export function remoteSignalObj<N extends string, T>(
  signalObj: Record<N, RemoteSignal<T>>,
): RemoteSignalMetadata<N, T> {
  const name = Object.keys(signalObj)[0] as N;
  return {
    name,
    type: SourceCallType.RemoteSignal,
    signal: signalObj[name],
  };
}

//
// Callable/signal checkers
//

export function isSyncFn(fn: ApiCallable, type: SourceCallType): fn is SyncFn {
  return type === SourceCallType.Sync;
}

export function isAsyncFn(fn: ApiCallable, type: SourceCallType): fn is AsyncFn {
  return type === SourceCallType.Async;
}

export function isVoidSyncFn(fn: ApiCallable, type: SourceCallType): fn is VoidSyncFn {
  return type === SourceCallType.VoidSync;
}

export function isVoidAsyncFn(fn: ApiCallable, type: SourceCallType): fn is VoidAsyncFn {
  return type === SourceCallType.VoidAsync;
}

export function isAsyncGeneratorFn(fn: ApiCallable, type: SourceCallType): fn is AsyncGeneratorFn {
  return type === SourceCallType.AsyncGenerator;
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

export function isRemoteSignalDest(name: string) {
  return name.startsWith(REMOTE_SIGNAL_PREFIX);
}

export function remoteSignalName(name: string) {
  return REMOTE_SIGNAL_PREFIX + name;
}

//
// Mapping
//

const TO_DEST_CALLABLE: {[key in SourceCallType]: DestinationCallType} = {
  [SourceCallType.Sync]: DestinationCallType.Async,
  [SourceCallType.Async]: DestinationCallType.Async,
  [SourceCallType.VoidSync]: DestinationCallType.VoidAsync,
  [SourceCallType.VoidAsync]: DestinationCallType.VoidAsync,
  [SourceCallType.AsyncGenerator]: DestinationCallType.AsyncGenerator,
  [SourceCallType.RemoteSignal]: DestinationCallType.RemoteSignal,
};

export function serializeApiMetadata(api: DtLinkApi): RemoteApiMetadata {
  return api.reduce((map, metadata) => {
    return map.set(metadata.name, TO_DEST_CALLABLE[metadata.type]);
  }, new Map<string, DestinationCallType>());
}
