/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  DEFER_BLOCK_STATE,
  DeferBlockInternalState,
  DeferBlockState,
  DeferBlockTrigger,
  LDeferBlockDetails,
  LOADING_AFTER_SLOT,
  MINIMUM_SLOT,
  SSR_UNIQUE_ID,
  TDeferBlockDetails,
} from '../../defer/interfaces';
import {DEHYDRATED_BLOCK_REGISTRY, DehydratedBlockRegistry} from '../../defer/registry';
import {
  getLDeferBlockDetails,
  getTDeferBlockDetails,
  isTDeferBlockDetails,
} from '../../defer/utils';
import {NUM_ROOT_NODES} from '../../hydration/interfaces';
import {NGH_DEFER_BLOCKS_KEY} from '../../hydration/utils';
import {TransferState} from '../../transfer_state';
import {assertLView} from '../assert';
import {collectNativeNodes} from '../collect_native_nodes';
import {getLContext} from '../context_discovery';
import {CONTAINER_HEADER_OFFSET, LContainer, NATIVE} from '../interfaces/container';
import {HOST, INJECTOR, LView, TVIEW, HEADER_OFFSET, TView} from '../interfaces/view';
import {getNativeByTNode} from './view_utils';
import {isLContainer, isLView} from '../interfaces/type_checks';
import {isTNodeShape, TNode, TNodeFlags} from '../interfaces/node';

import {
  ControlFlowBlock,
  ControlFlowBlockViewFinder,
  ControlFlowBlockViewFinderConfig,
  ControlFlowBlockType,
  DeferBlockData,
  ForLoopBlockData,
  RepeaterMetadataShape,
  IfBlockData,
  SwitchBlockData,
  ConditionalBranchBlockData,
  ConditionalBlockData,
  CaseBlockData,
  DefaultBlockData,
} from './control_flow_types';

/**
 * Gets all of the control flow blocks that are present inside the specified DOM node.
 * @param node Node in which to look for control flow blocks.
 */
export function getControlFlowBlocks(node: Node): ControlFlowBlock[] {
  const lView = getLContext(node)?.lView;

  if (lView) {
    return findControlFlowBlocks(node, lView);
  }

  return [];
}

/**
 * Finds and returns all `@defer` blocks in a LView.
 *
 * @param config Finder configuration object.
 * @returns
 */
