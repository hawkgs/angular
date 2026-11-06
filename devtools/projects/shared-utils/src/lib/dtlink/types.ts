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
 * Describes all types of remote calls on the source.
 */
export enum SourceCallType {
  Sync = 0,
  Async = 1,
  VoidSync = 2,
  VoidAsync = 3,
  AsyncGenerator = 4,
  RemoteSignal = 5,
}

/**
 * Describes all types of remote calls on the destination.
 */
export enum DestinationCallType {
  Async = 1,
  AsyncGenerator = 4,
  AsyncRemoteSignal = 6,
  SyncRemoteSignal = 7,
}

// These types describe the actual callables that reside on the source.
export type SyncFn = (...args: any[]) => unknown;
export type AsyncFn = (...args: any[]) => Promise<unknown>;
export type VoidSyncFn = (...args: any[]) => void;
export type VoidAsyncFn = (...args: any[]) => Promise<void>;
export type AsyncGeneratorFn = (...args: any[]) => AsyncGenerator<unknown>;

/**
 * Describes all types of callables on the source (e.g. sync/async functions, generators, etc.)
 */
export type ApiCallable = SyncFn | AsyncFn | VoidSyncFn | VoidAsyncFn | AsyncGeneratorFn;

/**
 * Describes the metadata of a callable (e.g. sync/async functions, generators, etc.).
 */
// NOTE: The compiler needs the N and F template types to successfully
// convert a DtLinkApi to a DtLinkRemoteApi.
export interface CallableMetadata<N extends string = string, F extends ApiCallable = ApiCallable> {
  name: N;
  type: SourceCallType;
  fn: F;
}

/**
 * Describes remote signal metadata.
 */
// NOTE: The compiler needs the N and F template types to successfully
// convert a DtLinkApi to a DtLinkRemoteApi.
export interface RemoteSignalMetadata<N extends string = string, T = unknown> {
  name: N;
  type: SourceCallType;
  signal: RemoteSignal<T>;
}

/**
 * API metadata entry on the source.
 */
export type ApiMetadata<
  N extends string = string,
  F extends ApiCallable = ApiCallable,
  T = unknown,
> = CallableMetadata<N, F> | RemoteSignalMetadata<N, T>;

/**
 * Serialized `ApiMetadata` ready to be consumed by the destination.
 */
export type SerializedApiMetadata = Map<string, SourceCallType>;

/**
 * `DtLink` exposed API as observed on the source.
 */
export type DtLinkApi = ApiMetadata[];

/**
 * `DtLink` exposed API as observed on the destination.
 */
// What the type does?:
// It converts the DtLinkApi to a consumable on the destination
// DtLinkRemoteApi. Basically:
// - The RemoteSignal<T> types are converted to read-only Signals<T | undefined>
// - Sync callables on the origin are converted to Promises on the destination,
// including async generators
export type DtLinkRemoteApi<T extends DtLinkApi> = {
  [M in T[number] as M['name']]: M extends CallableMetadata
    ? (
        ...args: Parameters<M['fn']>
      ) => ReturnType<M['fn']> extends Promise<unknown>
        ? ReturnType<M['fn']>
        : Promise<ReturnType<M['fn']>>
    : M extends RemoteSignalMetadata<string, infer V>
      ? () => Promise<Signal<V | undefined>>
      : never;
};

/**
 * Complete `RemoteSignal` interface.
 * Internal usage ONLY.
 */
export interface RemoteSignalInternal<T> {
  (): T;
  set(value: T): void;
  update(updater: (value: T) => T): void;
  dispose(): void;

  __patch: (messageBus: MessageBus<any>) => void;
  __NG_DTLINK_REMOTE_SIGNAL: true;
}

/**
 * Remote signal. Acts as a proxy, on the source, of a
 * standard Angular signal on the destination.
 *
 * NOTE: The developer MUST dispose it manually when
 * no longer needed via `.dispose()`.
 */
export type RemoteSignal<T> = Omit<
  RemoteSignalInternal<T>,
  Extract<keyof RemoteSignalInternal<T>, `__${string}`>
>;
