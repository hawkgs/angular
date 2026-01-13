/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {assertIndexInDeclRange} from '../assert';
import {getLContext} from '../context_discovery';
import {CONTAINER_HEADER_OFFSET, LContainer} from '../interfaces/container';
import {IF_BLOCK_L_DUMMY, LIfBlockDetails, TIfBlockDetails} from '../interfaces/control_flow';
import {TNode} from '../interfaces/node';
import {isLContainer, isLView} from '../interfaces/type_checks';
import {HEADER_OFFSET, HOST, LView, TView, TVIEW} from '../interfaces/view';

export interface PublicIfBlockData {
  tDummy: string;
  lDummy: string;
  rootNodes: Node[];
}

export interface IntermediateIfBlockData {
  tDetails: TIfBlockDetails;
  lContainer: LContainer;
  tNode: TNode;
  lView: LView;
}

function getIfBlockSlotIndex(ifBlockIndex: number) {
  return ifBlockIndex + 1;
}

function isTIfBlockDetails(value: unknown): value is TIfBlockDetails {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as TIfBlockDetails).tDummy === 'string'
  );
}

export function getTIfBlockDetails(tView: TView, tNode: TNode): TIfBlockDetails {
  const slotIndex = getIfBlockSlotIndex(tNode.index);
  ngDevMode && assertIndexInDeclRange(tView, slotIndex);
  return tView.data[slotIndex] as TIfBlockDetails;
}

export function getLIfBlockDetails(lView: LView, tNode: TNode): LIfBlockDetails {
  const tView = lView[TVIEW];
  const slotIndex = getIfBlockSlotIndex(tNode.index);
  ngDevMode && assertIndexInDeclRange(tView, slotIndex);
  return lView[slotIndex];
}

export function setDebugTIfBlockDetails(
  tView: TView,
  ifBlockIndex: number,
  tDetails: TIfBlockDetails,
) {
  // Warning: Currently, the TDetails slot is allocated on all envs.
  if (!ngDevMode) {
    return;
  }
  const slotIndex = getIfBlockSlotIndex(ifBlockIndex);
  assertIndexInDeclRange(tView, slotIndex);
  tView.data[slotIndex] = tDetails;
}

export function setDebugLIfBlockDetails(
  lView: LView,
  ifBlockIndex: number,
  lDetails: LIfBlockDetails,
) {
  // Warning: Currently, the TDetails slot is allocated on all envs.
  if (!ngDevMode) {
    return;
  }
  const tView = lView[TVIEW];
  const slotIndex = getIfBlockSlotIndex(ifBlockIndex);
  assertIndexInDeclRange(tView, slotIndex);
  lView[slotIndex] = lDetails;
}

/** ng global interface */
export function getIfBlocks(node: Node): PublicIfBlockData[] {
  const results: PublicIfBlockData[] = [];
  const lView = getLContext(node)?.lView;

  if (lView) {
    findIfBlocks(node, lView, results);
  }

  return results;
}

function findIfBlocks(node: Node, lView: LView, blocks: PublicIfBlockData[]) {
  const ifBlocks: IntermediateIfBlockData[] = [];

  traverseLViewForIfBlocks(lView, ifBlocks);

  for (const block of ifBlocks) {
    const lDetails = getLIfBlockDetails(block.lView, block.tNode);

    const publicBlock: PublicIfBlockData = {
      tDummy: block.tDetails.tDummy,
      lDummy: lDetails[IF_BLOCK_L_DUMMY],
      rootNodes: [],
    };

    // TBD, collect nodes

    blocks.push(publicBlock);
  }
}

function traverseLViewForIfBlocks(lView: LView, blocks: IntermediateIfBlockData[]) {
  const tView = lView[TVIEW];

  for (let i = HEADER_OFFSET; i < tView.bindingStartIndex; i++) {
    if (isLContainer(lView[i])) {
      const lContainer = lView[i];
      // An LContainer may represent an instance of a defer block, in which case
      // we store it as a result. Otherwise, keep iterating over LContainer views and
      // look for defer blocks.
      const isLast = i === tView.bindingStartIndex - 1;
      if (!isLast) {
        const tNode = tView.data[i] as TNode;
        const tDetails = getTIfBlockDetails(tView, tNode);
        if (isTIfBlockDetails(tDetails)) {
          blocks.push({lContainer, lView, tNode, tDetails});
          // This LContainer represents a defer block, so we exit
          // this iteration and don't inspect views in this LContainer.
          continue;
        }
      }

      // The host can be an `LView` if this is the container
      // for a component that injects `ViewContainerRef`.
      if (isLView(lContainer[HOST])) {
        traverseLViewForIfBlocks(lContainer[HOST], blocks);
      }

      for (let j = CONTAINER_HEADER_OFFSET; j < lContainer.length; j++) {
        traverseLViewForIfBlocks(lContainer[j] as LView, blocks);
      }
    } else if (isLView(lView[i])) {
      // This is a component, enter the `getDeferBlocks` recursively.
      traverseLViewForIfBlocks(lView[i], blocks);
    }
  }
}