const deferBlockFinder: ControlFlowBlockViewFinder = ({
  node,
  lView,
  tView,
  slotIdx,
}: ControlFlowBlockViewFinderConfig) => {
  const slot = lView[slotIdx];
  if (!isLContainer(slot)) {
    return null;
  }

  // An LContainer may represent an instance of a defer block, in which case
  // we store it as a result. Otherwise, keep iterating over LContainer views and
  // look for defer blocks.
  const isLast = slotIdx === tView.bindingStartIndex - 1;
  if (isLast) {
    return null;
  }

  const tNode = tView.data[slotIdx] as TNode;
  const tDetails = getTDeferBlockDetails(tView, tNode);
  const lContainer = slot;

  if (isTDeferBlockDetails(tDetails)) {
    const native = getNativeByTNode(tNode, lView);
    const lDetails = getLDeferBlockDetails(lView, tNode);

    // The LView from `getLContext` might be the view the element is placed in.
    // Filter out defer blocks that aren't inside the specified root node.
    if (!node.contains(native as Node)) {
      return null;
    }

    const viewInjector = lView[INJECTOR];
    const registry = viewInjector.get(DEHYDRATED_BLOCK_REGISTRY, null, {optional: true});

    const renderedLView = getRenderedLView(lContainer);
    const rootNodes: Node[] = [];
    const hydrationState = inferHydrationState(tDetails, lDetails, registry);

    if (renderedLView !== null) {
      collectNativeNodes(
        renderedLView[TVIEW],
        renderedLView,
        renderedLView[TVIEW].firstChild,
        rootNodes,
      );
    } else if (hydrationState === 'dehydrated') {
      // We'll find the number of root nodes in the transfer state and
      // collect that number of elements that precede the defer block comment node.

      const transferState = viewInjector.get(TransferState);
      const deferBlockParents = transferState.get(NGH_DEFER_BLOCKS_KEY, {});

      const deferId = lDetails[SSR_UNIQUE_ID]!;
      const deferData = deferBlockParents[deferId];
      const numberOfRootNodes = deferData[NUM_ROOT_NODES];

      let collectedNodeCount = 0;
      const deferBlockCommentNode = lContainer[NATIVE] as Node;
      let currentNode: Node | null = deferBlockCommentNode.previousSibling;

      while (collectedNodeCount < numberOfRootNodes && currentNode) {
        rootNodes.unshift(currentNode);
        currentNode = currentNode.previousSibling;
        collectedNodeCount++;
      }
    }

    return {
      type: ControlFlowBlockType.Defer,
      state: stringifyState(lDetails[DEFER_BLOCK_STATE]),
      incrementalHydrationState: hydrationState,
      hasErrorBlock: tDetails.errorTmplIndex !== null,
      loadingBlock: {
        exists: tDetails.loadingTmplIndex !== null,
        minimumTime: tDetails.loadingBlockConfig?.[MINIMUM_SLOT] ?? null,
        afterTime: tDetails.loadingBlockConfig?.[LOADING_AFTER_SLOT] ?? null,
      },
      placeholderBlock: {
        exists: tDetails.placeholderTmplIndex !== null,
        minimumTime: tDetails.placeholderBlockConfig?.[MINIMUM_SLOT] ?? null,
      },
      triggers: tDetails.debug?.triggers ? Array.from(tDetails.debug.triggers).sort() : [],
      hostNode: lContainer[HOST] as Node,
      rootNodes,
    } satisfies DeferBlockData;
  }

  return null;
};

/**
 * Finds and returns all `@for` blocks in a LView.
 *
 * @param config Finder configuration object.
 * @returns
 */
const forLoopBlockFinder: ControlFlowBlockViewFinder = ({
  lView,
  slotIdx,
}: ControlFlowBlockViewFinderConfig) => {
  const slot = lView[slotIdx];

  if (!isRepeaterMetadata(slot)) {
    return null;
  }

  const metadata = slot;
  const liveCollection = metadata.liveCollection;
  const items: unknown[] = [];

  if (liveCollection) {
    for (let j = 0; j < liveCollection.length; j++) {
      items.push(liveCollection.at(j));
    }
  }

  const containerIndex = slotIdx + 1;
  const lContainer = lView[containerIndex];
  const rootNodes: Node[] = [];

  if (isLContainer(lContainer)) {
    // Collect root nodes from each view in the container
    for (let viewIdx = CONTAINER_HEADER_OFFSET; viewIdx < lContainer.length; viewIdx++) {
      const viewAtIdx = lContainer[viewIdx];
      if (isLView(viewAtIdx)) {
        const viewTView = viewAtIdx[TVIEW];
        const viewNodes = collectNativeNodes(viewTView, viewAtIdx, viewTView.firstChild, []);
        rootNodes.push(...viewNodes);
      }
    }
  }

  return {
    type: ControlFlowBlockType.For,
    items,
    hasEmptyBlock: metadata.hasEmptyBlock,
    rootNodes,
    hostNode: lContainer[HOST] as Node,
    trackExpression: getTrackExpression(metadata),
  } satisfies ForLoopBlockData;
};

/**
 * Finds and returns all `@if` blocks along its branches (`@else if` and `@else`) in a LView.
 *
 * @param config Finder configuration object.
 * @returns
 */
