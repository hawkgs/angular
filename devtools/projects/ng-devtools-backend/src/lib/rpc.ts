/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {asyncFn, asyncGeneratorFn, DtLinkApi, syncFn} from '../../../shared-utils';

//
// DtLink examples
//

// Sync function
function getFooData() {
  return 'Hello, Foo!';
}

// Async function
async function requestBarData(bar: string, num: number) {
  return `Hello, ${bar}! Number: ${num}`;
}

// Async generator
async function* countGenerator() {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    yield i;
  }
  return 'done';
}

async function* buildings() {
  yield 'Empire State';
  yield await new Promise<string>((r) => setTimeout(() => r('Chrysler'), 2000));
  return await new Promise<string>((r) => setTimeout(() => r('One WTC'), 3000));
}

// Exposed BE API.
// Add all exposed functions, generators or remote signals to the array.
// The items should be decorated with one of the available function
// decorators that corresponds to the features of the exposable.
export const BACKEND_DTLINK_API = [
  syncFn({getFooData}),
  asyncFn({requestBarData}),
  asyncGeneratorFn({countGenerator}),
  asyncGeneratorFn({buildings}),
] satisfies DtLinkApi;

/** Exposed DtLink backend API. */
export type BackendDtLinkApi = typeof BACKEND_DTLINK_API;
