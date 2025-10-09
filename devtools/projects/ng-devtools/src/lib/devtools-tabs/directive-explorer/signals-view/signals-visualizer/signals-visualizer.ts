/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import * as d3 from 'd3';
import {graphlib, render as dagreRender} from 'dagre-d3-es';
import {
  isClusterNode,
  isSignalNode,
  DevtoolsSignalGraph,
  DevtoolsSignalGraphNode,
  DevtoolsClusterNodeType,
} from '../../signal-graph';
import {DagreGraph, DagreGraphNode} from './dagre-d3-types';
import {DebugSignalGraphNode} from '../../../../../../../protocol';

const KIND_CLASS_MAP: {[key in DebugSignalGraphNode['kind'] & 'resource']: string} = {
  'signal': 'kind-signal',
  'computed': 'kind-computed',
  'effect': 'kind-effect',
  'afterRenderEffectPhase': 'kind-effect',
  'template': 'kind-template',
  'linkedSignal': 'kind-linked-signal',
  'unknown': 'kind-unknown',
  'resource': 'kind-resource',
};

const CLUSTER_TYPE_CLASS_MAP: {[key in DevtoolsClusterNodeType]: string} = {
  'resource': 'resource-child',
};

const NODE_CLASS = 'node-label';
const CLUSTER_CLASS = 'cluster';
const EDGE_CLASS = 'edge';

// Terminology:
//
// - `DevtoolsSignalGraph` – The input graph that the visualizer accepts
// - `DevtoolsSignalGraphNode` – A node of the input graph
// - Standard signal node – A visualized standard node
// - Standard cluster node – A cluster node, visualized as a standard node (i.e. collapsed)
// - Expanded cluster node – A cluster node, visualized as a container of its child nodes (i.e. expanded)
export class SignalsGraphVisualizer {
  private graph: DagreGraph;
  private drender: ReturnType<typeof dagreRender>;

  zoomController: d3.ZoomBehavior<SVGSVGElement, unknown>;

  private animationMap: Map<string, number> = new Map();
  private timeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  private nodeClickListeners: ((node: DevtoolsSignalGraphNode) => void)[] = [];
  private clustersStateChangeListeners: ((expandedClustersIds: Set<string>) => void)[] = [];
  private expandedClustersIds = new Set<string>();
  private inputGraph: DevtoolsSignalGraph | null = null;

