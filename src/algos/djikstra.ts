import type { Edge, Graph, GraphNode } from '../types';
import type { AlgorithmStep } from './types';
import MinHeap from 'heap-js';

export async function* Djikstra(
  graph: Graph,
  options?: { source?: string; sink?: string; delayMs?: number }
): AsyncGenerator<AlgorithmStep, AlgorithmStep> {
  const delayMs = options?.delayMs ?? 50;
  let visitedEdges = new Set<string>();
  let visitedNodes = new Set<string>();
  const startNodeId = options?.source;
  if (!startNodeId) {
    return { visitedEdges, visitedNodes };
  }
  const endNodeId = options?.sink;
  if (!endNodeId) {
    return { visitedEdges, visitedNodes };
  }
  
  const distances = new Map<string, number>();
  const parents = new Map<string, {nodeId: string, edgeId: string} | null>();
  const visited = new Set<string>();
  distances.set(startNodeId, 0)
  const heap = new MinHeap<{nodeId: string, dist: number}>((a, b) => a.dist - b.dist);
  heap.push({nodeId: startNodeId, dist: 0})
  while(heap.length > 0){
  // Continuously do relax v-1 times on all edges
    const {nodeId, dist} = heap.pop()!;
    if(visited.has(nodeId)){
      continue;
    }else{
      visited.add(nodeId);
    }

    if(nodeId == endNodeId) {
      break; // Yipee we done
    }
    
    const node = graph.nodes.get(nodeId);
    if(!node){
      continue
    }

    for (const edge of node.edges){
      const newDist = dist + edge.weight;
      const oldDist = distances.get(edge.to) ?? Infinity
      if (newDist < oldDist){
        distances.set(edge.to, newDist)
        parents.set(edge.to, {nodeId: edge.from, edgeId: edge.id})
        heap.push({nodeId: edge.to, dist: newDist})
        
        visitedEdges.add(edge.id);
        visitedNodes.add(edge.from);
        visitedNodes.add(edge.to);
        yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  visitedEdges.clear()
  visitedNodes.clear()

  let curr = endNodeId
  while(curr != startNodeId){
    const parent = parents.get(curr)!;
    visitedNodes.add(curr)
    visitedNodes.add(parent.nodeId)
    visitedEdges.add(parent.edgeId)
    curr = parent.nodeId
    yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  visitedNodes.add(startNodeId)
  yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
  await new Promise(resolve => setTimeout(resolve, delayMs));
  




  return { visitedEdges, visitedNodes };
}
