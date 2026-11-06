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
  OriginCallType,
  RemoteSignal,
  RemoteSignalMetadata,
  SyncFn,
  VoidAsyncFn,
  VoidSyncFn,
} from './types';

type NamedFn<N extends string, F> = Record<N, F>;

function fnMetadata<N extends string, F extends ApiCallable>(
  namedFn: NamedFn<N, F>,
  type: OriginCallType,
): CallableMetadata<N, F> {
  const name = Object.keys(namedFn)[0] as N;
  return {
    name,
    type,
    callable: namedFn[name],
  };
}

export function syncFn<N extends string, F extends SyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, OriginCallType.Sync);
}

export function asyncFn<N extends string, F extends AsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, OriginCallType.Async);
}

export function voidSyncFn<N extends string, F extends VoidSyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, OriginCallType.VoidSync);
}

export function voidAsyncFn<N extends string, F extends VoidAsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, OriginCallType.VoidAsync);
}

export function asyncGeneratorFn<N extends string, F extends AsyncGeneratorFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, OriginCallType.AsyncGenerator);
}

export function remoteSignalObj<N extends string, T>(
  signalObj: Record<N, RemoteSignal<T>>,
): RemoteSignalMetadata<N, T> {
  const name = Object.keys(signalObj)[0] as N;
  return {
    name,
    type: OriginCallType.RemoteSignal,
    signal: signalObj[name],
  };
}

export function isSyncFn(fn: ApiCallable, type: OriginCallType): fn is SyncFn {
  return type === OriginCallType.Sync;
}

export function isAsyncFn(fn: ApiCallable, type: OriginCallType): fn is AsyncFn {
  return type === OriginCallType.Async;
}

export function isVoidSyncFn(fn: ApiCallable, type: OriginCallType): fn is VoidSyncFn {
  return type === OriginCallType.VoidSync;
}

export function isVoidAsyncFn(fn: ApiCallable, type: OriginCallType): fn is VoidAsyncFn {
  return type === OriginCallType.VoidAsync;
}

export function isAsyncGeneratorFn(fn: ApiCallable, type: OriginCallType): fn is AsyncGeneratorFn {
  return type === OriginCallType.AsyncGenerator;
}

export function isRemoteSignal(value: any): value is RemoteSignal<unknown> {
  return value.__NG_REMOTE_SIGNAL;
}

export function isCallableMetadata(data: ApiMetadata): data is CallableMetadata {
  return !!(data as CallableMetadata).callable;
}

export const requestTopic = (name: string) => `dtlink#${name}_request`;
export const responseTopic = (name: string) => `dtlink#${name}_response`;
