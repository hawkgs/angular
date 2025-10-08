/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DebugSignalGraphNode} from '../../../../../../protocol';
import {DevtoolsGroupNode, DevtoolsSignalNode, DevtoolsSignalGraphNode} from './signal-graph-types';

export function isGroupNode(node: DevtoolsSignalGraphNode): node is DevtoolsGroupNode {
  return node.nodeType === 'group';
}

export function isSignalNode(node: DevtoolsSignalGraphNode): node is DevtoolsSignalNode {
  return node.nodeType === 'signal';
}

/**
 * Checks whether a `DebugSignalGraphNode` is part of a group
 * and returns the the group and signal names, if it's affirmative.
 */
export function checkResourceGroupMatch(n: DebugSignalGraphNode): {
  groupName: string;
  signalName: string;
} | null {
  const match = n.label?.match(/Resource#([\w]+).([\w]+)/);
  if (!match) {
    return null;
  }
  return {
    groupName: match[1],
    signalName: match[2],
  };
}
