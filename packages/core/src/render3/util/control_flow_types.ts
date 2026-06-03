/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {TrackByFunction} from '../../change_detection';
import {LView, TView} from '../interfaces/view';
import {LiveCollection} from '../list_reconciliation';

export enum ControlFlowBlockType {
  Defer = 0,
  For = 1,
  If = 2,
  ElseIf = 3,
  Else = 4,
  Switch = 5,
  Case = 6,
  Default = 7,
}

export interface ControlFlowBlockDataBase {
  /** The comment host/container node next to which all of the root nodes are rendered. */
  hostNode: Node;

  /** Element root nodes that are currently being shown in the block. */
  rootNodes: Node[];
}

/** Retrieved information about a `@defer` block. */
export interface DeferBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.Defer;

  /** Current state of the block. */
  state: 'placeholder' | 'loading' | 'complete' | 'error' | 'initial';

  /** Hydration state of the block. */
  incrementalHydrationState: 'not-configured' | 'hydrated' | 'dehydrated';

  /** Wherther the block has a connected `@error` block. */
  hasErrorBlock: boolean;

  /** Information about the connected `@loading` block. */
  loadingBlock: {
    /** Whether the block is defined. */
    exists: boolean;

    /** Minimum amount of milliseconds that the block should be shown. */
    minimumTime: number | null;

    /** Amount of time after which the block should be shown. */
    afterTime: number | null;
  };

  /** Information about the connected `@placeholder` block. */
  placeholderBlock: {
    /** Whether the block is defined. */
    exists: boolean;

    /** Minimum amount of time that block should be shown. */
    minimumTime: number | null;
  };

  /** Stringified version of the block's triggers. */
  triggers: string[];
}

/** Retrieved information about a `@for` block. */
export interface ForLoopBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.For;

  /** A list of items managed by the for loop. */
  items: unknown[];

  /** Whether the block has an `@empty` block. */
  hasEmptyBlock: boolean;

  /** String representation of the trackBy expression. */
  trackExpression: string;
}

/** Retrieved information about an `@if` block.  */
export interface IfBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.If;

  tDummy: string;

  lDummy: string;
}

/** Retrieved infromation about an if `@else if` block. */
export interface ElseIfBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.ElseIf;

  /** Reference to the parent `@if` block. */
  parent: IfBlockData;
}

/** Retrieved infromation about an if `@else` block. */
export interface ElseBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.Else;

  /** Reference to the parent `@if` block. */
  parent: IfBlockData;
}

/** Retrieved information about a `@switch` block.  */
export interface SwitchBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.Switch;

  tDummy: string;

  lDummy: string;
}

/** Retrieved information about a switch `@case` block. */
export interface CaseBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.Case;

  /** Reference to the parent `@switch` block. */
  parent: SwitchBlockData;
}

/** Retrieved information about a switch `@default` block. */
export interface DefaultBlockData extends ControlFlowBlockDataBase {
  type: ControlFlowBlockType.Default;

  /** Reference to the parent `@switch` block. */
  parent: SwitchBlockData;
}

/** A collective type for `@if` and `@switch` blocks data. */
export type ConditionalBlockData = IfBlockData | SwitchBlockData;

/** A collective type for `@else`, `@else if`, `@case` and `@default` blocks data. */
export type ConditionalBranchBlockData =
  | ElseIfBlockData
  | ElseBlockData
  | CaseBlockData
  | DefaultBlockData;

/**
 * A control flow block information object.
 */
export type ControlFlowBlock =
  | DeferBlockData
  | ForLoopBlockData
  | IfBlockData
  | ElseIfBlockData
  | ElseBlockData
  | SwitchBlockData
  | CaseBlockData
  | DefaultBlockData;

/**
 * A configuration object passed to a `ControlFlowBlockViewFinder` function.
 */
export interface ControlFlowBlockViewFinderConfig {
  node: Node;
  lView: LView;
  tView: TView;
  slotIdx: number;
}

/**
 * Describes a finder function that extracts `ControlFlowBlock`s from an LView.
 */
export type ControlFlowBlockViewFinder = (
  config: ControlFlowBlockViewFinderConfig,
) => ControlFlowBlock[] | ControlFlowBlock | null;

/**
 * Represents `RepeaterMetadata` data mirror.
 * Required due to a circular dependency.
 */
export interface RepeaterMetadataShape {
  hasEmptyBlock: boolean;
  trackByFn: TrackByFunction<unknown>;
  liveCollection?: LiveCollection<unknown, unknown>;
}
