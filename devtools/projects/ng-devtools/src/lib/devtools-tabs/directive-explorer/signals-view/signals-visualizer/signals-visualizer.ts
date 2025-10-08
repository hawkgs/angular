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
import {DebugSignalGraphNode} from '../../../../../../../protocol';

// Non-exhaustive; Alter based on Dagre D3 docs if required
interface DagreGraphNode {
  label: HTMLDivElement;
  labelType: string;
  shape: string;
  padding: number;
  style: string;
  epoch?: number;
  rx: number;
  ry: number;
}

// Non-exhaustive; Alter based on Dagre D3 docs if required
interface DagreGraphEdge {
  curve: any;
  style: string;
  arrowheadStyle: string;
}

// Improve Graphlib types
declare class DagreGraph extends graphlib.Graph {
  override setNode(id: string, value: DagreGraphNode, ...args: any[]): this;
  override setEdge(producerId: string, consumerId: string, value: DagreGraphEdge): this;
  override node(id: string): DagreGraphNode;
  override edges(): {v: string; w: string}[];
}

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

export class SignalsGraphVisualizer {
  private graph: DagreGraph;
  private drender: ReturnType<typeof dagreRender>;

  zoomController: d3.ZoomBehavior<SVGSVGElement, unknown>;

  private animationMap: Map<string, number> = new Map();
  private timeouts: Set<ReturnType<typeof setTimeout>> = new Set();
  private nodeClickListeners: ((node: DevtoolsSignalGraphNode) => void)[] = [];
  private clustersVisibilityChangeListeners: ((visibleClustersIds: Set<string>) => void)[] = [];
  private visibleClustersIds = new Set<string>();
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
    this.visibleClustersIds.clear();
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

  setClusterVisibility(clusterId: string, visible: boolean) {
    if (!this.inputGraph) {
      return;
    }

    if (visible) {
      this.visibleClustersIds.add(clusterId);
    } else {
      this.visibleClustersIds.delete(clusterId);
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
   * Listen for cluster visibility changes.
   *
   * @param cb Callback/listener
   * @returns An unlisten function
   */
  onClustersVisibilityChange(cb: (visibleClustersIds: Set<string>) => void): () => void {
    this.clustersVisibilityChangeListeners.push(cb);

    return () => {
      const idx = this.clustersVisibilityChangeListeners.indexOf(cb);
      if (idx > -1) {
        this.clustersVisibilityChangeListeners.splice(idx, 1);
      }
    };
  }

  private isNodeVisible(node: DevtoolsSignalGraphNode): boolean {
    // Checks whether it's a:
    // 1. Standard node that's not part of a cluster
    // 2. Standard node that's part of a visible cluster
    // 3. Cluster node that represents a currently hidden cluster
    return (
      (isSignalNode(node) && (!node.clusterId || this.visibleClustersIds.has(node.clusterId))) ||
      (isClusterNode(node) && !this.visibleClustersIds.has(node.id))
    );
  }

  private updateClusters(signalGraph: DevtoolsSignalGraph) {
    const newClusterIds = new Set<string>();

    for (const clusterId of Object.keys(signalGraph.clusters)) {
      newClusterIds.add(clusterId);
    }

    let clustersUpdated = false;

    for (const clusterId of this.visibleClustersIds) {
      if (!newClusterIds.has(clusterId)) {
        this.visibleClustersIds.delete(clusterId);
        clustersUpdated = true;
      }
    }

    if (clustersUpdated) {
      this.notifyForClusterVisibilityUpdate();
    }
  }

  private updateNodes(signalGraph: DevtoolsSignalGraph) {
    let matchedNodeId = false;
    for (const oldNodeId of this.graph.nodes()) {
      const node = signalGraph.nodes.find((n) => n.id === oldNodeId);

      if (!node || !this.isNodeVisible(node)) {
        this.graph.removeNode(oldNodeId);
        this.animationMap.delete(oldNodeId);
      } else {
        matchedNodeId = true;
      }
    }

    const updatedNodes: string[] = [];

    for (const n of signalGraph.nodes) {
      const isSignal = isSignalNode(n);
      const existingNode = this.graph.node(n.id);

      if (existingNode && isSignal) {
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
          rx: 8,
          ry: 8,
        });
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
      const producerId = producerNode.id;
      const consumerId = signalGraph.nodes[edge.consumer].id;

      const edgeId = getEdgeId(producerId, consumerId);
      newEdgeIds.add(edgeId);

      if (
        !this.graph.hasEdge(producerId, consumerId, undefined) &&
        this.isNodeVisible(producerNode)
      ) {
        this.graph.setEdge(producerId, consumerId, {
          curve: d3.curveBasis,
          style: 'stroke: gray; fill:none; stroke-width: 1px; stroke-dasharray: 5, 5;',
          arrowheadStyle: 'fill: gray',
        });
      }
    }

    for (const edge of this.graph.edges()) {
      if (!newEdgeIds.has(getEdgeId(edge.v, edge.w))) {
        this.graph.removeEdge(edge.v, edge.w, undefined);
      }
    }
  }

  private notifyForClusterVisibilityUpdate() {
    for (const cb of this.clustersVisibilityChangeListeners) {
      cb(new Set(this.visibleClustersIds));
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
      outer.onclick = () => this.setClusterVisibility(node.id, true);
    }
    outer.className = `node-label ${KIND_CLASS_MAP[isSignalNode(node) ? node.kind : node.clusterType]}`;

    const header = document.createElement('div');

    let label = node.label ?? null;
    if (isSignalNode(node)) {
      if (!label) {
        label = node.kind === 'effect' ? 'Effect' : 'Unnamed';
        header.classList.add('special');
      } else {
        const hashIdx = label.indexOf('#');
        if (hashIdx > -1) {
          label = label.substring(hashIdx + 1, label.length);
        }
      }

      if (node.clusterId) {
        outer.classList.add('cluster-node');
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
