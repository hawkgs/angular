/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Represents `conditionalCreate` control flow instruction type, i.e. `@if` or `@switch`.
 */
export enum DebugConditionalCreateType {
  IfBlock = 0,
  SwitchBlock = 1,
}

export const CONDITIONAL_BLOCK_L_DUMMY = 0;

export interface TConditionalBlockDetails {
  type?: DebugConditionalCreateType;
  tDummy: string;
}

export interface LConditionalBlockDetails extends Array<unknown> {
  [CONDITIONAL_BLOCK_L_DUMMY]: string;
}
