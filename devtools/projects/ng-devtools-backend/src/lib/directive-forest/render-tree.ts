/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  ɵFrameworkAgnosticGlobalUtils as FrameworkAgnosticGlobalUtils,
  ɵDeferBlockData as DeferBlockData,
  ɵHydratedNode as HydrationNode,
  ɵIfBlockData as IfBlockData,
} from '@angular/core';
import {RenderedDeferBlock, HydrationStatus} from '../../../../protocol';

import {ComponentTreeNode} from '../interfaces';
import {ngDebugClient} from '../ng-debug-api/ng-debug-api';
import {isCustomElement} from '../utils';

const extractViewTree = (
  domNode: Node | Element,
  result: ComponentTreeNode[],
  deferBlocks: DeferBlocksIterator,
  ifBlocks: IfBlocksIterator,
  rootId: number,
  getComponent?: FrameworkAgnosticGlobalUtils['getComponent'],
  getDirectives?: FrameworkAgnosticGlobalUtils['getDirectives'],
  getDirectiveMetadata?: FrameworkAgnosticGlobalUtils['getDirectiveMetadata'],
): ComponentTreeNode[] => {
  // Ignore DOM Node if it came from a different frame. Use instanceof Node to check this.
  if (!(domNode instanceof Node)) {
    return result;
  }

  const directives = getDirectives?.(domNode) ?? [];
  if (!directives.length && !(domNode instanceof Element)) {
    return result;
  }
  const componentTreeNode: ComponentTreeNode = {
    children: [],
    component: null,
    directives: directives.map((dir) => {
      return {
        instance: dir,
        name: dir.constructor.name,
      };
    }),
    element: domNode.nodeName.toLowerCase(),
    nativeElement: domNode,
    hydration: hydrationStatus(domNode),
    defer: null,
    if: null,
  };

  if (!(domNode instanceof Element)) {
    // In case we show the Comment nodes
    result.push(componentTreeNode);
    return result;
  }

  const isDehydratedElement = componentTreeNode.hydration?.status === 'dehydrated';
  const component = getComponent?.(domNode);
  if (component) {
    componentTreeNode.component = {
      instance: component,
      isElement: isCustomElement(domNode),
      name: getDirectiveMetadata?.(component)?.name ?? domNode.nodeName.toLowerCase(),
    };
  }

  const isDisplayableNode = component || componentTreeNode.directives.length || isDehydratedElement;
  if (isDisplayableNode) {
    result.push(componentTreeNode);
  }

  // Nodes that are part of a defer block will be added as children of the defer block
  // and should be skipped from the regular code path
  const nodesToSkip = new Set<Node>();
  const appendTo = isDisplayableNode ? componentTreeNode.children : result;

  domNode.childNodes.forEach((node) => {
    const isDefer = groupDeferChildrenIfNeeded(
      node,
      nodesToSkip,
      appendTo,
      deferBlocks,
      ifBlocks,
      rootId,
      getComponent,
      getDirectives,
      getDirectiveMetadata,
    );

    if (!isDefer) {
      groupIfChildrenIfNeeded(
        node,
        nodesToSkip,
        appendTo,
        deferBlocks,
        ifBlocks,
        rootId,
        getComponent,
        getDirectives,
        getDirectiveMetadata,
      );
    }

    if (!nodesToSkip.has(node)) {
      extractViewTree(
        node,
        appendTo,
        deferBlocks,
        ifBlocks,
        rootId,
        getComponent,
        getDirectives,
        getDirectiveMetadata,
      );
    }
  });

  return result;
};

/**
 * Group Nodes under a defer block if they are part of it.
 *
 * @param node
 * @param nodesToSkip Will mutate the set with the nodes that are grouped into the created deferblock.
 * @param deferBlocks
 * @param appendTo
 * @param getComponent
 * @param getDirectives
 * @param getDirectiveMetadata
 */
function groupDeferChildrenIfNeeded(
  node: Node,
  nodesToSkip: Set<Node>,
  appendTo: ComponentTreeNode[],
  deferBlocks: DeferBlocksIterator,
  ifBlocks: IfBlocksIterator,
  rootId: number,
  getComponent?: FrameworkAgnosticGlobalUtils['getComponent'],
  getDirectives?: FrameworkAgnosticGlobalUtils['getDirectives'],
  getDirectiveMetadata?: FrameworkAgnosticGlobalUtils['getDirectiveMetadata'],
) {
  const currentDeferBlock = deferBlocks.currentBlock;
  const isFirstDeferredChild = node === currentDeferBlock?.rootNodes[0];
  // Handles the case where the @defer is still unresolved but doesn't
  // have a placeholder, for instance, by which children we mark
  // the position of the block normally. In this case, we use the host.
  const isHostNode = node === currentDeferBlock?.hostNode;

  if (isFirstDeferredChild || isHostNode) {
    deferBlocks.advance();

    // When encountering the first child of a defer block (or the host node),
    // we create a synthetic TreeNode representing the defer block.
    const childrenTree: ComponentTreeNode[] = [];
    for (const child of currentDeferBlock.rootNodes) {
      extractViewTree(
        child,
        childrenTree,
        deferBlocks,
        ifBlocks,
        rootId,
        getComponent,
        getDirectives,
        getDirectiveMetadata,
      );
    }

    const deferBlockTreeNode = {
      children: childrenTree,
      component: null,
      directives: [],
      element: '@defer',
      nativeElement: undefined,
      hydration: null,
      defer: {
        id: `deferId-${rootId}-${deferBlocks.currentIndex}`,
        state: currentDeferBlock.state,
        renderedBlock: getRenderedBlock(currentDeferBlock),
        triggers: groupTriggers(currentDeferBlock.triggers),
        blocks: {
          hasErrorBlock: currentDeferBlock.hasErrorBlock,
          placeholderBlock: currentDeferBlock.placeholderBlock,
          loadingBlock: currentDeferBlock.loadingBlock,
        },
      },
      if: null,
    } satisfies ComponentTreeNode;

    currentDeferBlock?.rootNodes.forEach((child) => nodesToSkip.add(child));
    appendTo.push(deferBlockTreeNode);

    return true;
  }

  return false;
}

