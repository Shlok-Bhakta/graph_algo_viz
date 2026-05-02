<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { Element, Graph, BoundingBox, Point, CanvasTheme, Edge } from '../types';

  interface Props {
    bbox: BoundingBox;
    graph: Graph | null;
    buildings: Element[];
    water: Element[];
    highlightedEdges: Set<string>;
    CANVAS_WIDTH: number;
    CANVAS_HEIGHT: number;
    sourcePin: { nodeId: string; lat: number; lon: number } | null;
    sinkPin: { nodeId: string; lat: number; lon: number } | null;
    sinkReachable: boolean;
    onPinDrag: (pinType: 'source' | 'sink', lat: number, lon: number) => void;
    zenMode?: boolean;
    canvasTheme?: CanvasTheme;
    edgeFreshness?: Map<string, number>;
    focusPath?: boolean;
    pathFlashKey?: number;
  }

  let {
    bbox,
    graph,
    buildings,
    water,
    highlightedEdges,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    sourcePin,
    sinkPin,
    sinkReachable,
    onPinDrag,
    zenMode = false,
    canvasTheme = {
      background: ['#050302', '#050302', '#020101'],
      road: '#24100a',
      building: '#0c0503',
      water: '#000000',
      highlight: '#d97706',
      highlightHot: '#fed7aa',
      source: '#ea580c',
      sink: '#eab308',
      focusBackground: '#100604'
    },
    edgeFreshness = new Map<string, number>(),
    focusPath = false,
    pathFlashKey = 0
  }: Props = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let draggingPin = $state<'source' | 'sink' | null>(null);
  let staticLayerRendered = false;
  let subEdgeCache = new Map<string, string[]>();
  let edgeByIdCache = new Map<string, Edge>();
  let rawEdgeByIdCache = new Map<string, Edge>();
  let projectedGeometryCache = new Map<string, ProjectedGeometry>();
  let highlightRenderCacheKey = '';
  let highlightRenderCache: Edge[] = [];
  let focusedRenderCacheKey = '';
  let focusedRenderCache: Edge[] = [];
  let previousFlashKey = 0;
  let focusRevealStart = 0;
  let animationFrame: number | null = null;

  const FOCUS_REVEAL_MS = 1600;
  const EDGE_REVEAL_MS = 360;

  interface ProjectedPoint {
    x: number;
    y: number;
  }

  interface ProjectedGeometry {
    points: ProjectedPoint[];
    path: Path2D;
    segmentLengths: number[];
    totalLength: number;
  }

  function latToY(lat: number): number {
    return ((bbox.north - lat) / (bbox.north - bbox.south)) * canvas.height;
  }

  function lonToX(lon: number): number {
    return ((lon - bbox.west) / (bbox.east - bbox.west)) * canvas.width;
  }

  function xToLon(x: number): number {
    return bbox.west + (x / canvas.width) * (bbox.east - bbox.west);
  }

  function yToLat(y: number): number {
    return bbox.north - (y / canvas.height) * (bbox.north - bbox.south);
  }

  function wayPath(way: Element): Path2D | null {
    if (!ctx || !way.geometry || way.geometry.length < 2) return null;

    const path = new Path2D();

    way.geometry.forEach((point, i) => {
      const x = lonToX(point.lon);
      const y = latToY(point.lat);

      if (i === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    });

    return path;
  }

  function drawWay(way: Element, color: string, lineWidth: number = 2, fill: boolean = false) {
    if (!ctx || !way.geometry || way.geometry.length < 2) return;

    const path = wayPath(way);
    if (!path) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    if (fill && way.geometry.length > 2) {
      path.closePath();
      ctx.fillStyle = color;
      ctx.fill(path);
    }

    ctx.stroke(path);
  }

  function drawWaterFeature(way: Element, isLinear: boolean) {
    if (!ctx || !way.geometry || way.geometry.length < 2) return;

    if (isLinear || way.geometry.length <= 2) {
      drawWay(way, canvasTheme.water, 2.2);
      return;
    }

    const path = wayPath(way);
    if (!path) return;

    path.closePath();
    ctx.save();
    ctx.fillStyle = canvasTheme.water;
    ctx.fill(path);
    ctx.clip(path);

    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = canvasTheme.highlight;
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';

    const spacing = 10;
    const diagonalLength = Math.max(canvas.width, canvas.height) * 1.6;
    for (let x = -diagonalLength; x < canvas.width + diagonalLength; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, canvas.height + spacing);
      ctx.lineTo(x + diagonalLength, canvas.height - diagonalLength + spacing);
      ctx.stroke();
    }

    ctx.restore();
    ctx.strokeStyle = canvasTheme.water;
    ctx.lineWidth = 1;
    ctx.stroke(path);
  }

  function pathForGeometry(geometry: Point[] | ProjectedPoint[]): Path2D {
    const path = new Path2D();
    geometry.forEach((point, i) => {
      const x = 'x' in point ? point.x : lonToX(point.lon);
      const y = 'y' in point ? point.y : latToY(point.lat);
      if (i === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    });
    return path;
  }

  function projectedGeometry(cacheId: string, geometry: Point[]): ProjectedGeometry | null {
    if (geometry.length < 2) return null;

    const cached = projectedGeometryCache.get(cacheId);
    if (cached) return cached;

    const points = geometry.map(point => ({ x: lonToX(point.lon), y: latToY(point.lat) }));
    const projected = projectedFromPoints(points);
    projectedGeometryCache.set(cacheId, projected);
    return projected;
  }

  function projectedFromPoints(points: ProjectedPoint[]): ProjectedGeometry {
    const segmentLengths: number[] = [];
    let totalLength = 0;
    const path = pathForGeometry(points);

    for (let i = 1; i < points.length; i++) {
      const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      segmentLengths.push(length);
      totalLength += length;
    }

    return { points, path, segmentLengths, totalLength };
  }

  function easeOutCubic(t: number): number {
    return 1 - (1 - t) ** 3;
  }

  function pointDistance(a: Point | ProjectedPoint, b: Point | ProjectedPoint): number {
    const x1 = 'x' in a ? a.x : lonToX(a.lon);
    const y1 = 'y' in a ? a.y : latToY(a.lat);
    const x2 = 'x' in b ? b.x : lonToX(b.lon);
    const y2 = 'y' in b ? b.y : latToY(b.lat);
    return Math.hypot(x2 - x1, y2 - y1);
  }

  function continuousProjectedGeometry(edges: Edge[]): ProjectedGeometry | null {
    const points: ProjectedPoint[] = [];

    for (const edge of edges) {
      const projected = projectedGeometry(edge.id, edge.way.geometry);
      if (!projected) continue;
      const geometry = projected.points;

      if (points.length === 0) {
        points.push(...geometry);
        continue;
      }

      const last = points[points.length - 1];
      const forwardDistance = pointDistance(last, geometry[0]);
      const reverseDistance = pointDistance(last, geometry[geometry.length - 1]);
      const segment = reverseDistance < forwardDistance ? [...geometry].reverse() : geometry;
      points.push(...segment.slice(pointDistance(last, segment[0]) < 0.5 ? 1 : 0));
    }

    if (points.length < 2) return null;

    const cached = projectedGeometryCache.get('__focus__');
    if (cached) return cached;

    const projected = projectedFromPoints(points);
    projectedGeometryCache.set('__focus__', projected);
    return projected;
  }

  function drawProjectedDistance(projected: ProjectedGeometry | null, targetLength: number, color: string, lineWidth: number, alpha: number, blur: number) {
    if (!ctx || !projected || targetLength <= 0 || projected.totalLength <= 0) return;

    let remaining = Math.min(projected.totalLength, targetLength);
    const { points, segmentLengths } = projected;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const segmentLength = segmentLengths[i - 1];
      if (remaining >= segmentLength) {
        ctx.lineTo(points[i].x, points[i].y);
        remaining -= segmentLength;
        continue;
      }

      const t = segmentLength === 0 ? 0 : remaining / segmentLength;
      ctx.lineTo(
        points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        points[i - 1].y + (points[i].y - points[i - 1].y) * t
      );
      break;
    }

    ctx.stroke();
    ctx.restore();
  }

  function highlightedEdgesKey(): string {
    return `${highlightedEdges.size}:${Array.from(highlightedEdges).join('|')}`;
  }

  function highlightedRenderEdges(): Edge[] {
    const key = highlightedEdgesKey();
    if (key === highlightRenderCacheKey) return highlightRenderCache;

    const edges: Edge[] = [];
    const seen = new Set<string>();
    for (const edgeId of highlightedEdges) {
      const ids = [edgeId, ...(subEdgeCache.get(edgeId) ?? [])];
      for (const id of ids) {
        if (seen.has(id)) continue;
        const edge = rawEdgeByIdCache.get(id) ?? edgeByIdCache.get(id);
        if (!edge) continue;
        seen.add(id);
        edges.push(edge);
      }
    }

    edges.sort((a, b) => (edgeFreshness.get(a.id) ?? 0) - (edgeFreshness.get(b.id) ?? 0));
    highlightRenderCacheKey = key;
    highlightRenderCache = edges;
    return edges;
  }

  function focusedRenderEdges(): Edge[] {
    const key = highlightedEdgesKey();
    if (key === focusedRenderCacheKey) return focusedRenderCache;

    const edges: Edge[] = [];
    for (const edgeId of highlightedEdges) {
      const edge = edgeByIdCache.get(edgeId);
      if (edge) edges.push(edge);
    }

    focusedRenderCacheKey = key;
    focusedRenderCache = edges;
    projectedGeometryCache.delete('__focus__');
    return edges;
  }

  function scheduleRender() {
    if (animationFrame !== null) return;
    animationFrame = requestAnimationFrame(() => {
      animationFrame = null;
      render();
    });
  }

  function renderStaticLayer() {
    if (!offscreenCanvas || !offscreenCtx) return;
    const targetCtx = offscreenCtx;

    targetCtx.fillStyle = canvasTheme.background[0];
    targetCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    const originalCtx = ctx;
    ctx = targetCtx;

    water.forEach(waterFeature => {
      const isLinear = Boolean(waterFeature.tags?.waterway);
      drawWaterFeature(waterFeature, isLinear);
    });

    buildings.forEach(building => {
      drawWay(building, canvasTheme.building, 1, true);
    });

    if (graph) {
      const renderEdges = graph._raw?.edges || graph.edges;
      renderEdges.forEach(edge => {
        const projected = projectedGeometry(edge.id, edge.way.geometry);
        if (!projected) return;
        targetCtx.save();
        targetCtx.globalAlpha = 0.62;
        targetCtx.strokeStyle = canvasTheme.road;
        targetCtx.lineWidth = 1.6;
        targetCtx.stroke(projected.path);
        targetCtx.restore();
      });
    }

    ctx = originalCtx;
    staticLayerRendered = true;
  }

  function render() {
    if (!ctx || !canvas) return;

    if (!staticLayerRendered && offscreenCanvas) {
      renderStaticLayer();
    }

    if (offscreenCanvas && staticLayerRendered) {
      ctx.drawImage(offscreenCanvas, 0, 0);
    }

    if (pathFlashKey !== previousFlashKey) {
      previousFlashKey = pathFlashKey;
      ctx.save();
      ctx.fillStyle = canvasTheme.highlightHot;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    if (graph) {
      const now = performance.now();
      const activeEdges = focusPath
        ? focusedRenderEdges()
        : highlightedRenderEdges();
      const revealElapsed = focusPath ? now - focusRevealStart : FOCUS_REVEAL_MS;
      const revealProgress = Math.min(1, revealElapsed / FOCUS_REVEAL_MS);
      const focusedGeometry = focusPath ? continuousProjectedGeometry(activeEdges) : null;

      if (focusPath) {
        const visibleLength = (focusedGeometry?.totalLength ?? 0) * revealProgress;
        drawProjectedDistance(focusedGeometry, visibleLength, canvasTheme.highlight, 6.2, 0.18, 26);
        drawProjectedDistance(focusedGeometry, visibleLength, canvasTheme.highlightHot, 4.2, 0.92, 22);
      }

      activeEdges.forEach((edge) => {
          const born = edgeFreshness.get(edge.id);
          const age = born === undefined ? Infinity : Math.max(0, now - born);
          const pulse = focusPath ? 1 : Math.max(0, 1 - age / 450);
          const alpha = focusPath ? 0.96 : 0.62 + pulse * 0.28;
          const width = focusPath ? 4.2 : 2.2 + pulse * 0.9;
          const blur = focusPath ? 22 : pulse * 16;

          if (focusPath) {
            return;
          }

          const projected = projectedGeometry(edge.id, edge.way.geometry);
          const edgeProgress = easeOutCubic(Math.min(1, age / EDGE_REVEAL_MS));
          const visibleLength = (projected?.totalLength ?? 0) * edgeProgress;
          if (pulse > 0) {
            drawProjectedDistance(projected, visibleLength, canvasTheme.highlightHot, width + 2, pulse * 0.18, blur + 4);
            scheduleRender();
          }
          drawProjectedDistance(projected, visibleLength, pulse > 0.35 ? canvasTheme.highlightHot : canvasTheme.highlight, width, alpha, blur);
      });

      const hasAnimatingEdges = !focusPath && activeEdges.some(edge => {
        const born = edgeFreshness.get(edge.id);
        return born !== undefined && now - born < EDGE_REVEAL_MS;
      });
      if ((focusPath && revealProgress < 1) || hasAnimatingEdges) scheduleRender();
    }

    if (sourcePin) {
      const x = lonToX(sourcePin.lon);
      const y = latToY(sourcePin.lat);
      
      if (zenMode) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = canvasTheme.source;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
        gradient.addColorStop(0, canvasTheme.highlightHot);
        gradient.addColorStop(1, canvasTheme.source);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.font = '10px sans-serif';
        ctx.fillStyle = '#22c55e';
        ctx.fillText('source', x + 10, y - 10);
      }
    }

    if (sinkPin) {
      const x = lonToX(sinkPin.lon);
      const y = latToY(sinkPin.lat);
      
      if (zenMode) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = canvasTheme.sink;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 12);
        gradient.addColorStop(0, canvasTheme.highlightHot);
        gradient.addColorStop(1, canvasTheme.sink);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        const sinkColor = sinkReachable ? '#3b82f6' : '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = sinkColor;
        ctx.fill();
        ctx.font = '10px sans-serif';
        ctx.fillStyle = sinkColor;
        ctx.fillText('sink', x + 10, y - 10);
      }
    }
  }

  function handleMouseDown(e: MouseEvent) {
    if (zenMode) return;
    if (!canvas || !sourcePin || !sinkPin) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sourceX = lonToX(sourcePin.lon);
    const sourceY = latToY(sourcePin.lat);
    const sinkX = lonToX(sinkPin.lon);
    const sinkY = latToY(sinkPin.lat);

    const distToSource = Math.sqrt((x - sourceX) ** 2 + (y - sourceY) ** 2);
    const distToSink = Math.sqrt((x - sinkX) ** 2 + (y - sinkY) ** 2);

    if (distToSource < 15) {
      draggingPin = 'source';
    } else if (distToSink < 15) {
      draggingPin = 'sink';
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!draggingPin || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lat = yToLat(y);
    const lon = xToLon(x);

    onPinDrag(draggingPin, lat, lon);
  }

  function handleMouseUp() {
    draggingPin = null;
  }

  onMount(() => {
    ctx = canvas.getContext('2d');
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = CANVAS_WIDTH;
    offscreenCanvas.height = CANVAS_HEIGHT;
    offscreenCtx = offscreenCanvas.getContext('2d');
    render();
  });

  onDestroy(() => {
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
    }
  });

  $effect(() => {
    if (ctx) {
      render();
    }
  });

  $effect(() => {
    focusPath;
    pathFlashKey;
    focusRevealStart = performance.now();
    scheduleRender();
  });

  $effect(() => {
    graph;
    buildings;
    water;
    canvasTheme;
    bbox;
    CANVAS_WIDTH;
    CANVAS_HEIGHT;
    if (offscreenCanvas) {
      offscreenCanvas.width = CANVAS_WIDTH;
      offscreenCanvas.height = CANVAS_HEIGHT;
    }
    staticLayerRendered = false;
    projectedGeometryCache.clear();
    highlightRenderCacheKey = '';
    highlightRenderCache = [];
    focusedRenderCacheKey = '';
    focusedRenderCache = [];
    
    // Rebuild sub-edge cache when graph changes
    subEdgeCache.clear();
    edgeByIdCache.clear();
    rawEdgeByIdCache.clear();
    if (graph) {
      for (const edge of graph.edges) {
        edgeByIdCache.set(edge.id, edge);
        if (edge.subEdges) {
          subEdgeCache.set(edge.id, edge.subEdges);
        }
      }
      for (const edge of graph._raw?.edges ?? []) {
        rawEdgeByIdCache.set(edge.id, edge);
      }
    }
  });
</script>

<canvas
  bind:this={canvas}
  width={CANVAS_WIDTH}
  height={CANVAS_HEIGHT}
  class="map-canvas"
  class:border-zinc-800={!zenMode}
  class:border-transparent={zenMode}
  class:cursor-pointer={!zenMode}
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
></canvas>

<style>
  .map-canvas {
    border-width: 1px;
    display: block;
  }
</style>
