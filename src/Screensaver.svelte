<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import MapCanvas from './lib/MapCanvas.svelte';
  import { getAlgorithmById } from './algos/registry';
  import {
    buildScreensaverUrl,
    animationDelayForRadius,
    chooseAlgorithmId,
    chooseTheme,
    defaultScreensaverSettings,
    holdDurationForRadius,
    parseScreensaverSettings,
    pickPins,
    playableAlgorithms,
    prepareRandomLocation,
    recordFreshEdges,
    screensaverLocations,
    screensaverThemes,
    type PreparedLocation,
    type ScreensaverSettings
  } from './screensaver/config';
  import type { AlgorithmStep } from './algos/types';
  import type { BoundingBox, Element, Graph } from './types';

  let settings = $state<ScreensaverSettings>(parseScreensaverSettings());
  let builderSettings = $state<ScreensaverSettings>({ ...parseScreensaverSettings(), play: true });
  let width = $state(window.innerWidth);
  let height = $state(window.innerHeight);
  let graph = $state<Graph | null>(null);
  let buildings = $state<Element[]>([]);
  let water = $state<Element[]>([]);
  let bbox = $state<BoundingBox | null>(null);
  let highlightedEdges = $state(new Set<string>());
  let edgeFreshness = $state(new Map<string, number>());
  let currentLocation = $state('');
  let currentAlgorithm = $state('');
  let currentThemeIndex = $state(0);
  let currentRadius = $state(1200);
  let loading = $state(false);
  let fadeOut = $state(false);
  let focusPath = $state(false);
  let pathFlashKey = $state(0);
  let sourcePin = $state<{ nodeId: string; lat: number; lon: number } | null>(null);
  let sinkPin = $state<{ nodeId: string; lat: number; lon: number } | null>(null);
  let sinkReachable = $state(false);
  let previousStepEdges = new Set<string>();

  let preloaded: PreparedLocation | null = null;
  let preloadedAlgorithmId: string | undefined;
  let preloading = false;
  let cancelled = false;
  let recentLocations: string[] = [];
  let recentAlgorithms: string[] = [];

  const selectedTheme = $derived(chooseTheme(builderSettings, 0));
  const playerTheme = $derived(chooseTheme(settings, currentThemeIndex));
  const selectedLocationCount = $derived(builderSettings.locations.length);

  function toggleListValue(key: 'algorithms' | 'locations' | 'themes', id: string) {
    const current = builderSettings[key];
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    if (next.length === 0) return;
    builderSettings = { ...builderSettings, [key]: next };
  }

  function startScreensaver() {
    window.location.href = buildScreensaverUrl({ ...builderSettings, play: true });
  }

  function useDefaults() {
    builderSettings = { ...defaultScreensaverSettings, play: true };
  }

  async function preloadNextLocation(algorithmId?: string) {
    if (preloading || preloaded || cancelled) return;
    preloading = true;
    try {
      preloaded = await prepareRandomLocation(settings, width, height, recentLocations, algorithmId);
      preloadedAlgorithmId = algorithmId;
    } catch (error) {
      console.warn('Screensaver preload failed:', error);
      preloaded = null;
      preloadedAlgorithmId = undefined;
    } finally {
      preloading = false;
    }
  }

  async function nextLocation(algorithmId?: string): Promise<PreparedLocation> {
    if (preloaded && preloadedAlgorithmId === algorithmId) {
      const prepared = preloaded;
      preloaded = null;
      preloadedAlgorithmId = undefined;
      return prepared;
    }
    preloaded = null;
    preloadedAlgorithmId = undefined;
    return prepareRandomLocation(settings, width, height, recentLocations, algorithmId);
  }

  function applyPrepared(prepared: PreparedLocation) {
    graph = prepared.graph;
    buildings = prepared.buildings;
    water = prepared.water;
    bbox = prepared.bbox;
    currentRadius = prepared.radius;
    currentLocation = prepared.location.name;
    recentLocations = [prepared.location.id, ...recentLocations.filter((id) => id !== prepared.location.id)].slice(0, 5);
  }

  function applyAlgorithmStep(step: AlgorithmStep) {
    if (!graph) return;
    const newlyVisitedEdges = new Set(
      Array.from(step.visitedEdges).filter((edgeId) => !previousStepEdges.has(edgeId))
    );
    highlightedEdges = step.visitedEdges;
    recordFreshEdges(edgeFreshness, newlyVisitedEdges, graph);
    edgeFreshness = new Map(edgeFreshness);
    previousStepEdges = new Set(step.visitedEdges);
  }

  async function runPathAlgorithmWithoutFinalFlash(algorithm: NonNullable<ReturnType<typeof getAlgorithmById>>) {
    if (!graph || !sourcePin) return;

    const generator = algorithm.run(graph, {
      delayMs: animationDelayForRadius(currentRadius),
      source: sourcePin.nodeId,
      sink: sinkPin?.nodeId,
      skipPathReconstructionYields: true
    });
    let pendingStep: AlgorithmStep | null = null;

    while (!cancelled) {
      const result = await generator.next();
      if (result.done) {
        focusPath = result.value.visitedEdges.size > 0;
        highlightedEdges = result.value.visitedEdges;
        return;
      }

      if (pendingStep) {
        applyAlgorithmStep(pendingStep);
      }
      pendingStep = result.value;
    }
  }

  async function runLoop() {
    while (!cancelled) {
      loading = true;
      focusPath = false;
      highlightedEdges = new Set();
      edgeFreshness = new Map();
      previousStepEdges = new Set();
      sourcePin = null;
      sinkPin = null;

      const algorithmId = chooseAlgorithmId(settings, recentAlgorithms);
      const algorithm = getAlgorithmById(algorithmId);
      if (!algorithm) continue;

      currentAlgorithm = algorithm.name;
      recentAlgorithms = [algorithmId, ...recentAlgorithms.filter((id) => id !== algorithmId)].slice(0, 3);
      currentThemeIndex += 1;

      try {
        applyPrepared(await nextLocation(algorithm.id));
      } catch (error) {
        console.error('Could not load screensaver map:', error);
        await sleep(1200);
        continue;
      } finally {
        loading = false;
      }

      preloadNextLocation(chooseAlgorithmId(settings, recentAlgorithms));

      if (!graph) continue;

      const pins = pickPins(graph, algorithm.requiresSink, bbox!, width, height, algorithm.id);
      sourcePin = pins.source;
      sinkPin = pins.sink;
      sinkReachable = pins.reachable;

      if (!sourcePin || (algorithm.requiresSink && (!sinkPin || !sinkReachable || sourcePin.nodeId === sinkPin.nodeId))) {
        continue;
      }

      await sleep(700);

      try {
        if (algorithm.requiresSink) {
          await runPathAlgorithmWithoutFinalFlash(algorithm);
        } else {
          for await (const step of algorithm.run(graph, {
            delayMs: animationDelayForRadius(currentRadius),
            source: sourcePin.nodeId,
            sink: sinkPin?.nodeId
          })) {
            if (cancelled) break;
            applyAlgorithmStep(step);
          }
        }
      } catch (error) {
        console.error('Screensaver algorithm failed:', error);
      }

      if (focusPath && highlightedEdges.size > 0) {
        pathFlashKey += 1;
        await sleep(holdDurationForRadius(currentRadius) + 1200);
      } else {
        await sleep(holdDurationForRadius(currentRadius));
      }

      fadeOut = true;
      await sleep(700);
      graph = null;
      bbox = null;
      fadeOut = false;
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  onMount(() => {
    settings = parseScreensaverSettings();
    builderSettings = { ...settings, play: true };
    if (settings.play) runLoop();
  });

  onDestroy(() => {
    cancelled = true;
  });
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

{#if settings.play}
  <div
    class="screensaver-player"
    style={`--page-bg: ${playerTheme.page.background}; --accent: ${playerTheme.accent}; --text: ${playerTheme.page.text};`}
  >
    <div class="fade" class:fade-active={fadeOut}></div>

    {#if loading}
      <div class="loading-mark">
        <span>{currentLocation || 'Finding a good street graph'}</span>
        <i></i>
      </div>
    {/if}

    {#if graph && bbox}
      <MapCanvas
        {bbox}
        {graph}
        {buildings}
        {water}
        {highlightedEdges}
        CANVAS_WIDTH={width}
        CANVAS_HEIGHT={height}
        {sourcePin}
        {sinkPin}
        {sinkReachable}
        onPinDrag={() => {}}
        zenMode={true}
        canvasTheme={playerTheme.canvas}
        {edgeFreshness}
        {focusPath}
        {pathFlashKey}
      />
    {/if}

    <div class="caption" class:caption-focus={focusPath}>
      <span>{currentLocation}</span>
      <small>{currentAlgorithm}</small>
    </div>

    {#if settings.audio}
      <audio autoplay loop class="hidden">
        <source src="https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3" type="audio/mpeg" />
      </audio>
    {/if}
  </div>
{:else}
  <main
    class="builder"
    style={`--page-bg: ${selectedTheme.page.background}; --accent: ${selectedTheme.accent}; --text: ${selectedTheme.page.text}; --muted: ${selectedTheme.page.muted}; --line: ${selectedTheme.page.border};`}
  >
    <div class="builder-preview" aria-hidden="true">
      <div class="preview-grid"></div>
      <div class="preview-path path-one"></div>
      <div class="preview-path path-two"></div>
      <div class="preview-haze"></div>
    </div>

    <section class="builder-content">
      <p class="brand">Graph Atlas</p>
      <h1>Screensaver builder</h1>
      <p class="lede">Choose what the visualizer can cycle through, then launch it fullscreen.</p>

      <div class="controls">
        <section class="control-group">
          <header>
            <h2>Algorithms</h2>
            <p>{builderSettings.algorithms.length} selected</p>
          </header>
          <div class="choice-list algorithm-list">
            {#each playableAlgorithms as algorithm}
              <label>
                <input
                  type="checkbox"
                  checked={builderSettings.algorithms.includes(algorithm.id)}
                  onchange={() => toggleListValue('algorithms', algorithm.id)}
                />
                <span>{algorithm.name}</span>
                <small>{algorithm.category}</small>
              </label>
            {/each}
          </div>
        </section>

        <section class="control-group">
          <header>
            <h2>Locations</h2>
            <p>{selectedLocationCount} of {screensaverLocations.length} selected</p>
          </header>
          <div class="choice-list locations">
            {#each screensaverLocations as location}
              <label>
                <input
                  type="checkbox"
                  checked={builderSettings.locations.includes(location.id)}
                  onchange={() => toggleListValue('locations', location.id)}
                />
                <span>{location.name}</span>
              </label>
            {/each}
          </div>
        </section>

        <section class="control-group">
          <header>
            <h2>Color Themes</h2>
            <p>{builderSettings.themes.length} selected</p>
          </header>
          <div class="theme-row">
            {#each screensaverThemes as theme}
              <label style={`--swatch: ${theme.accent};`}>
                <input
                  type="checkbox"
                  checked={builderSettings.themes.includes(theme.id)}
                  onchange={() => toggleListValue('themes', theme.id)}
                />
                <span class="swatch"></span>
                <span>{theme.name}</span>
              </label>
            {/each}
          </div>
        </section>

        <section class="control-group compact">
          <label class="audio-toggle">
            <input type="checkbox" bind:checked={builderSettings.audio} />
            <span>Ambient audio</span>
          </label>
        </section>
      </div>

      <div class="actions">
        <button class="launch" onclick={startScreensaver}>Launch screensaver</button>
        <button class="secondary" onclick={useDefaults}>Reset</button>
      </div>
    </section>
  </main>
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Spectral:wght@400;600&display=swap');

  .screensaver-player {
    position: relative;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background: var(--page-bg);
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
  }

  .fade {
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    background: #000;
    opacity: 0;
    transition: opacity 700ms ease;
  }

  .fade-active {
    opacity: 1;
  }

  .loading-mark {
    position: absolute;
    inset: 0;
    z-index: 15;
    display: grid;
    place-items: center;
    gap: 14px;
    color: color-mix(in srgb, var(--text), transparent 34%);
    font-size: 13px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .loading-mark i {
    width: 140px;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    animation: pulse-line 1.2s ease-in-out infinite;
  }

  .caption {
    position: absolute;
    left: 50%;
    bottom: 28px;
    z-index: 12;
    transform: translateX(-50%);
    display: grid;
    gap: 4px;
    text-align: center;
    color: color-mix(in srgb, var(--text), transparent 42%);
    transition: opacity 500ms ease, transform 500ms ease;
  }

  .caption-focus {
    opacity: 0.28;
    transform: translateX(-50%) translateY(10px);
  }

  .caption span {
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .caption small {
    font-size: 10px;
    letter-spacing: 0.12em;
  }

  .builder {
    position: relative;
    min-height: 100vh;
    overflow: hidden auto;
    background: var(--page-bg);
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
  }

  .builder-preview {
    position: fixed;
    inset: 0;
    overflow: hidden;
    filter: blur(8px);
    opacity: 0.44;
    transform: scale(1.03);
  }

  .preview-grid {
    position: absolute;
    inset: -20%;
    background-image:
      linear-gradient(90deg, color-mix(in srgb, var(--accent), transparent 62%) 1px, transparent 1px),
      linear-gradient(color-mix(in srgb, var(--accent), transparent 70%) 1px, transparent 1px);
    background-size: 54px 54px, 54px 54px;
    animation: drift-grid 18s linear infinite;
  }

  .preview-path {
    position: absolute;
    height: 5px;
    border-radius: 999px;
    background: var(--accent);
    box-shadow: 0 0 20px var(--accent), 0 0 60px var(--accent);
    transform-origin: left center;
    animation: trace 5.6s ease-in-out infinite;
  }

  .path-one {
    left: 10%;
    top: 38%;
    width: 74%;
    transform: rotate(10deg);
  }

  .path-two {
    left: 22%;
    top: 58%;
    width: 52%;
    transform: rotate(-16deg);
    animation-delay: 1.4s;
  }

  .preview-haze {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.82));
  }

  .builder-content {
    position: relative;
    z-index: 2;
    width: min(1120px, calc(100vw - 32px));
    min-height: 100vh;
    margin: 0 auto;
    padding: 52px 0 34px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .brand {
    margin: 0 0 10px;
    color: var(--accent);
    font-family: 'Spectral', serif;
    font-size: clamp(36px, 7vw, 78px);
    font-weight: 600;
    line-height: 0.92;
  }

  h1 {
    margin: 0;
    max-width: 760px;
    font-size: clamp(30px, 5vw, 58px);
    line-height: 0.95;
  }

  .lede {
    max-width: 660px;
    margin: 14px 0 24px;
    color: var(--muted);
    font-family: 'Spectral', serif;
    font-size: clamp(18px, 2.2vw, 24px);
    line-height: 1.35;
  }

  .controls {
    display: grid;
    gap: 0;
    border-top: 1px solid var(--line);
  }

  .control-group {
    display: grid;
    grid-template-columns: minmax(180px, 0.28fr) 1fr;
    gap: 26px;
    align-items: start;
    padding: 22px 0;
    border-bottom: 1px solid var(--line);
  }

  .control-group h2 {
    margin: 0 0 6px;
    font-size: 17px;
  }

  .control-group p {
    margin: 0;
    color: color-mix(in srgb, var(--muted), transparent 18%);
    font-family: 'Spectral', serif;
    line-height: 1.35;
  }

  .choice-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px 18px;
  }

  .algorithm-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .choice-list.locations {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    max-height: min(44vh, 420px);
    overflow-y: auto;
    padding-right: 8px;
  }

  button,
  label {
    font: inherit;
  }

  label {
    min-width: 0;
  }

  .choice-list label,
  .theme-row label,
  .audio-toggle {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    color: var(--text);
    cursor: pointer;
    line-height: 1.2;
  }

  .algorithm-list label {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      "input name"
      ". meta";
  }

  input {
    accent-color: var(--accent);
  }

  .algorithm-list input {
    grid-area: input;
    margin-top: 2px;
  }

  .algorithm-list span {
    grid-area: name;
  }

  .algorithm-list small {
    grid-area: meta;
  }

  .choice-list.locations label {
    font-size: 12px;
  }

  .choice-list small {
    color: var(--muted);
    font-size: 11px;
  }

  .theme-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px 18px;
  }

  .theme-row label {
    grid-template-columns: auto auto minmax(0, 1fr);
  }

  .swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: 0 0 14px var(--swatch);
  }

  .compact {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .compact label {
    justify-self: start;
  }

  .compact span {
    font-style: normal;
    color: var(--muted);
    font-size: 13px;
  }

  .audio-toggle {
    grid-template-columns: auto auto !important;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 22px;
  }

  .launch,
  .secondary {
    padding: 14px 18px;
    border: 1px solid color-mix(in srgb, var(--line), transparent 22%);
    color: var(--text);
    border-radius: 4px;
    cursor: pointer;
  }

  .launch {
    background: var(--accent);
    color: #120b06;
    border-color: var(--accent);
    font-weight: 700;
  }

  .secondary {
    background: transparent;
  }

  .launch:hover,
  .secondary:hover {
    border-color: var(--accent);
  }

  @keyframes drift-grid {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(54px, 54px, 0); }
  }

  @keyframes trace {
    0% { clip-path: inset(0 100% 0 0); opacity: 0.25; }
    45% { clip-path: inset(0 0 0 0); opacity: 1; }
    100% { clip-path: inset(0 0 0 72%); opacity: 0.25; }
  }

  @keyframes pulse-line {
    0%, 100% { opacity: 0.25; transform: scaleX(0.55); }
    50% { opacity: 1; transform: scaleX(1); }
  }

  @media (max-width: 820px) {
    .builder-content {
      justify-content: flex-start;
      padding-top: 38px;
    }

    .control-group,
    .compact {
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .choice-list,
    .algorithm-list,
    .choice-list.locations,
    .theme-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .actions {
      position: sticky;
      bottom: 0;
      padding: 12px 0 8px;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.58) 26%);
    }
  }

  @media (max-width: 520px) {
    .builder-content {
      width: min(100% - 24px, 1120px);
      padding-top: 30px;
    }

    .choice-list,
    .algorithm-list,
    .choice-list.locations,
    .theme-row {
      grid-template-columns: 1fr;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr;
    }
  }
</style>