const ifBlockFinder: ControlFlowBlockViewFinder = ({
  lView,
  tView,
  slotIdx,
  node,
}: ControlFlowBlockViewFinderConfig) => {
  const slot = lView[slotIdx];
  if (!isLContainer(slot)) {
    return null;
  }

  const isLast = slotIdx === tView.bindingStartIndex - 1;
  if (isLast) {
    return null;
  }

  const tNode = tView.data[slotIdx];
  if (tNode == null || !isTNodeShape(tNode) || !areFlagsEqual(tNode.flags, TNodeFlags.isIfBlock)) {
    return null;
  }

  const lContainer = slot;
  const nativeNode = getNativeByTNode(tNode, lView);

  if (!node.contains(nativeNode as Node)) {
    return null;
  }

  // Get comment node; There should always be a comment node
  const commentHostNode = lContainer[HOST];
  const rootNodes: Node[] = [];
  const renderedLView = getRenderedLView(lContainer);

  if (renderedLView) {
    collectNativeNodes(
      renderedLView[TVIEW],
      renderedLView,
      renderedLView[TVIEW].firstChild,
      rootNodes,
    );
  }

  const parentBlock = {
    type: ControlFlowBlockType.If,
    hostNode: commentHostNode as Node,
    rootNodes,
  } satisfies IfBlockData;

  const branches = getConditionalBranches(lView, tView, slotIdx, parentBlock);

  return [parentBlock, ...branches];
};

/**
 * Finds and returns all `@switch` blocks along its branches (`@case` and `@default`) in a LView.
 *
 * @param config Finder configuration object.
 * @returns
 */
const switchBlockFinder: ControlFlowBlockViewFinder = ({
  lView,
  tView,
  slotIdx,
  node,
}: ControlFlowBlockViewFinderConfig) => {
  const slot = lView[slotIdx];
  if (!isLContainer(slot)) {
    return null;
  }

  const isLast = slotIdx === tView.bindingStartIndex - 1;
  if (isLast) {
    return null;
  }

  const tNode = tView.data[slotIdx];
  const isSwitchBlock =
    tNode != null &&
    isTNodeShape(tNode) &&
    (areFlagsEqual(tNode.flags, TNodeFlags.isSwitchFollowedByCaseBlock) ||
      areFlagsEqual(tNode.flags, TNodeFlags.isSwitchFollowedByDefaultBlock));

  if (!isSwitchBlock) {
    return null;
  }

  const lContainer = slot;
  const nativeNode = getNativeByTNode(tNode, lView);

  if (!node.contains(nativeNode as Node)) {
    return null;
  }

  // Get comment node; There should always be a comment node
  const commentHostNode = lContainer[HOST];
  const rootNodes: Node[] = [];
  const renderedLView = getRenderedLView(lContainer);

  if (renderedLView) {
    collectNativeNodes(
      renderedLView[TVIEW],
      renderedLView,
      renderedLView[TVIEW].firstChild,
      rootNodes,
    );
  }

  // The construction of the switch block data presents a special case.
  // As we know, both `@if` and `@switch` use the same internal Ivy
  // mechanism for rendering the respective template, that is, a
  // create and branch instructions. So, for example:
  //
  // @if {
  //   <!--foo-->
  // } @else if {
  //   <!--bar-->
  // } @else {
  //   <!--baz-->
  // }
  // Note: We are showing only comment/host nodes.
  //
  // will result in:
  //
  // create(<!--foo-->) branch(<!--bar-->) branch(<!--baz-->)
  //
  // where each intruction represents a conditional block – if, else if and else.
  // That instruction set can also represent a switch statement:
  //
  // @switch {
  //   @case <foo>
  //   @case <bar>
  //   @default <baz>
  // }
  //
  // However, in that case, it's evident that the wrapping `@switch`
  // block does not have an actual DOM node, i.e. a comment/host node.
  // This is why, in order to overcome this and be able to represent
  // the original statement as descibed in the template code, we:
  //
  //   1. Use the host node of the leading branch for the `@switch` block.
  //.  2. Set the host nodes of all switch branches as root children/notes
  //      of the `@switch` block. This technically embeds all following case
  //      and default blocks into the parent switch.

  const parentBlock: ControlFlowBlock = {
    type: ControlFlowBlockType.Switch,
    hostNode: commentHostNode as Node, // Set the leading branch host node (pt. 1)
    rootNodes: [],
  } satisfies SwitchBlockData;

  const leadingBranchBlock = {
    type: areFlagsEqual(tNode.flags, TNodeFlags.isSwitchFollowedByCaseBlock)
      ? ControlFlowBlockType.Case
      : ControlFlowBlockType.Default,
    parent: parentBlock,
    hostNode: commentHostNode as Node,
    rootNodes,
  } satisfies CaseBlockData | DefaultBlockData;

  const branches = getConditionalBranches(lView, tView, slotIdx, parentBlock);

  // Setting the branch host nodes (pt. 2)
  const branchesHosts = branches.map((b) => b.hostNode);
  parentBlock.rootNodes = [commentHostNode as Node, ...branchesHosts];

  return [parentBlock, leadingBranchBlock, ...branches];
};

