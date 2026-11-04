/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DtLinkApi, remoteSignal} from '../../../shared-utils';

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

function getQuxResponse() {
  return 'qux';
}

// Remote signals playground
const buildings = remoteSignal('buildings', 'empire state');

export function testRemoteSignalsAfterPatch() {
  setTimeout(() => {
    buildings.set('Test');

    setTimeout(() => {
      buildings.set('Test 2');
    });
  }, 2000);
}

export const BACKEND_DTLINK_API = {
  getFooData,
  requestBarData,
  countGenerator$,
  getQuxResponse,
} satisfies DtLinkApi;

export type BackendDtLinkApi = typeof BACKEND_DTLINK_API;
