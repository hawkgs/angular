/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DebugSignalGraphEdge, DebugSignalGraphNode} from '../../../../../../protocol';

export type DevtoolsGroupNodeType = 'resource';

export interface DevtoolsSignalNode extends DebugSignalGraphNode {
  /**
   * Represents whether the node is an actual signal node or a synthetic group node.
   */
  nodeType: 'signal';

  /**
   * Represent the group ID that the node is part of.
   */
  groupId?: string;
}

export interface DevtoolsGroupNode {
  /**
   * Represents whether the node is an actual signal node or a synthetic group node.
   */
  nodeType: 'group';

  /**
   * Represents the group type (e.g. `resource`).
   */
  groupType: DevtoolsGroupNodeType;

  /** Group ID. */
  id: string;

  /** Group label (e.g. `resource` name). */
  label: string;
}

export type DevtoolsSignalGraphNode = DevtoolsSignalNode | DevtoolsGroupNode;

export interface DevtoolsSignalGraphEdge extends DebugSignalGraphEdge {}

export interface DevtoolsSignalGraphGroup {
  id: string;
  name: string;
}

/**
 * Represents a DevTools-FE-specific signal graph that extends
 * the `DebugSignalGraph` with synthetic group nodes.
 */
export interface DevtoolsSignalGraph {
  nodes: DevtoolsSignalGraphNode[];
  edges: DevtoolsSignalGraphEdge[];
  groups: DevtoolsSignalGraphGroup[];
}