// Represents all supported control flow block finders.
const CONTROL_FLOW_BLOCK_FINDERS: ControlFlowBlockViewFinder[] = [
  deferBlockFinder,
  forLoopBlockFinder,
  ifBlockFinder,
  switchBlockFinder,
];

/**
 * Finds all the control flow blocks inside a specific node and view.
 *
 * @param node Node in which to search for blocks.
 * @param lView View within the node in which to search for blocks.
 * @param results (Optional) Array to which to add blocks once they're found.
 * @returns Found control flow blocks results array.
 */
function findControlFlowBlocks(
  node: Node,
  lView: LView,
  results: ControlFlowBlock[] = [],
): ControlFlowBlock[] {
  const tView = lView[TVIEW];

  for (let i = HEADER_OFFSET; i < tView.bindingStartIndex; i++) {
    const slot = lView[i];

    for (const finder of CONTROL_FLOW_BLOCK_FINDERS) {
      const blockData = finder({node, lView, tView, slotIdx: i});
      if (blockData) {
        if (!Array.isArray(blockData)) {
          results.push(blockData);
        } else {
          for (const block of blockData) {
            results.push(block);
          }
        }
        break;
      }
    }

    if (isLContainer(slot)) {
      const lContainer = slot;

      // The host can be an `LView` if this is the container
      // for a component that injects `ViewContainerRef`.
      if (isLView(lContainer[HOST])) {
        findControlFlowBlocks(node, lContainer[HOST], results);
      }

      for (let j = CONTAINER_HEADER_OFFSET; j < lContainer.length; j++) {
        findControlFlowBlocks(node, lContainer[j], results);
      }
    } else if (isLView(slot)) {
      // This is a component, enter the `findControlFlowBlocks` recursively.
      findControlFlowBlocks(node, slot, results);
    }
  }

  return results;
}

/**
 * Turns the `DeferBlockState` into a string which is more readable than the enum form.
 *
 * @param lDetails Information about the
 * @returns
 */
function stringifyState(state: DeferBlockState | DeferBlockInternalState): DeferBlockData['state'] {
  switch (state) {
    case DeferBlockState.Complete:
      return 'complete';
    case DeferBlockState.Loading:
      return 'loading';
    case DeferBlockState.Placeholder:
      return 'placeholder';
    case DeferBlockState.Error:
      return 'error';
    case DeferBlockInternalState.Initial:
      return 'initial';
    default:
      throw new Error(`Unrecognized state ${state}`);
  }
}

/**
 * Infers the hydration state of a specific defer block.
 * @param tDetails Static defer block information.
 * @param lDetails Instance defer block information.
 * @param registry Registry coordinating the hydration of defer blocks.
 */
function inferHydrationState(
  tDetails: TDeferBlockDetails,
  lDetails: LDeferBlockDetails,
  registry: DehydratedBlockRegistry | null,
): DeferBlockData['incrementalHydrationState'] {
  if (
    registry === null ||
    lDetails[SSR_UNIQUE_ID] === null ||
    tDetails.hydrateTriggers === null ||
    tDetails.hydrateTriggers.has(DeferBlockTrigger.Never)
  ) {
    return 'not-configured';
  }
  return registry.has(lDetails[SSR_UNIQUE_ID]) ? 'dehydrated' : 'hydrated';
}

