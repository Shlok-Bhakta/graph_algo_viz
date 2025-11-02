import type { Edge, Graph, GraphNode } from '../types';
import type { AlgorithmStep } from './types';
import MinHeap from 'heap-js';


export async function* Prim(
  graph: Graph,
  options?: { source?: string; delayMs?: number }
): AsyncGenerator<AlgorithmStep, AlgorithmStep> {
  const delayMs = options?.delayMs ?? 50;
  let visitedEdges = new Set<string>();
  let visitedNodes = new Set<string>();
  // Get all reachable Edges
  let startNodeId = options?.source;
  if (!startNodeId) {
    const firstNode = graph.nodes.values().next().value;
    if (!firstNode) return { visitedEdges, visitedNodes };
    startNodeId = firstNode.id;
  }
  const heap = new MinHeap<Edge>((a: Edge, b: Edge) => a.weight - b.weight);
  for(let i = 0; i < graph.nodes.get(startNodeId)!.edges.length; i++){
    heap.push(graph.nodes.get(startNodeId)!.edges[i]);
  }
  while(heap.length > 0){
    const edge: Edge = heap.pop()!;
    if(visitedNodes.has(edge.to)){
      continue
    }
    visitedEdges.add(edge.id)
    visitedNodes.add(edge.from)
    visitedNodes.add(edge.to)
    for(let i = 0; i < graph.nodes.get(edge.to)!.edges.length; i++){
      if(visitedNodes.has(graph.nodes.get(edge.to)!.edges[i].to)) {
        continue
      }
      heap.push(graph.nodes.get(edge.to)!.edges[i]);
    }
    yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  

  




  return { visitedEdges, visitedNodes };
}
