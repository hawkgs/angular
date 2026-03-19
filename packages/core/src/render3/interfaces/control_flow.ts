/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export const IF_BLOCK_L_DUMMY = 0;

export interface TIfBlockDetails {
  tDummy: string;
}

export interface LIfBlockDetails extends Array<unknown> {
  [IF_BLOCK_L_DUMMY]: string;
}