/**
 * Gets the current LView that is rendered out in a control flow block (if, defer).
 * @param details Instance information about the block.
 */
function getRenderedLView(lContainer: LContainer): LView | null {
  // Defer block containers can only ever contain one view.
  // If they're empty, it means that nothing is rendered.
  if (lContainer.length <= CONTAINER_HEADER_OFFSET) {
    return null;
  }

  const lView = lContainer[CONTAINER_HEADER_OFFSET];
  ngDevMode && assertLView(lView);
  return lView;
}

/**
 * Checks if a value looks like RepeaterMetadata by duck-typing.
 * Can't use instanceof because that would require importing from control_flow.ts.
 */
function isRepeaterMetadata(value: unknown): value is RepeaterMetadataShape {
  return (
    value !== null &&
    typeof value === 'object' &&
    'hasEmptyBlock' in value &&
    'trackByFn' in value &&
    typeof (value as RepeaterMetadataShape).trackByFn === 'function'
  );
}

/**
 * Returns the string representation of the track expression.
 *
 * @param metadata Metadata containing the track function.
 * @returns
 */
function getTrackExpression(metadata: RepeaterMetadataShape): string {
  const trackByFn = metadata.trackByFn;
  if (trackByFn.name === 'ɵɵrepeaterTrackByIndex') {
    return '$index';
  }
  if (trackByFn.name === 'ɵɵrepeaterTrackByIdentity') {
    return 'item';
  }
  return 'function';
}

/** Checks whether two `TNodeFlags` are equal. */
function areFlagsEqual(a: TNodeFlags, b: TNodeFlags) {
  return (a & b) === b;
}

function getConditionalBranchBlockType(flags: TNodeFlags): ControlFlowBlockType | null {
  if (areFlagsEqual(flags, TNodeFlags.isElseIfBlock)) {
    return ControlFlowBlockType.ElseIf;
  }
  if (areFlagsEqual(flags, TNodeFlags.isElseBlock)) {
    return ControlFlowBlockType.Else;
  }
  if (areFlagsEqual(flags, TNodeFlags.isCaseBlock)) {
    return ControlFlowBlockType.Case;
  }
  if (areFlagsEqual(flags, TNodeFlags.isDefaultBlock)) {
    return ControlFlowBlockType.Default;
  }
  return null;
}

/**
 * Extracts all conditional branch blocks from a `TView` based on the slot index
 * of an `@if`/`@switch` (i.e. control flow start, `ɵɵconditionalCreate`). The algorithm
 * assumes that the branches indexes are directly and consecutively following the slot index
 * of the parent conditional create instruction.
 */
function getConditionalBranches(
  lView: LView,
  tView: TView,
  parentSlot: number,
  parentBlock: ConditionalBlockData,
): ConditionalBranchBlockData[] {
  const branches: ConditionalBranchBlockData[] = [];
  // Adjust the index to the slot that follows the conditional start.
  const adjustedIndex = parentSlot + 1;

  let slot = adjustedIndex;
  // We start looking for any branches right after the control flow start block data.
  // If we don't find any neighboring ones, we break the loop.
  while (slot < tView.bindingStartIndex) {
    const tNode = tView.data[slot];
    const isTNode = tNode != null && isTNodeShape(tNode);
    if (!isTNode) {
      break;
    }
    const conditionalBranchType = getConditionalBranchBlockType(tNode.flags);
    if (!conditionalBranchType) {
      break;
    }

    const lContainer = lView[slot];
    const hostNode = lContainer[HOST];
    const rootNodes: Node[] = [];
    const renderedLView = getRenderedLView(lContainer);

    if (renderedLView) {
      collectNativeNodes(
        renderedLView[TVIEW],
        renderedLView,
        renderedLView[TVIEW].firstChild,
        rootNodes,
      );
    }

    branches.push({
      type: conditionalBranchType,
      hostNode,
      rootNodes,
      parent: parentBlock,
    } as ConditionalBranchBlockData);

    // Move the slot index to the next conditional block.
    slot += 1;
  }

  return branches;
}
