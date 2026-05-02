import type { BoundingBox, Graph, GraphNode } from '../types';

export interface Pin {
  nodeId: string;
  lat: number;
  lon: number;
}

export interface PickVisiblePinsOptions {
  bbox: BoundingBox;
  width: number;
  height: number;
  requiresSink?: boolean;
  marginPx?: number;
  algorithmId?: string;
}

export interface PickVisiblePinsResult {
  source: Pin | null;
  sink: Pin | null;
  reachable: boolean;
}

const DEFAULT_MARGIN_PX = 48;

interface RankedNode {
  node: GraphNode;
  graphDistance: number;
  screenDistance: number;
}

export function pickVisiblePins(graph: Graph, options: PickVisiblePinsOptions): PickVisiblePinsResult {
  const safeBounds = insetBbox(options.bbox, options.width, options.height, options.marginPx ?? DEFAULT_MARGIN_PX);
  const safeNodeIds = new Set<string>();

  for (const node of graph.nodes.values()) {
    if (node.edges.length > 0 && isInsideBbox(node, safeBounds)) {
      safeNodeIds.add(node.id);
    }
  }

  const component = largestSafeComponent(graph, safeNodeIds);
  const candidates = component
    .map((id) => graph.nodes.get(id))
    .filter((node): node is GraphNode => Boolean(node));

  if (candidates.length === 0) {
    return { source: null, sink: null, reachable: false };
  }

  const source = variedSource(candidates, safeBounds) ?? candidates[0];

  if (!options.requiresSink) {
    return { source: toPin(source), sink: null, reachable: false };
  }

  const distances = bfsDistances(graph, source.id, new Set(component));
  const reachable = candidates
    .filter((node) => node.id !== source.id && distances.has(node.id));
  const sink = sinkForAlgorithm(reachable, source, distances, options.algorithmId)
    ?? source;

  return {
    source: toPin(source),
    sink: toPin(sink),
    reachable: distances.has(sink.id)
  };
}

function insetBbox(bbox: BoundingBox, width: number, height: number, marginPx: number): BoundingBox {
  const clampedXMargin = Math.min(Math.max(0, marginPx), Math.max(0, width / 2 - 1));
  const clampedYMargin = Math.min(Math.max(0, marginPx), Math.max(0, height / 2 - 1));
  const lonInset = ((bbox.east - bbox.west) * clampedXMargin) / Math.max(1, width);
  const latInset = ((bbox.north - bbox.south) * clampedYMargin) / Math.max(1, height);

  return {
    south: bbox.south + latInset,
    north: bbox.north - latInset,
    west: bbox.west + lonInset,
    east: bbox.east - lonInset
  };
}

function isInsideBbox(node: GraphNode, bbox: BoundingBox): boolean {
  return node.lat >= bbox.south
    && node.lat <= bbox.north
    && node.lon >= bbox.west
    && node.lon <= bbox.east;
}

function largestSafeComponent(graph: Graph, allowed: Set<string>): string[] {
  const visited = new Set<string>();
  let largest: string[] = [];

  for (const nodeId of allowed) {
    if (visited.has(nodeId)) continue;
    const component: string[] = [];
    const queue = [nodeId];
    visited.add(nodeId);

    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      const node = graph.nodes.get(current);
      if (!node) continue;

      for (const edge of node.edges) {
        if (!allowed.has(edge.to) || visited.has(edge.to)) continue;
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }

    if (component.length > largest.length) largest = component;
  }

  return largest;
}

function bfsDistances(graph: Graph, sourceId: string, allowed: Set<string>): Map<string, number> {
  const distances = new Map<string, number>([[sourceId, 0]]);
  const queue = [sourceId];

  while (queue.length) {
    const currentId = queue.shift()!;
    const node = graph.nodes.get(currentId);
    if (!node) continue;
    const currentDistance = distances.get(currentId) ?? 0;

    for (const edge of node.edges) {
      if (!allowed.has(edge.to) || distances.has(edge.to)) continue;
      distances.set(edge.to, currentDistance + 1);
      queue.push(edge.to);
    }
  }

  return distances;
}

