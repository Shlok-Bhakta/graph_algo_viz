import type { Element, Graph, Edge, Point } from '../types';

function distance(p1: Point, p2: Point): number {
  const R = 6371000;
  const lat1 = p1.lat * Math.PI / 180;
  const lat2 = p2.lat * Math.PI / 180;
  const deltaLat = (p2.lat - p1.lat) * Math.PI / 180;
  const deltaLon = (p2.lon - p1.lon) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function pointToId(point: Point): string {
  return `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
}

export function buildGraph(elements: Element[]): Graph {
  const graph: Graph = {
    nodes: new Map(),
    edges: []
  };

  const highways = elements.filter(el => el.tags?.highway && el.geometry && el.geometry.length >= 2);

  highways.forEach(way => {
    if (!way.geometry) return;

    for (let i = 0; i < way.geometry.length - 1; i++) {
      const fromPoint = way.geometry[i];
      const toPoint = way.geometry[i + 1];
      
      const fromId = pointToId(fromPoint);
      const toId = pointToId(toPoint);

      if (!graph.nodes.has(fromId)) {
        graph.nodes.set(fromId, {
          id: fromId,
          lat: fromPoint.lat,
          lon: fromPoint.lon,
          edges: []
        });
      }

      if (!graph.nodes.has(toId)) {
        graph.nodes.set(toId, {
          id: toId,
          lat: toPoint.lat,
          lon: toPoint.lon,
          edges: []
        });
      }

      const forwardEdgeId = `${fromId}->${toId}`;
      const forwardEdge: Edge = {
        id: forwardEdgeId,
        from: fromId,
        to: toId,
        way: {
          id: way.id,
          tags: way.tags || {},
          geometry: [fromPoint, toPoint]
        },
        weight: distance(fromPoint, toPoint),
        highlighted: false
      };

      const backwardEdgeId = `${toId}->${fromId}`;
      const backwardEdge: Edge = {
        id: backwardEdgeId,
        from: toId,
        to: fromId,
        way: {
          id: way.id,
          tags: way.tags || {},
          geometry: [toPoint, fromPoint]
        },
        weight: distance(fromPoint, toPoint),
        highlighted: false
      };

      graph.edges.push(forwardEdge);
      graph.edges.push(backwardEdge);
      graph.nodes.get(fromId)!.edges.push(forwardEdge);
      graph.nodes.get(toId)!.edges.push(backwardEdge);
    }
  });

  return graph;
}
