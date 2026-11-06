/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import type {Signal} from '@angular/core';
import {MessageBus} from '../../../../protocol';

/**
 * Describes all types of remote calls on the origin.
 */
export enum OriginCallType {
  Sync,
  Async,
  VoidSync,
  VoidAsync,
  AsyncGenerator,
  RemoteSignal,
}

// export enum RemoteCallType {
//   Async,
//   AsyncGenerator,
//   AsyncRemoteSignal,
//   SyncRemoteSignal,
// }

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
  type: OriginCallType;
  callable: F;
}

export interface RemoteSignalMetadata<N extends string = string, T = any> {
  name: N;
  type: OriginCallType;
  signal: RemoteSignal<T>;
}

export type SerializedApiMetadata = Map<string, OriginCallType>;

export type DtLinkApi = ApiMetadata[];

export type DtLinkCallApi<T extends DtLinkApi> = {
  [M in T[number] as M['name']]: M extends CallableMetadata
    ? (
        ...args: Parameters<M['callable']>
      ) => ReturnType<M['callable']> extends Promise<unknown>
        ? ReturnType<M['callable']>
        : Promise<ReturnType<M['callable']>>
    : M extends RemoteSignalMetadata<string, infer V>
      ? () => Promise<Signal<V | undefined>>
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
  dispose(): void;
  __name: string;
  __patch: (messageBus: MessageBus<any>) => void;
  __patched: () => boolean;
  __NG_REMOTE_SIGNAL: true;
}

export type RemoteSignal<T> = Omit<
  RemoteSignalInternal<T>,
  Extract<keyof RemoteSignalInternal<T>, `__${string}`>
>;
