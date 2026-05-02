<script lang="ts">
  import { onMount } from 'svelte';
  import MapCanvas from './lib/MapCanvas.svelte';
  import AlgorithmDrawer from './lib/AlgorithmDrawer.svelte';
  import { calculateBbox, fetchOSMData } from './lib/overpass';
  import { buildGraph } from './lib/graph';
  import { pickVisiblePins } from './lib/pins';
  import { algorithms, getAlgorithmViewportScale } from './algos/registry';
  import type { BoundingBox, Graph, Element } from './types';

  const CENTER_LAT = 30.631127;
  const CENTER_LON = -96.355140;
  const BASE_MAP_RADIUS = 1000;
  const screensaverPath = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/screensaver`;
  let CANVAS_WIDTH = $state(window.innerWidth);
  let CANVAS_HEIGHT = $state(window.innerHeight);

  let graph = $state<Graph | null>(null);
  let buildings = $state<Element[]>([]);
  let water = $state<Element[]>([]);
  let highlightedEdges = $state(new Set<string>());
  let visitedNodes = $state(new Set<string>());
  let edgeFreshness = $state(new Map<string, number>());
  let currentMapRadius = $state(BASE_MAP_RADIUS);
  let bbox = $state<BoundingBox>(calculateBbox(CENTER_LAT, CENTER_LON, window.innerWidth, window.innerHeight, BASE_MAP_RADIUS));
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

  async function loadData(radius = currentMapRadius) {
    try {
      loading = true;
      error = null;
      currentMapRadius = radius;
      
      bbox = calculateBbox(CENTER_LAT, CENTER_LON, CANVAS_WIDTH, CANVAS_HEIGHT, radius);
      const data = await fetchOSMData(bbox);
      
      const highways = data.elements.filter(el => el.tags?.highway);
      const buildingsList = data.elements.filter(el => el.tags?.building);
      const waterList = data.elements.filter(el => el.tags?.natural === 'water' || el.tags?.waterway || el.tags?.landuse === 'reservoir');
      
      graph = buildGraph(highways);
      buildings = buildingsList;
      water = waterList;
      
      initializePins();
      
      console.log(`Loaded ${graph.nodes.size} nodes, ${graph.edges.length} edges, ${buildingsList.length} buildings, ${waterList.length} water features`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load data';
      console.error(e);
    } finally {
      loading = false;
    }
  }

  let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
  let initialLoad = true;
  let previousVisibleEdges = new Set<string>();
  
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

  function expandEdgeIds(edgeIds: Set<string>): Set<string> {
    const expanded = new Set<string>();
    if (!graph) return expanded;

    const edgeById = new Map(graph.edges.map(edge => [edge.id, edge]));
    for (const edgeId of edgeIds) {
      expanded.add(edgeId);
      const edge = edgeById.get(edgeId);
      if (edge?.subEdges) {
        for (const subEdgeId of edge.subEdges) {
          expanded.add(subEdgeId);
        }
      }
    }

    return expanded;
  }

  function updateHighlightedEdges(nextEdges: Set<string>) {
    const nextFreshness = new Map(edgeFreshness);
    const now = performance.now();

    for (const edgeId of expandEdgeIds(nextEdges)) {
      if (!nextFreshness.has(edgeId)) {
        nextFreshness.set(edgeId, now);
      }
    }

    for (const [edgeId, born] of nextFreshness) {
      if (now - born > 14000) {
        nextFreshness.delete(edgeId);
      }
    }

    edgeFreshness = nextFreshness;
    highlightedEdges = nextEdges;
  }
  
  async function runAlgorithm(algoId: string) {
    if (!graph || algorithmRunning) return;
    
    const algo = algorithms.find(a => a.id === algoId);
    if (!algo) return;

    const targetRadius = Math.round(BASE_MAP_RADIUS * getAlgorithmViewportScale(algo.id));
    if (targetRadius !== currentMapRadius) {
      await loadData(targetRadius);
    }

    if (!graph) return;

    const pins = pickVisiblePins(graph, {
      bbox,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      requiresSink: algo.requiresSink,
      algorithmId: algo.id
    });
    sourcePin = pins.source;
    sinkPin = pins.sink;
    sinkReachable = pins.reachable;
    
    selectedAlgoId = algoId;
    algorithmRunning = true;
    algorithmPaused = false;
    shouldStop = false;
    highlightedEdges = new Set();
    visitedNodes = new Set();
    edgeFreshness = new Map();
    previousVisibleEdges = new Set();
    
    console.log(`Starting ${algo.name}, total edges:`, graph.edges.length);
    
    try {
      for await (const step of algo.run(graph, { 
        delayMs: 50, 
        source: sourcePin?.nodeId,
        sink: sinkPin?.nodeId 
      })) {
        if (shouldStop) break;
        
        const visibleEdges = expandEdgeIds(step.visitedEdges);
        const hasEdgeChange =
          visibleEdges.size !== previousVisibleEdges.size ||
          Array.from(visibleEdges).some(edgeId => !previousVisibleEdges.has(edgeId));

        if (hasEdgeChange) {
          previousVisibleEdges = visibleEdges;
          updateHighlightedEdges(step.visitedEdges);
        }

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
    edgeFreshness = new Map();
    previousVisibleEdges = new Set();
    if (pauseResolve) {
      pauseResolve();
      pauseResolve = null;
    }
  }

  function initializePins() {
    if (!graph) return;

    const pins = pickVisiblePins(graph, {
      bbox,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      requiresSink: true,
      algorithmId: selectedAlgoId ?? undefined
    });

    sourcePin = pins.source;
    sinkPin = pins.sink;
    sinkReachable = pins.reachable;
  }

  function findNearestNode(lat: number, lon: number): { nodeId: string; lat: number; lon: number } | null {
    if (!graph) return null;

    let nearestNode = null;
    let minDist = Infinity;

    for (const node of graph.nodes.values()) {
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

  <div class="absolute right-2 top-2 flex flex-col items-end gap-2">
      <button 
      onclick={() => window.open(screensaverPath, '_blank')}
      class="px-3 py-1.5 text-sm bg-gradient-to-r from-indigo-600/20 to-purple-600/20 hover:from-indigo-600/30 hover:to-purple-600/30 backdrop-blur-sm text-white rounded border border-indigo-500/30 transition-all"
    >
      Screensaver Builder
    </button>
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
      {water}
      {highlightedEdges}
      {edgeFreshness}
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
