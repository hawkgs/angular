/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type {Signal} from '@angular/core';
import {MessageBus} from '../../../../protocol';

export enum CallType {
  Sync,
  Async,
  VoidSync,
  VoidAsync,
  AsyncGenerator,
  RemoteSignal,
}

export type SyncFn = (...args: any[]) => unknown;
export type AsyncFn = (...args: any[]) => Promise<unknown>;
export type VoidSyncFn = (...args: any[]) => void;
export type VoidAsyncFn = (...args: any[]) => Promise<void>;
export type AsyncGeneratorFn = (...args: any[]) => AsyncGenerator<unknown>;

export type ApiCallable = SyncFn | AsyncFn | VoidSyncFn | VoidAsyncFn | AsyncGeneratorFn;

export type ApiMetadata<N extends string = string, F extends ApiCallable = ApiCallable, T = any> =
  CallableMetadata<N, F> | RemoteSignalMetadata<N, T>;

export interface CallableMetadata<N extends string = string, F extends ApiCallable = ApiCallable> {
  name: N;
  type: CallType;
  callable: F;
}

export interface RemoteSignalMetadata<N extends string = string, T = any> {
  name: N;
  type: CallType;
  // Don't set. Lets `DtLinkCallApi` infer the signal value type.
  __valueType?: T;
}

export type SerializedApiMetadata = Map<string, CallType>;

export type DtLinkApi = ApiMetadata[];

export type DtLinkCallApi<T extends DtLinkApi> = {
  [M in T[number] as M['name']]: M extends CallableMetadata
    ? (
        ...args: Parameters<M['callable']>
      ) => ReturnType<M['callable']> extends Promise<unknown>
        ? ReturnType<M['callable']>
        : Promise<ReturnType<M['callable']>>
    : M extends RemoteSignalMetadata<string, infer V>
      ? Promise<Signal<V>>
      : never;
};

export type GeneratorResponse = {d: boolean; v?: any};

//
// Remote signal
//

export interface RemoteSignalInternal<T> {
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
