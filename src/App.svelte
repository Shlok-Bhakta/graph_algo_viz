<script lang="ts">
  import { onMount } from 'svelte';
  import MapCanvas from './lib/MapCanvas.svelte';
  import AlgorithmDrawer from './lib/AlgorithmDrawer.svelte';
  import { calculateBbox, fetchOSMData } from './lib/overpass';
  import { buildGraph } from './lib/graph';
  import { algorithms } from './algos/registry';
  import type { BoundingBox, Graph, Element } from './types';

  const CENTER_LAT = 30.631127;
  const CENTER_LON = -96.355140;
  let CANVAS_WIDTH = $state(screen.width);
  let CANVAS_HEIGHT = $state(screen.height);

  let graph = $state<Graph | null>(null);
  let buildings = $state<Element[]>([]);
  let highlightedEdges = $state(new Set<string>());
  let visitedNodes = $state(new Set<string>());
  let bbox = $state<BoundingBox>(calculateBbox(CENTER_LAT, CENTER_LON, CANVAS_WIDTH, CANVAS_HEIGHT, 2000));
  let loading = $state(true);
  let error = $state<string | null>(null);
  let algorithmRunning = $state(false);
  let algorithmPaused = $state(false);
  let drawerOpen = $state(false);
  let selectedAlgoId = $state<string | null>(null);
  let pauseResolve: (() => void) | null = null;
  let showFlash = $state(false);
  let sourcePin = $state<{ nodeId: string; lat: number; lon: number } | null>(null);
  let sinkPin = $state<{ nodeId: string; lat: number; lon: number } | null>(null);
  let sinkReachable = $state(false);

  async function loadData() {
    try {
      loading = true;
      error = null;
      
      bbox = calculateBbox(CENTER_LAT, CENTER_LON, CANVAS_WIDTH, CANVAS_HEIGHT, 2000);
      const data = await fetchOSMData(bbox);
      
      const highways = data.elements.filter(el => el.tags?.highway);
      const buildingsList = data.elements.filter(el => el.tags?.building);
      
      graph = buildGraph(highways);
      buildings = buildingsList;
      
      initializePins();
      
      console.log(`Loaded ${graph.nodes.size} nodes, ${graph.edges.length} edges, ${buildingsList.length} buildings`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  let initialLoad = true;
  
  $effect(() => {
    CANVAS_WIDTH;
    CANVAS_HEIGHT;
    
    if (initialLoad) {
      initialLoad = false;
      return;
    }
    
    if (resizeTimeout) clearTimeout(resizeTimeout);
    
    resizeTimeout = setTimeout(() => {
      loadData();
    }, 500);
  });

  let shouldStop = false;
  
  async function runAlgorithm(algoId: string) {
    if (!graph || algorithmRunning) return;
    
    const algo = algorithms.find(a => a.id === algoId);
    if (!algo) return;
    
    selectedAlgoId = algoId;
    algorithmRunning = true;
    algorithmPaused = false;
    shouldStop = false;
    highlightedEdges = new Set();
    visitedNodes = new Set();
    
    console.log(`Starting ${algo.name}, total edges:`, graph.edges.length);
    
    try {
      for await (const step of algo.run(graph, { 
        delayMs: 50, 
        source: sourcePin?.nodeId,
        sink: sinkPin?.nodeId 
      })) {
        if (shouldStop) break;
        
        highlightedEdges = step.visitedEdges;
        visitedNodes = step.visitedNodes;
        
        while (algorithmPaused && !shouldStop) {
          await new Promise<void>(resolve => {
            pauseResolve = resolve;
          });
        }
      }
      
      console.log('Finished, visited edges:', highlightedEdges.size, 'visited nodes:', visitedNodes.size);
      
      if (!shouldStop) {
        showFlash = true;
        setTimeout(() => showFlash = false, 300);
      }
    } finally {
      algorithmRunning = false;
    }
  }
  
  function togglePause() {
    algorithmPaused = !algorithmPaused;
    if (!algorithmPaused && pauseResolve) {
      pauseResolve();
      pauseResolve = null;
    }
  }
  
  function resetAlgorithm() {
    shouldStop = true;
    algorithmRunning = false;
    algorithmPaused = false;
    selectedAlgoId = null;
    highlightedEdges = new Set();
    visitedNodes = new Set();
    if (pauseResolve) {
      pauseResolve();
      pauseResolve = null;
    }
  }

  function initializePins() {
    if (!graph) return;

    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLon = (bbox.east + bbox.west) / 2;

    const nodeArray = Array.from(graph.nodes.values());
    if (nodeArray.length < 2) return;

    const isInBounds = (node: typeof nodeArray[0]) => {
      return node.lat >= bbox.south && 
             node.lat <= bbox.north && 
             node.lon >= bbox.west && 
             node.lon <= bbox.east;
    };

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

    const visited = new Set<string>();
    const stack: string[] = [sourceNode.id];
    visited.add(sourceNode.id);
    const candidates: typeof sourceNode[] = [];
    
    while (stack.length > 0 && visited.size < 50) {
      const currentId = stack.pop()!;
      const currentNode = graph.nodes.get(currentId);
      if (!currentNode) continue;
      
      if (isInBounds(currentNode) && visited.size > 10) {
        candidates.push(currentNode);
      }
      
      for (const edge of currentNode.edges) {
        const neighborNode = graph.nodes.get(edge.to);
        if (!visited.has(edge.to) && neighborNode && isInBounds(neighborNode)) {
          visited.add(edge.to);
          stack.push(edge.to);
        }
      }
    }
    
    const sinkNode = candidates.length > 0 
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : sourceNode;
    
    sourcePin = { nodeId: sourceNode.id, lat: sourceNode.lat, lon: sourceNode.lon };
    sinkPin = { nodeId: sinkNode.id, lat: sinkNode.lat, lon: sinkNode.lon };
    sinkReachable = checkReachability(sourceNode.id, sinkNode.id);
  }

  function findNearestNode(lat: number, lon: number): { nodeId: string; lat: number; lon: number } | null {
    if (!graph) return null;

    const nodesToSearch = graph._raw?.nodes || graph.nodes;
    let nearestNode = null;
    let minDist = Infinity;

    for (const node of nodesToSearch.values()) {
      const dist = Math.sqrt((node.lat - lat) ** 2 + (node.lon - lon) ** 2);
      if (dist < minDist) {
        minDist = dist;
        nearestNode = node;
      }
    }

    return nearestNode ? { nodeId: nearestNode.id, lat: nearestNode.lat, lon: nearestNode.lon } : null;
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

  function handlePinDrag(pinType: 'source' | 'sink', lat: number, lon: number) {
    const nearest = findNearestNode(lat, lon);
    if (!nearest) return;

    if (pinType === 'source') {
      sourcePin = nearest;
    } else {
      sinkPin = nearest;
    }

    if (sourcePin && sinkPin) {
      sinkReachable = checkReachability(sourcePin.nodeId, sinkPin.nodeId);
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<svelte:window bind:innerWidth={CANVAS_WIDTH} bind:innerHeight={CANVAS_HEIGHT} />

<div class="bg-zinc-950 w-screen h-screen flex flex-col items-center justify-center relative">
  {#if showFlash}
    <div class="absolute inset-0 bg-white pointer-events-none" style="animation: flash 300ms ease-out;"></div>
  {/if}
  <div class="absolute left-2 top-2 text-xs text-white/40 bg-white/5 backdrop-blur-sm border border-white/10 rounded px-2 py-1">
    {CENTER_LAT.toFixed(6)}, {CENTER_LON.toFixed(6)}
  </div>

  <div class="absolute right-2 top-2 flex flex-col items-end gap-1">
    <button 
      onclick={initializePins}
      class="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded border border-white/20 transition-colors"
    >
      Reroll Sink
    </button>
    <div class="text-xs text-white/40">
      (use if sink is not visible)
    </div>
  </div>

  {#if loading}
    <div class="text-white/80 text-sm bg-white/5 backdrop-blur-sm border border-white/10 rounded px-4 py-2">
      Loading OSM data...
    </div>
  {:else if error}
    <div class="text-red-400 text-sm bg-red-500/10 backdrop-blur-sm border border-red-500/20 rounded px-4 py-2">
      {error}
    </div>
  {:else if graph}
    <MapCanvas 
      {bbox}
      {graph}
      {buildings}
      {highlightedEdges}
      {CANVAS_WIDTH}
      {CANVAS_HEIGHT}
      {sourcePin}
      {sinkPin}
      {sinkReachable}
      onPinDrag={handlePinDrag}
    />
    
    <div class="absolute right-2 bottom-2">
      {#if algorithmRunning || selectedAlgoId}
        <div class="text-right text-xs text-white/80 bg-white/5 backdrop-blur-sm border border-white/10 rounded px-2 py-1">
          {visitedNodes.size} / {graph.nodes.size} nodes • {highlightedEdges.size} / {graph.edges.length} edges
        </div>
      {:else}
        <div class="text-right text-xs text-white/60 bg-white/5 backdrop-blur-sm border border-white/10 rounded px-2 py-1">
          {graph.nodes.size} nodes • {graph.edges.length} edges
        </div>
      {/if}
    </div>
    
    <div class="absolute left-2 bottom-2 flex gap-2">
      {#if !selectedAlgoId}
        <button 
          onclick={() => drawerOpen = !drawerOpen}
          class="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded border border-white/20 transition-colors"
        >
          Select Algorithm
        </button>
      {:else}
        <button 
          onclick={() => drawerOpen = !drawerOpen}
          class="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded border border-white/20 transition-colors"
        >
          New
        </button>
        
        {#if algorithmRunning}
          <button 
            onclick={togglePause}
            class="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded border border-white/20 transition-colors"
          >
            {algorithmPaused ? 'Play' : 'Pause'}
          </button>
        {/if}
        
        <button 
          onclick={resetAlgorithm}
          class="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded border border-white/20 transition-colors"
        >
          Reset
        </button>
      {/if}
    </div>
    
    <AlgorithmDrawer 
      isOpen={drawerOpen}
      onClose={() => drawerOpen = false}
      onSelectAlgorithm={(algoId) => runAlgorithm(algoId)}
    />
  {/if}
</div>
