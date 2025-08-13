/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DebugLogger} from './debug-logger';

export type Parameters<F> = F extends (...args: infer T) => any ? T : never;

export abstract class MessageBus<T> {
  on<E extends keyof T>(topic: E, cb: T[E]): () => void {
    DebugLogger.getLogger().log(`${this.constructor.name}.on '${topic.toString()}'`);
    return () => {};
  }

  once<E extends keyof T>(topic: E, cb: T[E]): void {
    DebugLogger.getLogger().log(`${this.constructor.name}.once '${topic.toString()}'`);
  }

  emit<E extends keyof T>(topic: E, args?: Parameters<T[E]>): boolean {
    DebugLogger.getLogger().log(
      `${this.constructor.name}.emit '${topic.toString()}' with args: ${JSON.stringify(args)}`,
    );
    return true;
  }

  abstract destroy(): void;
}
