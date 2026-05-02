import type { Graph, GraphNode } from '../types';
import type { AlgorithmStep } from './types';

export async function* bfs(
  graph: Graph,
  options?: { source?: string; delayMs?: number }
): AsyncGenerator<AlgorithmStep, AlgorithmStep> {
  const delayMs = options?.delayMs ?? 50;
  const visitedEdges = new Set<string>();
  const visitedNodes = new Set<string>();

  let startNodeId = options?.source;
  if (!startNodeId) {
    const firstNode = graph.nodes.values().next().value;
    if (!firstNode) return { visitedEdges, visitedNodes };
    startNodeId = firstNode.id;
  }

  const queue: string[] = [startNodeId];
  visitedNodes.add(startNodeId);

  while (queue.length !== 0) {
    const elem = queue.shift();
    if (elem === undefined) {
      continue;
    }

    const node: GraphNode | undefined = graph.nodes.get(elem);
    if (node === undefined) {
      continue;
    }

    for (const edge of node.edges) {
      if (visitedNodes.has(edge.to)) {
        continue;
      }

      queue.push(edge.to);
      visitedEdges.add(edge.id);
      visitedNodes.add(edge.to);

      yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { visitedEdges, visitedNodes };
}
