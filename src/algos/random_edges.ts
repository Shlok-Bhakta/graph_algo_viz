import type { Graph } from '../types';
import type { AlgorithmStep } from './types';

export async function* randomEdges(
  graph: Graph, 
  options?: { delayMs?: number }
): AsyncGenerator<AlgorithmStep, AlgorithmStep> {
  const delayMs = options?.delayMs ?? 50;
  const allEdgeIds = graph.edges.map(edge => edge.id);
  const visitedEdges = new Set<string>();
  const visitedNodes = new Set<string>();
  
  while (visitedEdges.size < allEdgeIds.length) {
    // ALGO GOES HERE
    const unvisited = allEdgeIds.filter(id => !visitedEdges.has(id));
    const randomIndex = Math.floor(Math.random() * unvisited.length);
    const selectedEdgeId = unvisited[randomIndex];
    const selectedEdge = graph.edges.find(e => e.id === selectedEdgeId)!;
    
    visitedEdges.add(selectedEdgeId);
    visitedNodes.add(selectedEdge.from);
    visitedNodes.add(selectedEdge.to);
    // ALGO GOES HERE
    yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  return { visitedEdges, visitedNodes };
}