function closestNode(nodes: GraphNode[], lat: number, lon: number): GraphNode | null {
  return nodes.reduce<GraphNode | null>((best, node) => {
    if (!best) return node;
    return squaredDistance(node, lat, lon) < squaredDistance(best, lat, lon) ? node : best;
  }, null);
}

function variedSource(nodes: GraphNode[], bounds: BoundingBox): GraphNode | null {
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLon = (bounds.east + bounds.west) / 2;
  const horizontal = Math.random() < 0.5 ? 'west' : 'east';
  const vertical = Math.random() < 0.5 ? 'north' : 'south';
  const useEdgeBand = Math.random() < 0.65;

  const zone = nodes.filter((node) => {
    const inHorizontalHalf = horizontal === 'west' ? node.lon <= centerLon : node.lon >= centerLon;
    const inVerticalHalf = vertical === 'north' ? node.lat >= centerLat : node.lat <= centerLat;
    if (!useEdgeBand) return inHorizontalHalf && inVerticalHalf;

    const x = (node.lon - bounds.west) / Math.max(Number.EPSILON, bounds.east - bounds.west);
    const y = (bounds.north - node.lat) / Math.max(Number.EPSILON, bounds.north - bounds.south);
    const nearHorizontalEdge = horizontal === 'west' ? x <= 0.38 : x >= 0.62;
    const nearVerticalEdge = vertical === 'north' ? y <= 0.38 : y >= 0.62;
    return nearHorizontalEdge && nearVerticalEdge;
  });

  const pool = zone.length >= 4 ? zone : nodes;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function sinkForAlgorithm(
  nodes: GraphNode[],
  source: GraphNode,
  distances: Map<string, number>,
  algorithmId?: string
): GraphNode | null {
  if (nodes.length === 0) return null;
  const ranked = nodes
    .map((node) => ({
      node,
      graphDistance: distances.get(node.id) ?? 0,
      screenDistance: squaredDistance(node, source.lat, source.lon)
    }))
    .sort((a, b) => a.screenDistance - b.screenDistance);

  if (algorithmId === 'Djikstra') {
    const graphDistances = ranked.map((entry) => entry.graphDistance).sort((a, b) => a - b);
    const nearTarget = graphDistances[Math.min(graphDistances.length - 1, Math.max(0, Math.floor(graphDistances.length * 0.28)))] ?? 1;
    const close = ranked.filter((entry) => {
      return entry.graphDistance >= 3
        && entry.graphDistance <= Math.max(8, nearTarget)
        && entry.screenDistance > 0;
    });
    return randomFromTop(close.length ? close : ranked, 12);
  }

  if (algorithmId === 'astar') {
    return randomFromTop([...ranked].reverse(), 10);
  }

  const graphDistances = ranked.map((entry) => entry.graphDistance).sort((a, b) => a - b);
  const minDistance = graphDistances[Math.floor(graphDistances.length * 0.35)] ?? 4;
  const maxDistance = graphDistances[Math.floor(graphDistances.length * 0.78)] ?? Infinity;
  const medium = ranked
    .filter((entry) => entry.graphDistance >= minDistance && entry.graphDistance <= maxDistance)
    .sort((a, b) => b.screenDistance - a.screenDistance);
  return randomFromTop(medium.length ? medium : [...ranked].reverse(), 12);
}

function randomFromTop(items: RankedNode[], limit: number): GraphNode | null {
  return items[Math.floor(Math.random() * Math.min(limit, items.length))]?.node ?? null;
}

function squaredDistance(node: GraphNode, lat: number, lon: number): number {
  return (node.lat - lat) ** 2 + (node.lon - lon) ** 2;
}

function toPin(node: GraphNode): Pin {
  return { nodeId: node.id, lat: node.lat, lon: node.lon };
}
