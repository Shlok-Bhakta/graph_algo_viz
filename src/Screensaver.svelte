<script lang="ts">
  import { onMount } from 'svelte';
  import MapCanvas from './lib/MapCanvas.svelte';
  import { calculateBbox, fetchOSMData } from './lib/overpass';
  import { buildGraph } from './lib/graph';
  import { getRandomCity, getRandomRadius } from './lib/cities';
  import type { BoundingBox, Graph, Element } from './types';

  const CANVAS_WIDTH = $state(screen.width);
  const CANVAS_HEIGHT = $state(screen.height);

  let graph = $state<Graph | null>(null);
  let buildings = $state<Element[]>([]);
  let highlightedEdges = $state(new Set<string>());
  let visitedNodes = $state(new Set<string>());
  let bbox = $state<BoundingBox | null>(null);
  let loading = $state(true);
  let fadeOut = $state(false);
  let currentCity = $state('');
  let currentAlgorithm = $state('');
  let sourcePin = $state<{ nodeId: string; lat: number; lon: number } | null>(null);
  let sinkPin = $state<{ nodeId: string; lat: number; lon: number } | null>(null);
  let sinkReachable = $state(false);
  let currentRadius = $state(1000);

  let nextGraph: Graph | null = null;
  let nextBuildings: Element[] = [];
  let nextBbox: BoundingBox | null = null;
  let nextCity = '';
  let preloading = false;

  const zenAlgorithms = ['bfs', 'dfs', 'Prim', 'Kruskal', 'Bellman-Ford', 'Djikstra', 'astar'];

  let nextRadius = 1000;

  async function preloadNextLocation() {
    if (preloading) return;
    preloading = true;

    const city = getRandomCity();
    const radius = getRandomRadius(city);
    
    try {
      const bboxData = calculateBbox(city.lat, city.lon, CANVAS_WIDTH, CANVAS_HEIGHT, radius);
      const data = await fetchOSMData(bboxData);
      
      const highways = data.elements.filter(el => el.tags?.highway);
      const buildingsList = data.elements.filter(el => el.tags?.building);
      
      nextGraph = buildGraph(highways);
      nextBuildings = buildingsList;
      nextBbox = bboxData;
      nextCity = city.name;
      nextRadius = radius;
      
      console.log(`Preloaded: ${city.name}, radius: ${radius}m, nodes: ${nextGraph.nodes.size}`);
    } catch (e) {
      console.error('Failed to preload location:', e);
      nextGraph = null;
    } finally {
      preloading = false;
    }
  }

  function initializePins(requiresSink: boolean) {
    if (!graph || !bbox) return;

    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLon = (bbox.east + bbox.west) / 2;

    const nodeArray = Array.from(graph.nodes.values());
    if (nodeArray.length < 2) return;

    const latMargin = (bbox.north - bbox.south) * 0.1;
    const lonMargin = (bbox.east - bbox.west) * 0.1;

    const isInBounds = (node: typeof nodeArray[0]) => {
      return node.lat >= bbox.south + latMargin && 
             node.lat <= bbox.north - latMargin && 
             node.lon >= bbox.west + lonMargin && 
             node.lon <= bbox.east - lonMargin;
    };

    if (requiresSink) {
      const corners = [
        { lat: centerLat + (bbox.north - bbox.south) * 0.25, lon: centerLon - (bbox.east - bbox.west) * 0.25 },
        { lat: centerLat + (bbox.north - bbox.south) * 0.25, lon: centerLon + (bbox.east - bbox.west) * 0.25 },
        { lat: centerLat - (bbox.north - bbox.south) * 0.25, lon: centerLon - (bbox.east - bbox.west) * 0.25 },
        { lat: centerLat - (bbox.north - bbox.south) * 0.25, lon: centerLon + (bbox.east - bbox.west) * 0.25 }
      ];
      
      const sourceCorner = corners[Math.floor(Math.random() * corners.length)];
      let sourceNode = nodeArray[0];
      let minDistToSourceCorner = Infinity;
      for (const node of nodeArray) {
        if (!isInBounds(node)) continue;
        const dist = Math.sqrt((node.lat - sourceCorner.lat) ** 2 + (node.lon - sourceCorner.lon) ** 2);
        if (dist < minDistToSourceCorner) {
          minDistToSourceCorner = dist;
          sourceNode = node;
        }
      }

      const depthMap = new Map<string, number>();
      const queue: { id: string; depth: number }[] = [{ id: sourceNode.id, depth: 0 }];
      depthMap.set(sourceNode.id, 0);
      let maxDepth = 0;
      
      while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        const currentNode = graph.nodes.get(id);
        if (!currentNode) continue;
        
        maxDepth = Math.max(maxDepth, depth);
        
        for (const edge of currentNode.edges) {
          if (!depthMap.has(edge.to)) {
            depthMap.set(edge.to, depth + 1);
            queue.push({ id: edge.to, depth: depth + 1 });
          }
        }
      }
      
      let sinkNode = sourceNode;
      for (let targetDepth = maxDepth; targetDepth >= Math.floor(maxDepth * 0.6); targetDepth--) {
        const candidatesAtDepth: typeof sourceNode[] = [];
        
        for (const [nodeId, depth] of depthMap.entries()) {
          if (depth === targetDepth) {
            const node = graph.nodes.get(nodeId);
            if (node && isInBounds(node)) {
              candidatesAtDepth.push(node);
            }
          }
        }
        
        if (candidatesAtDepth.length > 0) {
          sinkNode = candidatesAtDepth[Math.floor(Math.random() * candidatesAtDepth.length)];
          break;
        }
      }
      
      sourcePin = { nodeId: sourceNode.id, lat: sourceNode.lat, lon: sourceNode.lon };
      sinkPin = { nodeId: sinkNode.id, lat: sinkNode.lat, lon: sinkNode.lon };
      sinkReachable = checkReachability(sourceNode.id, sinkNode.id);
    } else {
      let sourceNode = nodeArray[0];
      let minDistToCenter = Infinity;
      for (const node of nodeArray) {
        if (!isInBounds(node)) continue;
        const dist = Math.sqrt((node.lat - centerLat) ** 2 + (node.lon - centerLon) ** 2);
        if (dist < minDistToCenter) {
          minDistToCenter = dist;
          sourceNode = node;
        }
      }
      
      sourcePin = { nodeId: sourceNode.id, lat: sourceNode.lat, lon: sourceNode.lon };
      sinkPin = null;
      sinkReachable = false;
    }
  }

  function checkReachability(sourceNodeId: string, sinkNodeId: string): boolean {
    if (!graph) return false;

    const visited = new Set<string>();
    const queue: string[] = [sourceNodeId];
    visited.add(sourceNodeId);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId === sinkNodeId) return true;

      const currentNode = graph.nodes.get(currentId);
      if (!currentNode) continue;

      for (const edge of currentNode.edges) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
      }
    }

    return false;
  }

  async function loadNewLocation() {
    try {
      loading = true;
      
      if (nextGraph && nextBbox) {
        graph = nextGraph;
        buildings = nextBuildings;
        bbox = nextBbox;
        currentCity = nextCity;
        currentRadius = nextRadius;
        
        nextGraph = null;
        nextBuildings = [];
        nextBbox = null;
        
        console.log(`Loaded from cache: ${currentCity}`);
      } else {
        const city = getRandomCity();
        const radius = getRandomRadius(city);
        currentCity = city.name;
        currentRadius = radius;
        
        bbox = calculateBbox(city.lat, city.lon, CANVAS_WIDTH, CANVAS_HEIGHT, radius);
        const data = await fetchOSMData(bbox);
        
        const highways = data.elements.filter(el => el.tags?.highway);
        const buildingsList = data.elements.filter(el => el.tags?.building);
        
        graph = buildGraph(highways);
        buildings = buildingsList;
        
        console.log(`Loaded fresh: ${city.name}, radius: ${radius}m, nodes: ${graph.nodes.size}`);
      }
    } catch (e) {
      console.error('Failed to load location:', e);
      setTimeout(() => loadNewLocation(), 2000);
    } finally {
      loading = false;
    }
  }

  async function runRandomAlgorithm() {
    if (!graph || !bbox) return;
    
    preloadNextLocation();
    
    const algoId = zenAlgorithms[Math.floor(Math.random() * zenAlgorithms.length)];
    currentAlgorithm = algoId;
    
    const { algorithms } = await import('./algos/registry');
    const algo = algorithms.find(a => a.id === algoId);
    if (!algo) return;
    
    initializePins(algo.requiresSink);
    
    highlightedEdges = new Set();
    visitedNodes = new Set();
    
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500));
    
    const speed = 20 + Math.floor(Math.random() * 30);
    
    console.log(`Running ${algo.name} at ${speed}ms delay from ${sourcePin?.nodeId} to ${sinkPin?.nodeId}`);
    
    try {
      for await (const step of algo.run(graph, { 
        delayMs: speed, 
        source: sourcePin?.nodeId,
        sink: sinkPin?.nodeId 
      })) {
        highlightedEdges = step.visitedEdges;
        visitedNodes = step.visitedNodes;
      }
    } catch (e) {
      console.error('Algorithm error:', e);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    await transitionToNextLocation();
  }

  async function transitionToNextLocation() {
    fadeOut = true;
    await new Promise(resolve => setTimeout(resolve, 800));
    
    highlightedEdges = new Set();
    visitedNodes = new Set();
    sourcePin = null;
    sinkPin = null;
    graph = null;
    bbox = null;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await loadNewLocation();
    
    await new Promise(resolve => setTimeout(resolve, 600));
    
    fadeOut = false;
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    runRandomAlgorithm();
  }

  onMount(async () => {
    await loadNewLocation();
    await new Promise(resolve => setTimeout(resolve, 1000));
    runRandomAlgorithm();
  });
