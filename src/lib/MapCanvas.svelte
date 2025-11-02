<script lang="ts">
  import { onMount } from 'svelte';
  import type { Element, Graph, BoundingBox, Point } from '../types';

  interface Props {
    bbox: BoundingBox;
    graph: Graph | null;
    buildings: Element[];
    highlightedEdges: Set<string>;
    CANVAS_WIDTH: number;
    CANVAS_HEIGHT: number;
    sourcePin: { nodeId: string; lat: number; lon: number } | null;
    sinkPin: { nodeId: string; lat: number; lon: number } | null;
    sinkReachable: boolean;
    onPinDrag: (pinType: 'source' | 'sink', lat: number, lon: number) => void;
  }

  let { bbox, graph, buildings, highlightedEdges, CANVAS_WIDTH, CANVAS_HEIGHT, sourcePin, sinkPin, sinkReachable, onPinDrag }: Props = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let offscreenCanvas: HTMLCanvasElement | null = null;
  let offscreenCtx: CanvasRenderingContext2D | null = null;
  let draggingPin = $state<'source' | 'sink' | null>(null);
  let staticLayerRendered = false;

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

  function drawWay(way: Element, color: string, lineWidth: number = 2, fill: boolean = false) {
    if (!ctx || !way.geometry || way.geometry.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    way.geometry.forEach((point, i) => {
      const x = lonToX(point.lon);
      const y = latToY(point.lat);

      if (i === 0) {
        ctx!.moveTo(x, y);
      } else {
        ctx!.lineTo(x, y);
      }
    });

    if (fill && way.tags?.building) {
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    ctx.stroke();
  }

  function drawEdge(geometry: Point[], color: string, lineWidth: number = 2, withBloom: boolean = false) {
    if (!ctx || geometry.length < 2) return;

    if (withBloom) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    geometry.forEach((point, i) => {
      const x = lonToX(point.lon);
      const y = latToY(point.lat);

      if (i === 0) {
        ctx!.moveTo(x, y);
      } else {
        ctx!.lineTo(x, y);
      }
    });

    ctx.stroke();

    if (withBloom) {
      ctx.shadowBlur = 0;
    }
  }

  function renderStaticLayer() {
    if (!offscreenCanvas || !offscreenCtx) return;

    offscreenCtx.fillStyle = '#0a0a0a';
    offscreenCtx.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    const originalCtx = ctx;
    ctx = offscreenCtx;

    buildings.forEach(building => {
      drawWay(building, '#1a1a1a', 1, true);
    });

    if (graph) {
      graph.edges.forEach(edge => {
        drawEdge(edge.way.geometry, '#333', 2, false);
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

    if (graph) {
      graph.edges.forEach(edge => {
        if (highlightedEdges.has(edge.id)) {
          drawEdge(edge.way.geometry, '#ff6b35', 3, true);
        }
      });
    }

    if (sourcePin) {
      const x = lonToX(sourcePin.lon);
      const y = latToY(sourcePin.lat);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#22c55e';
      ctx.fillText('source', x + 10, y - 10);
    }

    if (sinkPin) {
      const x = lonToX(sinkPin.lon);
      const y = latToY(sinkPin.lat);
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

  function handleMouseDown(e: MouseEvent) {
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

  $effect(() => {
    if (ctx) {
      render();
    }
  });

  $effect(() => {
    graph;
    buildings;
    staticLayerRendered = false;
  });
</script>

<canvas
  bind:this={canvas}
  width={CANVAS_WIDTH}
  height={CANVAS_HEIGHT}
  class="border border-zinc-800 cursor-pointer"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  onmouseleave={handleMouseUp}
></canvas>
