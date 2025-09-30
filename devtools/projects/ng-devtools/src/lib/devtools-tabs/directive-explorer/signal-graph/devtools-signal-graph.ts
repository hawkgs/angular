/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DebugSignalGraph} from '../../../../../../protocol';
import {DevtoolsGroupNodeType, DevtoolsSignalGraph} from './signal-graph-types';

let GROUP_IDX = 0;

interface Group {
  id: string;
  type: DevtoolsGroupNodeType;
  nodes: Set<string>;
  consumers: Set<number>;
  name: string;
}

type GroupIdentifier = (nodes: DebugSignalGraph) => Group[];

const resourceGroupIdentifier: GroupIdentifier = (graph) => {
  const groups: Map<string, Group> = new Map();

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const match = node.label?.match(/Resource#([\w]+).[\w]+/);
    if (!match) {
      continue;
    }

    const name = match[1];
    let group = groups.get(name);
    if (!group) {
      group = {
        id: `g${GROUP_IDX++}`,
        type: 'resource',
        name,
        consumers: new Set(),
        nodes: new Set(),
      };
      groups.set(name, group);
    }

    group.nodes.add(node.id);
    for (const edge of graph.edges) {
      if (edge.producer === i) {
        group.consumers.add(edge.consumer);
      }
    }
  }

  return [...groups].map(([, group]) => group);
};

const GROUP_IDENTIFIERS: GroupIdentifier[] = [resourceGroupIdentifier];

export function convertToDevtoolsSignalGraph(
  debugSignalGraph: DebugSignalGraph,
): DevtoolsSignalGraph {
  const signalGraph: DevtoolsSignalGraph = {
    nodes: [],
    edges: [],
  };

  // Identify groups
  let groups: Group[] = [];
  for (const identifier of GROUP_IDENTIFIERS) {
    groups = groups.concat(identifier(debugSignalGraph));
  }

  console.log('groups', groups);

  // Map nodes
  signalGraph.nodes = debugSignalGraph.nodes.map((n) => {
    const group = groups.find((g) => g.nodes.has(n.id));

    return {
      ...n,
      nodeType: 'signal',
      groupId: group ? group.id : undefined,
    };
  });

  // Set edges
  signalGraph.edges = [...debugSignalGraph.edges];

  // Add group nodes and edges
  for (const group of groups) {
    signalGraph.nodes.push({
      id: group.id,
      nodeType: 'group',
      groupType: group.type,
      label: group.name,
    });

    const groupIdx = groups.length - 1;

    for (const consumerIdx of group.consumers) {
      signalGraph.edges.push({
        producer: groupIdx,
        consumer: consumerIdx,
      });
    }
  }

  return signalGraph;
}
