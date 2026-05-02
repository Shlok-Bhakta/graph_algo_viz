import type { Edge, Graph, GraphNode } from '../types';
import type { AlgorithmGenerator, AlgorithmStep } from '../algos/types';

export function makeWeightedGraph(): Graph {
  const graph: Graph = {
    nodes: new Map(),
    edges: []
  };

  const addNode = (id: string, lat = 0, lon = 0): GraphNode => {
    const node: GraphNode = { id, lat, lon, edges: [] };
    graph.nodes.set(id, node);
    return node;
  };

  addNode('A', 0, 0);
  addNode('B', 0, 0);
  addNode('C', 0, 0);
  addNode('D', 0, 0);

  const addDirectedEdge = (from: string, to: string, weight: number): Edge => {
    const edge: Edge = {
      id: `${from}->${to}`,
      from,
      to,
      weight,
      highlighted: false,
      way: {
        id: graph.edges.length + 1,
        tags: {},
        geometry: [
          { lat: graph.nodes.get(from)!.lat, lon: graph.nodes.get(from)!.lon },
          { lat: graph.nodes.get(to)!.lat, lon: graph.nodes.get(to)!.lon }
        ]
      }
    };

    graph.edges.push(edge);
    graph.nodes.get(from)!.edges.push(edge);
    return edge;
  };

  const addUndirectedEdge = (from: string, to: string, weight: number) => {
    addDirectedEdge(from, to, weight);
    addDirectedEdge(to, from, weight);
  };

  addUndirectedEdge('A', 'B', 1);
  addUndirectedEdge('B', 'C', 2);
  addUndirectedEdge('A', 'C', 5);
  addUndirectedEdge('C', 'D', 1);
  addUndirectedEdge('B', 'D', 4);

  return graph;
}

export async function collectGenerator(
  generator: ReturnType<AlgorithmGenerator>
): Promise<{ yields: AlgorithmStep[]; returned: AlgorithmStep }> {
  const yields: AlgorithmStep[] = [];

  while (true) {
    const next = await generator.next();
    if (next.done) {
      return { yields, returned: next.value };
    }
    yields.push(next.value);
  }
}
