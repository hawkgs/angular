/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {DebugSignalGraph, DebugSignalGraphNode} from '../../../../../../protocol';
import {DevtoolsGroupNodeType, DevtoolsSignalGraph} from './signal-graph-types';

let GROUP_IDX = 0;

interface Group {
  id: string;
  type: DevtoolsGroupNodeType;
  nodes: Set<string>;
  producers: Set<number>;
  consumers: Set<number>;
  name: string;
}

type GroupIdentifier = (nodes: DebugSignalGraph) => Group[];

const resourceGroupIdentifier: GroupIdentifier = (graph) => {
  const groups: Map<string, Group> = new Map();

  const checkResourceGroupMatch = (n: DebugSignalGraphNode) =>
    n.label?.match(/Resource#([\w]+).[\w]+/);
  const isNodePartOfGroup = (n: DebugSignalGraphNode, name: string) => {
    const match = checkResourceGroupMatch(n);
    return match && match[1] === name;
  };

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const match = checkResourceGroupMatch(node);
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
        producers: new Set(),
        nodes: new Set(),
      };
      groups.set(name, group);
    }

    group.nodes.add(node.id);

    for (const edge of graph.edges) {
      // Note that we have to make sure that the consumer is not part of the
      // same group since we'll end up with a circular dependency.
      if (edge.producer === i && !isNodePartOfGroup(graph.nodes[edge.consumer], name)) {
        group.consumers.add(edge.consumer);
      }

      // Same for producers
      if (edge.consumer === i && !isNodePartOfGroup(graph.nodes[edge.producer], name)) {
        group.producers.add(edge.producer);
      }
    }
  }

  return [...groups].map(([, group]) => group);
};

const GROUP_IDENTIFIERS: GroupIdentifier[] = [resourceGroupIdentifier];

/**
 * Convert a `DebugSignalGraph` to a DevTools-FE specific `DevtoolsSignalGraph`.
 */
export function convertToDevtoolsSignalGraph(
  debugSignalGraph: DebugSignalGraph,
): DevtoolsSignalGraph {
  const signalGraph: DevtoolsSignalGraph = {
    nodes: [],
    edges: [],
    groups: [],
  };

  // Identify groups
  let groups: Group[] = [];
  for (const identifier of GROUP_IDENTIFIERS) {
    groups = groups.concat(identifier(debugSignalGraph));
  }

  // Add group IDs
  signalGraph.groups = groups.map((g) => g.id);

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

    // Start from the last node index
    const groupIdx = signalGraph.nodes.length - 1;

    for (const consumerIdx of group.consumers) {
      signalGraph.edges.push({
        producer: groupIdx,
        consumer: consumerIdx,
      });
    }

    for (const producerIdx of group.producers) {
      signalGraph.edges.push({
        producer: producerIdx,
        consumer: groupIdx,
      });
    }
  }

  return signalGraph;
}
