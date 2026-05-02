import type { Graph } from '../types';
import type { AlgorithmOptions, AlgorithmStep } from './types';
import MinHeap from 'heap-js';

function heuristic(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function* astar(
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

  const startNode = graph.nodes.get(startNodeId);
  const endNode = graph.nodes.get(endNodeId);
  if (!startNode || !endNode) {
    return { visitedEdges, visitedNodes };
  }

  const gScore = new Map<string, number>();
  const heuristicScore = new Map<string, number>();
  const parents = new Map<string, {nodeId: string, edgeId: string} | null>();
  const visited = new Set<string>();
  const estimatedCostToEnd = (nodeId: string): number => {
    const cached = heuristicScore.get(nodeId);
    if (cached !== undefined) return cached;

    const node = graph.nodes.get(nodeId);
    if (!node) return Infinity;

    const score = heuristic(node.lat, node.lon, endNode.lat, endNode.lon);
    heuristicScore.set(nodeId, score);
    return score;
  };

  gScore.set(startNodeId, 0);

  const heap = new MinHeap<{nodeId: string, fScore: number}>((a, b) => a.fScore - b.fScore);
  heap.push({ nodeId: startNodeId, fScore: estimatedCostToEnd(startNodeId) });

  while (heap.length > 0) {
    const { nodeId } = heap.pop()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    if (nodeId === endNodeId) break;

    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    const currentG = gScore.get(nodeId) ?? Infinity;

    for (const edge of node.edges) {
      if (visited.has(edge.to)) continue;

      const tentativeG = currentG + edge.weight;
      const oldG = gScore.get(edge.to) ?? Infinity;

      if (tentativeG < oldG) {
        gScore.set(edge.to, tentativeG);
        const fScore = tentativeG + estimatedCostToEnd(edge.to);
        if (!Number.isFinite(fScore)) continue;

        parents.set(edge.to, { nodeId: edge.from, edgeId: edge.id });
        heap.push({ nodeId: edge.to, fScore });

        visitedEdges.add(edge.id);
        visitedNodes.add(edge.from);
        visitedNodes.add(edge.to);
        yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  visitedEdges.clear();
  visitedNodes.clear();

  const path: { nodeId: string; edgeId: string }[] = [];
  let curr = endNodeId;
  while (curr !== startNodeId) {
    const parent = parents.get(curr);
    if (!parent) break;
    path.push({ nodeId: curr, edgeId: parent.edgeId });
    curr = parent.nodeId;
  }

  if (options?.skipPathReconstructionYields) {
    for (const pathStep of path.reverse()) {
      const parent = parents.get(pathStep.nodeId);
      if (!parent) continue;
      visitedNodes.add(pathStep.nodeId);
      visitedNodes.add(parent.nodeId);
      visitedEdges.add(pathStep.edgeId);
    }
    visitedNodes.add(startNodeId);
    return { visitedEdges, visitedNodes };
  }

  const revealDelayMs = Math.max(8, Math.min(18, delayMs / 3));
  for (const pathStep of path.reverse()) {
    const parent = parents.get(pathStep.nodeId);
    if (!parent) continue;
    visitedNodes.add(pathStep.nodeId);
    visitedNodes.add(parent.nodeId);
    visitedEdges.add(pathStep.edgeId);
    yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
    await new Promise(resolve => setTimeout(resolve, revealDelayMs));
  }
  visitedNodes.add(startNodeId);
  yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };

  return { visitedEdges, visitedNodes };
}