// Code repetition
function groupIfChildrenIfNeeded(
  node: Node,
  nodesToSkip: Set<Node>,
  appendTo: ComponentTreeNode[],
  deferBlocks: DeferBlocksIterator,
  ifBlocks: IfBlocksIterator,
  rootId: number,
  getComponent?: FrameworkAgnosticGlobalUtils['getComponent'],
  getDirectives?: FrameworkAgnosticGlobalUtils['getDirectives'],
  getDirectiveMetadata?: FrameworkAgnosticGlobalUtils['getDirectiveMetadata'],
) {
  const currentIfBlock = ifBlocks.currentBlock;
  const isFirstIfChild = node === currentIfBlock?.renderedNodes[0];
  // Handles the case where the @defer is still unresolved but doesn't
  // have a placeholder, for instance, by which children we mark
  // the position of the block normally. In this case, we use the host.
  const isHostNode = node === currentIfBlock?.hostNode;

  if (isFirstIfChild || isHostNode) {
    ifBlocks.advance();

    // When encountering the first child of a defer block (or the host node),
    // we create a synthetic TreeNode representing the defer block.
    const childrenTree: ComponentTreeNode[] = [];
    for (const child of currentIfBlock.renderedNodes) {
      extractViewTree(
        child,
        childrenTree,
        deferBlocks,
        ifBlocks,
        rootId,
        getComponent,
        getDirectives,
        getDirectiveMetadata,
      );
    }

    const ifBlockTreeNode = {
      children: childrenTree,
      component: null,
      directives: [],
      element: '@if',
      nativeElement: undefined,
      hydration: null,
      defer: null,
      if: {
        id: `ifId-${rootId}-${ifBlocks.currentIndex}`,
        dummyProp: '',
      },
    } satisfies ComponentTreeNode;

    currentIfBlock?.renderedNodes.forEach((child) => nodesToSkip.add(child));
    appendTo.push(ifBlockTreeNode);

    return true;
  }

  return false;
}

function hydrationStatus(element: Node): HydrationStatus {
  if (!(element instanceof Element)) {
    return null;
  }

  if (!!element.getAttribute('ngh')) {
    return {status: 'dehydrated'};
  }

  const hydrationInfo = (element as HydrationNode).__ngDebugHydrationInfo__;
  switch (hydrationInfo?.status) {
    case 'hydrated':
      return {status: 'hydrated'};
    case 'skipped':
      return {status: 'skipped'};
    case 'mismatched':
      return {
        status: 'mismatched',
        expectedNodeDetails: hydrationInfo.expectedNodeDetails,
        actualNodeDetails: hydrationInfo.actualNodeDetails,
      };
    default:
      return null;
  }
}

function groupTriggers(triggers: string[]) {
  const defer: string[] = [];
  const hydrate: string[] = [];
  const prefetch: string[] = [];

  for (let trigger of triggers) {
    if (trigger.startsWith('hydrate')) {
      hydrate.push(trigger);
    } else if (trigger.startsWith('prefetch')) {
      prefetch.push(trigger);
    } else {
      defer.push(trigger);
    }
  }
  return {defer, hydrate, prefetch};
}

function getRenderedBlock(deferBlock: DeferBlockData): RenderedDeferBlock | null {
  if (['placeholder', 'loading', 'error'].includes(deferBlock.state)) {
    return deferBlock.state as 'placeholder' | 'loading' | 'error';
  }
  if (deferBlock.state === 'complete') {
    return 'defer';
  }
  return null;
}

export class RTreeStrategy {
  supports(): boolean {
    return (['getDirectiveMetadata', 'getComponent'] as const).every(
      (method) => typeof ngDebugClient()[method] === 'function',
    );
  }

  build(element: Element, rootId: number = 0): ComponentTreeNode[] {
    const ng = ngDebugClient();
    const deferBlocks = ng.ɵgetDeferBlocks?.(element) ?? [];

    // New
    const ifBlocks = ng.ɵgetIfBlocks?.(element) ?? [];
    // console.log('IF_BLOCKS', ifBlocks);
    // console.log('DEFER_BLOCKS', deferBlocks);

    return extractViewTree(
      element,
      [],
      new DeferBlocksIterator(deferBlocks),
      // New
      new IfBlocksIterator(ifBlocks),
      rootId,
      ng.getComponent,
      ng.getDirectives,
      ng.getDirectiveMetadata,
    );
  }
}

// Code repetition
class IfBlocksIterator {
  public currentIndex = 0;
  private blocks: IfBlockData[] = [];
  constructor(blocks: IfBlockData[]) {
    this.blocks = blocks;
  }

  advance() {
    this.currentIndex++;
  }

  get currentBlock(): IfBlockData | undefined {
    return this.blocks[this.currentIndex];
  }
}

class DeferBlocksIterator {
  public currentIndex = 0;
  private blocks: DeferBlockData[] = [];
  constructor(blocks: DeferBlockData[]) {
    this.blocks = blocks;
  }

  advance() {
    this.currentIndex++;
  }

  get currentBlock(): DeferBlockData | undefined {
    return this.blocks[this.currentIndex];
  }
}
