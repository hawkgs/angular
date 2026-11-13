/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Signal, signal} from '@angular/core';

export function convertGeneratorToSignal<T, R>(
  generator: () => Promise<AsyncGenerator<T, R>>,
  initialValue: T | R,
): Signal<T | R> {
  const sig = signal(initialValue);

  generator().then(async (iter) => {
    let result: IteratorResult<T, R>;
    while (!(result = await iter.next()).done) {
      sig.set(result.value);
    }
    if (result) {
      sig.set(result.value);
    }
  });

  return sig.asReadonly();
}
