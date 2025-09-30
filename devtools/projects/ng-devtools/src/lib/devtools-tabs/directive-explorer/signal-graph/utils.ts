/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DevtoolsGroupNode, DevtoolsSignalNode, DevtoolsSignalGraphNode} from './signal-graph-types';

export function isGroupNode(node: DevtoolsSignalGraphNode): node is DevtoolsGroupNode {
  return node.nodeType === 'group';
}

export function isSignalNode(node: DevtoolsSignalGraphNode): node is DevtoolsSignalNode {
  return node.nodeType === 'signal';
}