  constructor(private svg: SVGSVGElement) {
    this.graph = new graphlib.Graph({directed: true, compound: true});
    this.graph.setGraph({});
    this.graph.graph().rankdir = 'TB';
    this.graph.graph().ranksep = 50;
    this.graph.graph().nodesep = 5;

    this.graph.setDefaultEdgeLabel(() => ({}));

    this.drender = dagreRender();

    const d3svg = d3.select(this.svg);
    d3svg.attr('height', '100%').attr('width', '100%');
    this.resize();

    const g = d3svg.append('g');

    this.zoomController = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 2]);
    this.zoomController.on('start zoom end', (e: {transform: number}) => {
      g.attr('transform', e.transform);
    });

    d3svg.call(this.zoomController);
  }

  setSelected(selected: string | null) {
    d3.select(this.svg)
      .select('.output .nodes')
      .selectAll<SVGGElement, string>('g.node')
      .classed('selected', (d) => d === selected);
  }

  zoomScale(scale: number) {
    if (this.zoomController) {
      const svg = d3.select(this.svg);
      this.zoomController.scaleTo(svg, scale);
    }
  }

  cleanup(): void {
    for (const timeout of this.timeouts) {
      clearTimeout(timeout);
    }
  }

  updateNodeAnimations(updatedNodes: string[], timeout: ReturnType<typeof setTimeout>) {
    this.timeouts.delete(timeout);

    for (const id of updatedNodes) {
      const count = this.animationMap.get(id) ?? 0;
      if (count > 0) {
        this.animationMap.set(id, count - 1);
      }
    }

    d3.select(this.svg)
      .select('.output .nodes')
      .selectAll<SVGGElement, string>('g.node')
      .select('.label foreignObject .node-label')
      .filter((d) => !this.animationMap.get(d))
      .classed('animating', false);
  }

  reset() {
    for (const node of this.graph.nodes()) {
      this.graph.removeNode(node);
    }
    for (const {v, w} of this.graph.edges()) {
      this.graph.removeEdge(v, w, null);
    }
    this.animationMap.clear();
    this.expandedClustersIds.clear();
    this.notifyForClusterVisibilityUpdate();
    this.cleanup();
    this.timeouts.clear();
  }

  render(signalGraph: DevtoolsSignalGraph): void {
    this.updateClusters(signalGraph);
    this.updateNodes(signalGraph);
    this.updateEdges(signalGraph);

    const g = d3.select(this.svg).select('g');

    this.drender(g, this.graph);

    // if there are no nodes, we reset the transform to 0
    const {width, height} = this.graph.graph();
    const xTransform = isFinite(width) ? -width / 2 : 0;
    const yTransform = isFinite(height) ? -height / 2 : 0;
    g.select('.output').attr('transform', `translate(${xTransform}, ${yTransform})`);

    this.inputGraph = signalGraph;
  }

  resize() {
    const svg = d3.select(this.svg);
    svg.attr('viewBox', [
      -this.svg.clientWidth / 2,
      -this.svg.clientHeight / 2,
      this.svg.clientWidth,
      this.svg.clientHeight,
    ]);
  }

  setClusterState(clusterId: string, expanded: boolean) {
    if (!this.inputGraph) {
      return;
    }

    if (expanded) {
      this.expandedClustersIds.add(clusterId);
    } else {
      this.expandedClustersIds.delete(clusterId);
    }

    this.notifyForClusterVisibilityUpdate();
    this.render(this.inputGraph);
  }

  /**
   * Listen for node clicks.
   *
   * @param cb Callback/listener
   * @returns An unlisten function
   */
  onNodeClick(cb: (node: DevtoolsSignalGraphNode) => void): () => void {
    this.nodeClickListeners.push(cb);

    return () => {
      const idx = this.nodeClickListeners.indexOf(cb);
      if (idx > -1) {
        this.nodeClickListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Listen for cluster state changes.
   *
   * @param cb Callback/listener
   * @returns An unlisten function
   */
  onClustersStateChange(cb: (expandedClustersIds: Set<string>) => void): () => void {
    this.clustersStateChangeListeners.push(cb);

    return () => {
      const idx = this.clustersStateChangeListeners.indexOf(cb);
      if (idx > -1) {
        this.clustersStateChangeListeners.splice(idx, 1);
      }
    };
  }

  private isNodeVisible(node: DevtoolsSignalGraphNode): boolean {
    // Checks whether it's a:
    // 1. Standard signal node that's not part of a cluster
    // 2. Standard signal node that's part of an expanded cluster
    // 3. Standard cluster node that represents a currently collapsed cluster
    return (
      (isSignalNode(node) && (!node.clusterId || this.expandedClustersIds.has(node.clusterId))) ||
      (isClusterNode(node) && !this.expandedClustersIds.has(node.id))
    );
  }

  private updateClusters(signalGraph: DevtoolsSignalGraph) {
    const newClusterIds = new Set<string>();

    for (const clusterId of Object.keys(signalGraph.clusters)) {
      newClusterIds.add(clusterId);
    }

    let clustersUpdated = false;

    for (const clusterId of this.expandedClustersIds) {
      if (!newClusterIds.has(clusterId)) {
        // Hide cluster that should be collapsed
        this.expandedClustersIds.delete(clusterId);
        this.graph.removeNode(clusterId);
        clustersUpdated = true;
      } else {
        // Render the new cluster as an expanded cluster node
        this.graph.setNode(clusterId, {
          label: signalGraph.clusters[clusterId].name,
          class: CLUSTER_CLASS,
          clusterLabelPos: 'top',
        });
      }
    }

    if (clustersUpdated) {
      this.notifyForClusterVisibilityUpdate();
    }
  }

  private updateNodes(signalGraph: DevtoolsSignalGraph) {
    let matchedNodeId = false;
    const signalNodes = convertNodesToMap(signalGraph.nodes);

    for (const oldNodeId of this.graph.nodes()) {
      const node = signalNodes.get(oldNodeId);

      // To avoid removing an expanded cluster node, we have to check if `isSignalNode`.
      if (!node || (!this.isNodeVisible(node) && isSignalNode(node))) {
        this.graph.removeNode(oldNodeId);
        this.animationMap.delete(oldNodeId);
      } else {
        matchedNodeId = true;
      }
    }

    const updatedNodes: string[] = [];

    for (const n of signalGraph.nodes) {
      const isSignal = isSignalNode(n);
      let existingNode = this.graph.node(n.id);

      if (existingNode && isSignal) {
        existingNode = existingNode as DagreGraphNode;

        if (n.epoch !== existingNode.epoch) {
          updatedNodes.push(n.id);
          const count = this.animationMap.get(n.id) ?? 0;
          this.animationMap.set(n.id, count + 1);
          existingNode.epoch = n.epoch;
          d3.select(existingNode.label).classed('animating', true);
          const body = existingNode.label.getElementsByClassName('body').item(0);
          if (body) {
            body.textContent = getBodyText(n);
          }
        }
      } else if (this.isNodeVisible(n)) {
        this.graph.setNode(n.id, {
          label: this.createNode(n, signalGraph),
          labelType: 'html',
          shape: 'rect',
          padding: 0,
          style: 'fill: none;',
          epoch: isSignal ? n.epoch : undefined,
        });
        // Add to the expanded cluster node, if the node is part of a visible cluster
        if (isSignal && this.expandedClustersIds.has(n.clusterId || '')) {
          this.graph.setParent(n.id, n.clusterId);
        }
      }
    }

    const timeout = setTimeout(() => {
      this.updateNodeAnimations(updatedNodes, timeout);
    }, 250);
    this.timeouts.add(timeout);

    if (matchedNodeId) {
      this.graph.graph().transition = (selection: any) => {
        return selection.transition().duration(500);
      };
    } else {
      this.graph.graph().transition = undefined;
    }
  }

  private updateEdges(signalGraph: DevtoolsSignalGraph) {
    const newEdgeIds = new Set();

    for (const edge of signalGraph.edges) {
      const producerNode = signalGraph.nodes[edge.producer];
      const consumerNode = signalGraph.nodes[edge.consumer];
      const producerId = producerNode.id;
      const consumerId = consumerNode.id;

      const edgeId = getEdgeId(producerId, consumerId);
      newEdgeIds.add(edgeId);

      if (
        !this.graph.hasEdge(producerId, consumerId, undefined) &&
        this.isNodeVisible(producerNode) &&
        this.isNodeVisible(consumerNode)
      ) {
        this.graph.setEdge(producerId, consumerId, {
          curve: d3.curveBasis,
          class: EDGE_CLASS,
        });
      }
    }

    const signalNodes = convertNodesToMap(signalGraph.nodes);

    for (const edge of this.graph.edges()) {
      const edgeId = getEdgeId(edge.v, edge.w);

      if (
        !newEdgeIds.has(edgeId) ||
        !this.isNodeVisible(signalNodes.get(edge.v)!) ||
        !this.isNodeVisible(signalNodes.get(edge.w)!)
      ) {
        this.graph.removeEdge(edge.v, edge.w, undefined);
      }
    }
  }

  private notifyForClusterVisibilityUpdate() {
    for (const cb of this.clustersStateChangeListeners) {
      cb(new Set(this.expandedClustersIds));
    }
  }

  private createNode(node: DevtoolsSignalGraphNode, graph: DevtoolsSignalGraph): HTMLDivElement {
    const outer = document.createElement('div');
    if (isSignalNode(node)) {
      outer.onclick = () => {
        for (const cb of this.nodeClickListeners) {
          cb(node);
        }
      };
    } else if (isClusterNode(node)) {
      outer.onclick = () => this.setClusterState(node.id, true);
    }
    outer.className = `${NODE_CLASS} ${KIND_CLASS_MAP[isSignalNode(node) ? node.kind : node.clusterType]}`;

    const header = document.createElement('div');

    let label = node.label ?? null;
    if (isSignalNode(node)) {
      if (!label) {
        label = node.kind === 'effect' ? 'Effect' : 'Unnamed';
        header.classList.add('special');
      } else {
        const hashIdx = label.indexOf('.');
        if (hashIdx > -1) {
          label = label.substring(hashIdx + 1, label.length);
        }
      }

      if (node.clusterId) {
        outer.classList.add('cluster-child');
        const clusterType = graph.clusters[node.clusterId].type;
        outer.classList.add(CLUSTER_TYPE_CLASS_MAP[clusterType]);
      }
    }

    header.classList.add('header');
    header.textContent = label;

    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = getBodyText(node);

    outer.appendChild(header);
    outer.appendChild(body);

    return outer;
  }
}

function getBodyText(node: DevtoolsSignalGraphNode): string {
  if (isClusterNode(node)) {
    return '[nodes]';
  }

  if (node.kind === 'signal' || node.kind === 'computed' || node.kind === 'linkedSignal') {
    return node.preview.preview;
  }

  if (node.kind === 'template') {
    return '</>';
  }

  if (node.kind === 'effect') {
    return '() => {}';
  }

  return '';
}

function getEdgeId(producerId: string, consumerId: string): string {
  return `${btoa(producerId)}-${btoa(consumerId)}`;
}

function convertNodesToMap(nodes: DevtoolsSignalGraphNode[]): Map<string, DevtoolsSignalGraphNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}
