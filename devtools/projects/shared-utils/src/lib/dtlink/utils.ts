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
  CallType,
  RemoteSignal,
  RemoteSignalMetadata,
  SyncFn,
  VoidAsyncFn,
  VoidSyncFn,
} from './types';

type NamedFn<N extends string, F> = Record<N, F>;

function fnMetadata<N extends string, F extends ApiCallable>(
  namedFn: NamedFn<N, F>,
  type: CallType,
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
  return fnMetadata(namedFn, CallType.Sync);
}

export function asyncFn<N extends string, F extends AsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, CallType.Async);
}

export function voidSyncFn<N extends string, F extends VoidSyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, CallType.VoidSync);
}

export function voidAsyncFn<N extends string, F extends VoidAsyncFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, CallType.VoidAsync);
}

export function asyncGeneratorFn<N extends string, F extends AsyncGeneratorFn>(
  namedFn: NamedFn<N, F>,
): CallableMetadata<N, F> {
  return fnMetadata(namedFn, CallType.AsyncGenerator);
}

export function remoteSignalObj<N extends string, T>(
  signal: Record<N, RemoteSignal<T>>,
): RemoteSignalMetadata<N, T> {
  const name = Object.keys(signal)[0] as N;
  return {
    name,
    type: CallType.RemoteSignal,
  };
}

export function isSyncFn(fn: ApiCallable, type: CallType): fn is SyncFn {
  return type === CallType.Sync;
}

export function isAsyncFn(fn: ApiCallable, type: CallType): fn is AsyncFn {
  return type === CallType.Async;
}

export function isVoidSyncFn(fn: ApiCallable, type: CallType): fn is VoidSyncFn {
  return type === CallType.VoidSync;
}

export function isVoidAsyncFn(fn: ApiCallable, type: CallType): fn is VoidAsyncFn {
  return type === CallType.VoidAsync;
}

export function isAsyncGeneratorFn(fn: ApiCallable, type: CallType): fn is AsyncGeneratorFn {
  return type === CallType.AsyncGenerator;
}

export const signalResponseTopic = (name: string) => `dtlink_remote_signal#${name}_response`;
export const signalRequestTopic = (name: string) => `dtlink_remote_signal#${name}_request`;

export function isRemoteSignal(value: any): value is RemoteSignal<unknown> {
  return value.__NG_REMOTE_SIGNAL;
}

export function isCallableMetadata(data: ApiMetadata): data is CallableMetadata {
  return !!(data as CallableMetadata).callable;
}
