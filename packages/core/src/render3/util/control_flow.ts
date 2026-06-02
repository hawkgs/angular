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
import {assertIndexInDeclRange, assertLView} from '../assert';
import {collectNativeNodes} from '../collect_native_nodes';
import {getLContext} from '../context_discovery';
import {CONTAINER_HEADER_OFFSET, LContainer, NATIVE} from '../interfaces/container';
import {HOST, INJECTOR, LView, TVIEW, HEADER_OFFSET, TView} from '../interfaces/view';
import {getNativeByTNode} from './view_utils';
import {isLContainer, isLView} from '../interfaces/type_checks';
import {
  CONDITIONAL_BLOCK_L_DUMMY,
  DebugConditionalCreateType,
  LConditionalBlockDetails,
  LConditionalBranchBlockDetails,
  TConditionalBlockDetails,
  TConditionalBranchBlockDetails,
} from '../interfaces/control_flow';
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

const conditionalBlockFinder: ControlFlowBlockViewFinder = ({
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
  const isConditionalCreate =
    tNode != null && isTNodeShape(tNode) && (tNode.flags & TNodeFlags.isControlFlowStart) !== 0;

  if (!isConditionalCreate) {
    return null;
  }

  const tDetails = getTGenericConditionalBlockDetails<TConditionalBlockDetails>(tView, tNode);
  if (!tDetails) {
    return null;
  }

  const lContainer = slot;
  const lDetails = getLConditionalBlockDetails<LConditionalBlockDetails>(lView, tNode);
  const nativeNode = getNativeByTNode(tNode, lView);

  if (!node.contains(nativeNode as Node)) {
    return null;
  }

  const rootNodes: Node[] = [];
  // Get comment node; There should always be a comment node
  const commentHostNode = lContainer[HOST];
  const renderedLView = getRenderedLView(lContainer);

  if (renderedLView) {
    collectNativeNodes(
      renderedLView[TVIEW],
      renderedLView,
      renderedLView[TVIEW].firstChild,
      rootNodes,
    );
  }

  let parentBlock: ControlFlowBlock;

  switch (getTConditionalBlockType(tDetails)) {
    case ControlFlowBlockType.If:
      parentBlock = {
        type: ControlFlowBlockType.If,
        tDummy: tDetails.tDummy,
        lDummy: lDetails[CONDITIONAL_BLOCK_L_DUMMY],
        hostNode: commentHostNode as Node,
        rootNodes,
      } satisfies IfBlockData;
      break;
    case ControlFlowBlockType.Switch:
      parentBlock = {
        type: ControlFlowBlockType.Switch,
        tDummy: tDetails.tDummy,
        lDummy: lDetails[CONDITIONAL_BLOCK_L_DUMMY],
        hostNode: commentHostNode as Node,
        rootNodes,
      } satisfies SwitchBlockData;
      break;
    default:
      throw new Error('Conditional block not recognized');
  }

  const branches = getConditionalBranches(lView, tView, slotIdx, parentBlock);

  return [parentBlock, ...branches];
};

// Represents all supported control flow block finders.
const CONTROL_FLOW_BLOCK_FINDERS: ControlFlowBlockViewFinder[] = [
  deferBlockFinder,
  forLoopBlockFinder,
  conditionalBlockFinder,
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

// DevTools-Conditionals code START

export function getGenericConditionalBlockDetailsSlotIndex(conditionalBlockIndex: number) {
  return conditionalBlockIndex + 1;
}

function getTGenericConditionalBlockDetails<
  T = TConditionalBlockDetails | TConditionalBranchBlockDetails,
>(tView: TView, tNode: TNode): T | null {
  const slotIndex = getGenericConditionalBlockDetailsSlotIndex(tNode.index);
  if (isNaN(slotIndex)) {
    return null;
  }
  ngDevMode && assertIndexInDeclRange(tView, slotIndex);
  return tView.data[slotIndex] as T;
}

function getLConditionalBlockDetails<T = LConditionalBlockDetails | LConditionalBranchBlockDetails>(
  lView: LView,
  tNode: TNode,
): T {
  const tView = lView[TVIEW];
  const slotIndex = getGenericConditionalBlockDetailsSlotIndex(tNode.index);
  ngDevMode && assertIndexInDeclRange(tView, slotIndex);
  return lView[slotIndex];
}

export function setDebugTGenericConditionalBlockDetails(
  tView: TView,
  conditionalBlockIndex: number,
  tDetails: TConditionalBlockDetails | TConditionalBranchBlockDetails,
) {
  // Warning: Currently, the TDetails slot is allocated on all envs.
  if (!ngDevMode) {
    return;
  }
  const slotIndex = getGenericConditionalBlockDetailsSlotIndex(conditionalBlockIndex);
  assertIndexInDeclRange(tView, slotIndex);
  tView.data[slotIndex] = tDetails;
}

export function setDebugLGenericConditionalBlockDetails(
  lView: LView,
  conditionalBlockIndex: number,
  lDetails: LConditionalBlockDetails | LConditionalBranchBlockDetails,
) {
  // Warning: Currently, the TDetails slot is allocated on all envs.
  if (!ngDevMode) {
    return;
  }
  const tView = lView[TVIEW];
  const slotIndex = getGenericConditionalBlockDetailsSlotIndex(conditionalBlockIndex);
  assertIndexInDeclRange(tView, slotIndex);
  lView[slotIndex] = lDetails;
}

function getTConditionalBlockType(tDetails: TConditionalBlockDetails): ControlFlowBlockType {
  switch (tDetails.type) {
    case DebugConditionalCreateType.IfBlock:
    default:
      return ControlFlowBlockType.If;
    case DebugConditionalCreateType.SwitchBlock:
      return ControlFlowBlockType.Switch;
  }
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
  // Adjust the index in order to skip the conditional TDetails block.
  const adjustedIndex = getGenericConditionalBlockDetailsSlotIndex(parentSlot);

  for (let slot = adjustedIndex + 1; slot < tView.bindingStartIndex; slot++) {
    const tViewEntry = tView.data[slot];
    const isConditionalBranch =
      tViewEntry != null &&
      isTNodeShape(tViewEntry) &&
      (tViewEntry.flags & TNodeFlags.isInControlFlow) !== 0;

    if (!isConditionalBranch) {
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

    const isIfBlock = parentBlock.type === ControlFlowBlockType.If;
    const branch: ConditionalBranchBlockData = isIfBlock
      ? {
          type: ControlFlowBlockType.IfBranch,
          hostNode,
          rootNodes,
          parent: parentBlock,
        }
      : {
          type: ControlFlowBlockType.SwitchBranch,
          hostNode,
          rootNodes,
          parent: parentBlock,
        };

    branches.push(branch);
  }

  return branches;
}
