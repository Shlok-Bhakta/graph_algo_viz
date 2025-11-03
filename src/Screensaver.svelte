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
  let sourceNode: { lat: number; lon: number } | null = null;
  let showRootGlow = $state(false);
  let rippleAnimations = $state<Array<{ id: number; startTime: number }>>([]);
  let currentRadius = $state(1000);

  let nextGraph: Graph | null = null;
  let nextBuildings: Element[] = [];
  let nextBbox: BoundingBox | null = null;
  let nextCity = '';
  let preloading = false;

  const zenAlgorithms = ['bfs', 'dfs', 'Prim', 'Kruskal'];

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

  function selectCentralNode(graphData: Graph, bboxData: BoundingBox): any {
    const centerLat = (bboxData.north + bboxData.south) / 2;
    const centerLon = (bboxData.east + bboxData.west) / 2;
    
    const nodes = Array.from(graphData.nodes.values());
    const margin = 0.3;
    const latMargin = (bboxData.north - bboxData.south) * margin;
    const lonMargin = (bboxData.east - bboxData.west) * margin;
    
    const centralNodes = nodes.filter(node => 
      node.lat >= bboxData.south + latMargin &&
      node.lat <= bboxData.north - latMargin &&
      node.lon >= bboxData.west + lonMargin &&
      node.lon <= bboxData.east - lonMargin
    );
    
    if (centralNodes.length === 0) return nodes[Math.floor(nodes.length / 2)];
    
    centralNodes.sort((a, b) => {
      const distA = Math.sqrt(Math.pow(a.lat - centerLat, 2) + Math.pow(a.lon - centerLon, 2));
      const distB = Math.sqrt(Math.pow(b.lat - centerLat, 2) + Math.pow(b.lon - centerLon, 2));
      return distA - distB;
    });
    
    return centralNodes[0];
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

  function startRippleAnimation() {
    rippleAnimations = [{ id: Date.now(), startTime: Date.now() }];
    const interval = setInterval(() => {
      rippleAnimations = [...rippleAnimations, { id: Date.now(), startTime: Date.now() }];
    }, 800);
    
    setTimeout(() => {
      clearInterval(interval);
    }, 3200);
  }

  async function runRandomAlgorithm() {
    if (!graph || !bbox) return;
    
    preloadNextLocation();
    
    const algoId = zenAlgorithms[Math.floor(Math.random() * zenAlgorithms.length)];
    currentAlgorithm = algoId;
    
    const { algorithms } = await import('./algos/registry');
    const algo = algorithms.find(a => a.id === algoId);
    if (!algo) return;
    
    highlightedEdges = new Set();
    visitedNodes = new Set();
    
    const selectedNode = selectCentralNode(graph, bbox);
    sourceNode = { lat: selectedNode.lat, lon: selectedNode.lon };
    
    showRootGlow = true;
    startRippleAnimation();
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500));
    
    const speed = 20 + Math.floor(Math.random() * 30);
    
    console.log(`Running ${algo.name} at ${speed}ms delay from central node`);
    
    try {
      for await (const step of algo.run(graph, { 
        delayMs: speed, 
        source: selectedNode.id 
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
    
    showRootGlow = false;
    rippleAnimations = [];
    highlightedEdges = new Set();
    visitedNodes = new Set();
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
      sourcePin={null}
      sinkPin={null}
      sinkReachable={false}
      onPinDrag={() => {}}
    />

    {#if showRootGlow && sourceNode}
      {@const x = ((sourceNode.lon - bbox.west) / (bbox.east - bbox.west)) * CANVAS_WIDTH}
      {@const y = ((bbox.north - sourceNode.lat) / (bbox.north - bbox.south)) * CANVAS_HEIGHT}
      {@const scale = Math.max(0.4, Math.min(2.5, 1000 / currentRadius))}
      
      <div class="absolute z-30 pointer-events-none" style="left: {x}px; top: {y}px; transform: translate(-50%, -50%) scale({scale});">
        <div class="root-glow"></div>
        
        {#each rippleAnimations as ripple (ripple.id)}
          <div class="ripple"></div>
        {/each}
      </div>
    {/if}
    
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

  .root-glow {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: radial-gradient(circle, #fbbf24, #f59e0b);
    box-shadow: 0 0 30px #fbbf24, 0 0 60px #f59e0b;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  .ripple {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #fbbf24;
    animation: ripple-expand 3.2s ease-out forwards;
    pointer-events: none;
  }

  @keyframes pulse-glow {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.8;
    }
  }

  @keyframes ripple-expand {
    0% {
      width: 24px;
      height: 24px;
      opacity: 1;
      border-width: 2px;
    }
    100% {
      width: 200px;
      height: 200px;
      opacity: 0;
      border-width: 1px;
    }
  }
</style>
