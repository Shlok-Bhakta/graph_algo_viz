import type { Graph } from '../types';
import type { AlgorithmStep } from './types';
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

  const startNode = graph.nodes.get(startNodeId);
  const endNode = graph.nodes.get(endNodeId);
  if (!startNode || !endNode) {
    return { visitedEdges, visitedNodes };
  }

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const parents = new Map<string, {nodeId: string, edgeId: string} | null>();
  const visited = new Set<string>();

  gScore.set(startNodeId, 0);
  fScore.set(startNodeId, heuristic(startNode.lat, startNode.lon, endNode.lat, endNode.lon));

  const heap = new MinHeap<{nodeId: string, fScore: number}>((a, b) => a.fScore - b.fScore);
  heap.push({ nodeId: startNodeId, fScore: fScore.get(startNodeId)! });

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
        const toNode = graph.nodes.get(edge.to);
        if (!toNode) continue;

        gScore.set(edge.to, tentativeG);
        const h = heuristic(toNode.lat, toNode.lon, endNode.lat, endNode.lon);
        fScore.set(edge.to, tentativeG + h);
        parents.set(edge.to, { nodeId: edge.from, edgeId: edge.id });
        heap.push({ nodeId: edge.to, fScore: tentativeG + h });

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

  let curr = endNodeId;
  while (curr !== startNodeId) {
    const parent = parents.get(curr);
    if (!parent) break;
    
    visitedNodes.add(curr);
    visitedNodes.add(parent.nodeId);
    visitedEdges.add(parent.edgeId);
    curr = parent.nodeId;
    yield { visitedEdges: new Set(visitedEdges), visitedNodes: new Set(visitedNodes) };
    await new Promise(resolve => setTimeout(resolve, delayMs * 2));
  }
  visitedNodes.add(startNodeId);

  return { visitedEdges, visitedNodes };
}
