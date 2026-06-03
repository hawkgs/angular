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
// The type copy exists in compiler > template pipeline.
export enum DebugConditionalCreateType {
  IfBlock = 0,
  SwitchBlock = 1,
}

/**
 * Represents ConditionalBranchCreateOp type, i.e. `@else if`, `@else`, `@case` or `@default`.
 */
// The type copy exists in compiler > template pipeline.
export enum DebugConditionalBranchCreateType {
  ElseIfBlock = 0,
  ElseBlock = 1,
  CaseBlock = 2,
  DefaultBlock = 3,
}

export enum DebugConditionalType {
  Conditional = 0,
  ConditionalBranch = 1,
}

export interface TGenericConditionalBlockDetails {
  __cond: DebugConditionalType;
}

export interface TConditionalBlockDetails extends TGenericConditionalBlockDetails {
  __cond: DebugConditionalType.Conditional;
  type?: DebugConditionalCreateType;
}

export interface TConditionalBranchBlockDetails extends TGenericConditionalBlockDetails {
  __cond: DebugConditionalType.ConditionalBranch;
  type?: DebugConditionalBranchCreateType;
}
