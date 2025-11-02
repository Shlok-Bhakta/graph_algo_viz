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
  const rawGraph: Graph = {
    nodes: new Map(),
    edges: []
  };

  const highways = elements.filter(el => el.tags?.highway && el.geometry && el.geometry.length >= 2);

  // Build raw graph with all nodes
  highways.forEach(way => {
    if (!way.geometry) return;

    for (let i = 0; i < way.geometry.length - 1; i++) {
      const fromPoint = way.geometry[i];
      const toPoint = way.geometry[i + 1];
      
      const fromId = pointToId(fromPoint);
      const toId = pointToId(toPoint);

      if (!rawGraph.nodes.has(fromId)) {
        rawGraph.nodes.set(fromId, {
          id: fromId,
          lat: fromPoint.lat,
          lon: fromPoint.lon,
          edges: []
        });
      }

      if (!rawGraph.nodes.has(toId)) {
        rawGraph.nodes.set(toId, {
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

      rawGraph.edges.push(forwardEdge);
      rawGraph.edges.push(backwardEdge);
      rawGraph.nodes.get(fromId)!.edges.push(forwardEdge);
      rawGraph.nodes.get(toId)!.edges.push(backwardEdge);
    }
  });

  // Now collapse degree-2 nodes
  const collapsedGraph: Graph = {
    nodes: new Map(),
    edges: []
  };

  // Identify important nodes (degree != 2)
  const importantNodes = new Set<string>();
  for (const [nodeId, node] of rawGraph.nodes) {
    if (node.edges.length !== 2) {
      importantNodes.add(nodeId);
      collapsedGraph.nodes.set(nodeId, { ...node, edges: [] });
    }
  }

  // Trace paths between important nodes, tracking sub-edges
  for (const startId of importantNodes) {
    const startNode = rawGraph.nodes.get(startId)!;
    
    for (const firstEdge of startNode.edges) {
      // Follow the path until we hit another important node
      let currentId = firstEdge.to;
      let currentEdge = firstEdge;
      const pathEdges: string[] = [firstEdge.id];
      const pathGeometry: Point[] = [startNode];
      let totalWeight = firstEdge.weight;

      while (!importantNodes.has(currentId)) {
        const currentNode = rawGraph.nodes.get(currentId)!;
        pathGeometry.push(currentNode);
        
        // Find the next edge (not going back)
        const nextEdge = currentNode.edges.find(e => e.to !== currentEdge.from);
        if (!nextEdge) break;
        
        pathEdges.push(nextEdge.id);
        totalWeight += nextEdge.weight;
        currentEdge = nextEdge;
        currentId = nextEdge.to;
      }

      // We've reached an important node
      if (importantNodes.has(currentId)) {
        pathGeometry.push(rawGraph.nodes.get(currentId)!);
        
        const collapsedEdgeId = `${startId}->${currentId}`;
        const collapsedEdge: Edge = {
          id: collapsedEdgeId,
          from: startId,
          to: currentId,
          way: {
            id: firstEdge.way.id,
            tags: firstEdge.way.tags,
            geometry: pathGeometry
          },
          weight: totalWeight,
          highlighted: false,
          subEdges: pathEdges
        };

        collapsedGraph.edges.push(collapsedEdge);
        collapsedGraph.nodes.get(startId)!.edges.push(collapsedEdge);
      }
    }
  }

  // Return simplified graph as main, but store raw graph for rendering
  collapsedGraph._raw = {
    nodes: rawGraph.nodes,
    edges: rawGraph.edges
  };

  console.log(`Graph: ${rawGraph.nodes.size} raw nodes -> ${collapsedGraph.nodes.size} simplified nodes`);
  console.log(`Graph: ${rawGraph.edges.length} raw edges -> ${collapsedGraph.edges.length} simplified edges`);

  return collapsedGraph;
}
