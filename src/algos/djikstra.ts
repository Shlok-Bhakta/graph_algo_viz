import type { Edge, Graph, GraphNode } from '../types';
import type { AlgorithmOptions, AlgorithmStep } from './types';
import MinHeap from 'heap-js';

export async function* Djikstra(
  graph: Graph,
  options?: AlgorithmOptions
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

  const path: { nodeId: string; edgeId: string }[] = [];
  let curr = endNodeId
  while(curr != startNodeId){
    const parent = parents.get(curr);
    if (!parent) {
      return { visitedEdges, visitedNodes };
    }
    path.push({ nodeId: curr, edgeId: parent.edgeId });
    curr = parent.nodeId
  }

  if (options?.skipPathReconstructionYields) {
    for (const pathStep of path.reverse()) {
      const parent = parents.get(pathStep.nodeId);
      if (!parent) continue;
      visitedNodes.add(pathStep.nodeId)
      visitedNodes.add(parent.nodeId)
      visitedEdges.add(pathStep.edgeId)
    }
    visitedNodes.add(startNodeId)
    return { visitedEdges, visitedNodes };
  }

  const revealDelayMs = Math.max(8, Math.min(18, delayMs / 3));
  for (const pathStep of path.reverse()) {
    const parent = parents.get(pathStep.nodeId);
    if (!parent) continue;
    visitedNodes.add(pathStep.nodeId)
    visitedNodes.add(parent.nodeId)
    visitedEdges.add(pathStep.edgeId)
    yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
    await new Promise(resolve => setTimeout(resolve, revealDelayMs));
  }
  visitedNodes.add(startNodeId)
  yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
  await new Promise(resolve => setTimeout(resolve, revealDelayMs));
  




  return { visitedEdges, visitedNodes };
}
