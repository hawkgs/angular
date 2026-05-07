/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  ɵFrameworkAgnosticGlobalUtils as FrameworkAgnosticGlobalUtils,
  ɵHydratedNode as HydrationNode,
} from '@angular/core';
import {HydrationStatus} from '../../../../protocol';

import {ComponentTreeNode} from '../interfaces';
import {ngDebugClient} from '../ng-debug-api/ng-debug-api';
import {isCustomElement} from '../utils/general';
import {
  ControlFlowBlocksIterator,
  createControlFlowTreeNode,
  isControlFlowBlock,
} from './control-flow';

interface TreeExtractionContext {
  blocksIterator: ControlFlowBlocksIterator;
  rootId: number;
  getComponent?: FrameworkAgnosticGlobalUtils['getComponent'];
  getDirectives?: FrameworkAgnosticGlobalUtils['getDirectives'];
  getDirectiveMetadata?: FrameworkAgnosticGlobalUtils['getDirectiveMetadata'];
}

function extractViewTree(
  node: Node | Element,
  result: ComponentTreeNode[],
  ctx: TreeExtractionContext,
  nodesToSkip = new Set<Node>(),
): void {
  // Ignore DOM Node if it came from a different frame. Use instanceof Node to check this.
  if (!(node instanceof Node)) {
    return;
  }

  if (isControlFlowBlock(node, ctx.blocksIterator)) {
    groupControlFlowBlocksChildren(ctx, result, nodesToSkip);
    return;
  }

  const directives = ctx.getDirectives?.(node) ?? [];
  if (!directives.length && !(node instanceof Element)) {
    return;
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
    tagName: domNode.nodeName.toLowerCase(),
    nativeElement: domNode,
    hydration: hydrationStatus(domNode),
    static: false,
    controlFlowBlock: null,
  };

  if (!(node instanceof Element)) {
    // In case we show the Comment nodes
    result.push(componentTreeNode);
    return;
  }

  const isDehydratedElement = componentTreeNode.hydration?.status === 'dehydrated';
  const component = ctx.getComponent?.(node);
  if (component) {
    componentTreeNode.component = {
      instance: component,
      isElement: isCustomElement(node),
      name: ctx.getDirectiveMetadata?.(component)?.name ?? node.nodeName.toLowerCase(),
    };
  }

  const isDisplayableNode =
    component || componentTreeNode.directives?.length || isDehydratedElement;
  if (isDisplayableNode) {
    result.push(componentTreeNode);
  }

  const childrenResult = isDisplayableNode ? componentTreeNode.children : result;

  for (const child of node.childNodes) {
    if (!nodesToSkip.has(child)) {
      extractViewTree(child, childrenResult, ctx, nodesToSkip);
    }
  }
}

/**
 * Groups nodes under a @defer block if the given node is the first child of one.
 * @returns true if a defer block was created, false otherwise.
 */
function groupControlFlowBlocksChildren(
  ctx: TreeExtractionContext,
  result: ComponentTreeNode[],
  nodesToSkip: Set<Node>,
) {
  const currentBlock = ctx.blocksIterator.currentBlock;
  if (!currentBlock) {
    throw new Error('There is no current block in the control flow block iterator.');
  }

  ctx.blocksIterator.advance();
  // It's important to store the here index before the recursive call.
  const iteratorCurrentIdx = ctx.blocksIterator.currentIndex;

  const childrenTree: ComponentTreeNode[] = [];
  // Extract children
  for (const child of currentBlock.rootNodes) {
    if (!nodesToSkip.has(child)) {
      extractViewTree(child, childrenTree, ctx, nodesToSkip);
    }
  }

  // If the there isn't a children tree (i.e. child components)
  // but the block has root nodes, we create a static node that
  // informs the user that the control flow block
  // has HTML-only content.
  if (!childrenTree.length && currentBlock.rootNodes.length) {
    childrenTree.push({
      element: '<html_content>',
      static: true,
      controlFlowBlock: null,
      component: null,
      children: [],
    });
  }

  const blockTreeNode = createControlFlowTreeNode(
    currentBlock,
    childrenTree,
    iteratorCurrentIdx,
    ctx.rootId,
  );

  for (const child of currentBlock.rootNodes) {
    nodesToSkip.add(child);
  }
  result.push(blockTreeNode);
}

function hydrationStatus(element: Node): HydrationStatus | undefined {
  if (!(element instanceof Element)) {
    return undefined;
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
      return undefined;
  }
}

export class RTreeStrategy {
  supports(): boolean {
    return (['getDirectiveMetadata', 'getComponent'] as const).every(
      (method) => typeof ngDebugClient()[method] === 'function',
    );
  }

  build(element: Element, rootId: number = 0): ComponentTreeNode[] {
    const ng = ngDebugClient();
    const controlFlowBlocks = ng.ɵgetControlFlowBlocks?.(element) ?? [];
    const ctx: TreeExtractionContext = {
      blocksIterator: new ControlFlowBlocksIterator(controlFlowBlocks),
      rootId,
      getComponent: ng.getComponent,
      getDirectives: ng.getDirectives,
      getDirectiveMetadata: ng.getDirectiveMetadata,
    };

    const tree: ComponentTreeNode[] = [];
    extractViewTree(element, tree, ctx);

    return tree;
  }
}
