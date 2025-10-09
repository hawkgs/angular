import {graphlib} from 'dagre-d3-es';

// Non-exhaustive; Alter based on Dagre D3 docs if required
export interface DagreGraphNode {
  label: HTMLDivElement;
  labelType: string;
  shape: string;
  padding: number;
  style?: string;
  epoch?: number;
}

// Non-exhaustive; Alter based on Dagre D3 docs if required
export interface DagreGraphCluster {
  label: string;
  clusterLabelPos: string;
  class?: string;
  style?: string;
}

// Non-exhaustive; Alter based on Dagre D3 docs if required
export interface DagreGraphEdge {
  curve: any;
  style?: string;
  arrowheadStyle?: string;
  class?: string;
}

// Improve Graphlib types
export declare class DagreGraph extends graphlib.Graph {
  override setNode(id: string, value: DagreGraphNode | DagreGraphCluster, ...args: any[]): this;
  override setEdge(producerId: string, consumerId: string, value: DagreGraphEdge): this;
  override node(id: string): DagreGraphNode | DagreGraphCluster;
  override edges(): {v: string; w: string}[];
}
