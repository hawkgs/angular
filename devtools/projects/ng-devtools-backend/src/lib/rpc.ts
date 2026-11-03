/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DtLinkApi} from '../../../shared-utils';

async function getFooData() {
  return 'Hello, Foo!';
}

async function requestBarData(bar: string, flag: boolean) {
  return `Bar data: ${bar}; Flag: ${flag}`;
}

async function* countGenerator$() {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 500));
    yield i;
  }
  return 'over';
}

export const BACKEND_DTLINK_API = {
  getFooData,
  requestBarData,
  countGenerator$,
} satisfies DtLinkApi;

export type BackendDtLinkApi = typeof BACKEND_DTLINK_API;
