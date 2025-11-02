export interface OverpassResponse {
  version: number;
  generator: string;
  elements: Element[];
}

export interface Element {
  type: "node" | "way" | "relation";
  id: number;
  tags?: Record<string, string>;
  geometry?: Point[];
  nodes?: number[];
}

export interface Point {
  lat: number;
  lon: number;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  edges: Edge[];
}

export interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  edges: Edge[];
}

export interface Edge {
  id: string;
  from: string;
  to: string;
  way: Way;
  weight: number;
  highlighted: boolean;
}

export interface Way {
  id: number;
  tags: Record<string, string>;
  geometry: Point[];
}

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface VisualizationState {
  graph: Graph | null;
  buildings: Element[];
  highlightedEdges: Set<string>;
  visitedNodes: Set<string>;
  algorithmRunning: boolean;
}