</script>

<div class="bg-gradient-to-br from-zinc-950 via-slate-950 to-neutral-950 w-screen h-screen flex flex-col items-center justify-center relative overflow-hidden">
  <div class="absolute inset-0 bg-black z-50 transition-opacity duration-1200 pointer-events-none" class:opacity-100={fadeOut} class:opacity-0={!fadeOut}></div>

  {#if loading}
    <div class="absolute inset-0 flex items-center justify-center z-40">
      <div class="text-center">
        <div class="text-white/30 text-sm font-light tracking-widest mb-2">
          {currentCity || 'Loading...'}
        </div>
        <div class="w-32 h-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
      </div>
    </div>
  {/if}

  {#if graph && bbox}
    <MapCanvas 
      {bbox}
      {graph}
      {buildings}
      {highlightedEdges}
      CANVAS_WIDTH={CANVAS_WIDTH}
      CANVAS_HEIGHT={CANVAS_HEIGHT}
      {sourcePin}
      {sinkPin}
      {sinkReachable}
      onPinDrag={() => {}}
      zenMode={true}
    />
    
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-xs font-light tracking-widest text-center z-30 px-6 py-3 rounded-lg backdrop-blur-[2px] bg-black/5">
      <div class="mb-1">{currentCity}</div>
      <div class="text-white/35 text-[10px]">{currentAlgorithm}</div>
    </div>
  {/if}

  <audio autoplay loop class="hidden">
    <source src="https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3" type="audio/mpeg">
  </audio>
</div>

<style>
  .transition-opacity {
    transition: opacity 1.2s ease-in-out;
  }
  
  .duration-1200 {
    transition-duration: 1.2s;
  }


</style>
