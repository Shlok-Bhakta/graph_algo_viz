import { algorithms, getAlgorithmViewportScale } from '../algos/registry';
import { calculateBbox, fetchOSMData } from '../lib/overpass';
import { buildGraph } from '../lib/graph';
import { pickVisiblePins } from '../lib/pins';
import type { BoundingBox, CanvasTheme, Element, Graph } from '../types';

export interface ScreensaverLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  minRadius: number;
  maxRadius: number;
  weight: number;
}

export interface ScreensaverTheme {
  id: string;
  name: string;
  accent: string;
  canvas: CanvasTheme;
  page: {
    background: string;
    text: string;
    muted: string;
    panel: string;
    border: string;
  };
}

export interface ScreensaverSettings {
  play: boolean;
  algorithms: string[];
  locations: string[];
  themes: string[];
  audio: boolean;
}

export interface PreparedLocation {
  graph: Graph;
  buildings: Element[];
  water: Element[];
  bbox: BoundingBox;
  location: ScreensaverLocation;
  radius: number;
}

export interface PickedPins {
  source: { nodeId: string; lat: number; lon: number } | null;
  sink: { nodeId: string; lat: number; lon: number } | null;
  reachable: boolean;
}

export const screensaverLocations: ScreensaverLocation[] = [
  { id: 'tokyo', name: 'Tokyo', lat: 35.6762, lon: 139.6503, minRadius: 900, maxRadius: 1800, weight: 3 },
  { id: 'paris', name: 'Paris', lat: 48.8566, lon: 2.3522, minRadius: 700, maxRadius: 1400, weight: 3 },
  { id: 'manhattan', name: 'Manhattan', lat: 40.742, lon: -73.989, minRadius: 900, maxRadius: 1700, weight: 3 },
  { id: 'london', name: 'London', lat: 51.514, lon: -0.113, minRadius: 800, maxRadius: 1600, weight: 3 },
  { id: 'amsterdam', name: 'Amsterdam', lat: 52.3676, lon: 4.9041, minRadius: 600, maxRadius: 1200, weight: 2 },
  { id: 'barcelona', name: 'Barcelona', lat: 41.389, lon: 2.17, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'san-francisco', name: 'San Francisco', lat: 37.787, lon: -122.407, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'chicago', name: 'Chicago', lat: 41.884, lon: -87.629, minRadius: 1000, maxRadius: 1800, weight: 2 },
  { id: 'berlin', name: 'Berlin', lat: 52.52, lon: 13.405, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'vienna', name: 'Vienna', lat: 48.2082, lon: 16.3738, minRadius: 700, maxRadius: 1400, weight: 2 },
  { id: 'prague', name: 'Prague', lat: 50.0755, lon: 14.4378, minRadius: 700, maxRadius: 1400, weight: 2 },
  { id: 'montreal', name: 'Montreal', lat: 45.504, lon: -73.568, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'buenos-aires', name: 'Buenos Aires', lat: -34.6037, lon: -58.3816, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'melbourne', name: 'Melbourne', lat: -37.8136, lon: 144.9631, minRadius: 900, maxRadius: 1600, weight: 2 },
  { id: 'kyoto', name: 'Kyoto', lat: 35.0116, lon: 135.7681, minRadius: 700, maxRadius: 1300, weight: 2 },
  { id: 'lisbon', name: 'Lisbon', lat: 38.7223, lon: -9.1393, minRadius: 800, maxRadius: 1400, weight: 2 },
  { id: 'toronto', name: 'Toronto', lat: 43.6532, lon: -79.3832, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'singapore-core', name: 'Singapore Core', lat: 1.3006, lon: 103.8558, minRadius: 700, maxRadius: 1300, weight: 1 },
  { id: 'seoul', name: 'Seoul', lat: 37.5665, lon: 126.978, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'mexico-city', name: 'Mexico City', lat: 19.4326, lon: -99.1332, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'madrid', name: 'Madrid', lat: 40.4168, lon: -3.7038, minRadius: 800, maxRadius: 1600, weight: 2 },
  { id: 'helsinki', name: 'Helsinki', lat: 60.1699, lon: 24.9384, minRadius: 700, maxRadius: 1400, weight: 1 },
  { id: 'washington-dc', name: 'Washington DC', lat: 38.9072, lon: -77.0369, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'boston', name: 'Boston', lat: 42.3601, lon: -71.0589, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'new-york', name: 'New York', lat: 40.7128, lon: -74.006, minRadius: 900, maxRadius: 1700, weight: 3 },
  { id: 'brooklyn', name: 'Brooklyn', lat: 40.6782, lon: -73.9442, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'los-angeles', name: 'Los Angeles', lat: 34.0522, lon: -118.2437, minRadius: 1100, maxRadius: 2000, weight: 2 },
  { id: 'seattle', name: 'Seattle', lat: 47.6062, lon: -122.3321, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'portland', name: 'Portland', lat: 45.5152, lon: -122.6784, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'austin', name: 'Austin', lat: 30.2672, lon: -97.7431, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'denver', name: 'Denver', lat: 39.7392, lon: -104.9903, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'miami', name: 'Miami', lat: 25.7617, lon: -80.1918, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'new-orleans', name: 'New Orleans', lat: 29.9511, lon: -90.0715, minRadius: 800, maxRadius: 1500, weight: 1 },
  { id: 'philadelphia', name: 'Philadelphia', lat: 39.9526, lon: -75.1652, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'atlanta', name: 'Atlanta', lat: 33.749, lon: -84.388, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'minneapolis', name: 'Minneapolis', lat: 44.9778, lon: -93.265, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'vancouver', name: 'Vancouver', lat: 49.2827, lon: -123.1207, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'quebec-city', name: 'Quebec City', lat: 46.8139, lon: -71.208, minRadius: 700, maxRadius: 1300, weight: 1 },
  { id: 'rio-de-janeiro', name: 'Rio de Janeiro', lat: -22.9068, lon: -43.1729, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'sao-paulo', name: 'Sao Paulo', lat: -23.5558, lon: -46.6396, minRadius: 1000, maxRadius: 1900, weight: 2 },
  { id: 'santiago', name: 'Santiago', lat: -33.4489, lon: -70.6693, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'lima', name: 'Lima', lat: -12.0464, lon: -77.0428, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'bogota', name: 'Bogota', lat: 4.711, lon: -74.0721, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'copenhagen', name: 'Copenhagen', lat: 55.6761, lon: 12.5683, minRadius: 700, maxRadius: 1400, weight: 2 },
  { id: 'stockholm', name: 'Stockholm', lat: 59.3293, lon: 18.0686, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'oslo', name: 'Oslo', lat: 59.9139, lon: 10.7522, minRadius: 800, maxRadius: 1500, weight: 1 },
  { id: 'dublin', name: 'Dublin', lat: 53.3498, lon: -6.2603, minRadius: 800, maxRadius: 1500, weight: 1 },
  { id: 'edinburgh', name: 'Edinburgh', lat: 55.9533, lon: -3.1883, minRadius: 700, maxRadius: 1400, weight: 1 },
  { id: 'brussels', name: 'Brussels', lat: 50.8503, lon: 4.3517, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'zurich', name: 'Zurich', lat: 47.3769, lon: 8.5417, minRadius: 700, maxRadius: 1400, weight: 1 },
  { id: 'milan', name: 'Milan', lat: 45.4642, lon: 9.19, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'rome', name: 'Rome', lat: 41.9028, lon: 12.4964, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'venice', name: 'Venice', lat: 45.4408, lon: 12.3155, minRadius: 600, maxRadius: 1200, weight: 1 },
  { id: 'florence', name: 'Florence', lat: 43.7696, lon: 11.2558, minRadius: 700, maxRadius: 1300, weight: 1 },
  { id: 'athens', name: 'Athens', lat: 37.9838, lon: 23.7275, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'istanbul', name: 'Istanbul', lat: 41.0082, lon: 28.9784, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'warsaw', name: 'Warsaw', lat: 52.2297, lon: 21.0122, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'budapest', name: 'Budapest', lat: 47.4979, lon: 19.0402, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'dubrovnik', name: 'Dubrovnik', lat: 42.6507, lon: 18.0944, minRadius: 600, maxRadius: 1200, weight: 1 },
  { id: 'marrakesh', name: 'Marrakesh', lat: 31.6295, lon: -7.9811, minRadius: 700, maxRadius: 1300, weight: 1 },
  { id: 'cairo', name: 'Cairo', lat: 30.0444, lon: 31.2357, minRadius: 1000, maxRadius: 1900, weight: 1 },
  { id: 'cape-town', name: 'Cape Town', lat: -33.9249, lon: 18.4241, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'nairobi', name: 'Nairobi', lat: -1.2921, lon: 36.8219, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'lagos', name: 'Lagos', lat: 6.5244, lon: 3.3792, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'dubai', name: 'Dubai', lat: 25.2048, lon: 55.2708, minRadius: 1000, maxRadius: 1900, weight: 1 },
  { id: 'tel-aviv', name: 'Tel Aviv', lat: 32.0853, lon: 34.7818, minRadius: 800, maxRadius: 1500, weight: 1 },
  { id: 'mumbai', name: 'Mumbai', lat: 19.076, lon: 72.8777, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'delhi', name: 'Delhi', lat: 28.6139, lon: 77.209, minRadius: 1000, maxRadius: 1900, weight: 1 },
  { id: 'bangkok', name: 'Bangkok', lat: 13.7563, lon: 100.5018, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'hanoi', name: 'Hanoi', lat: 21.0278, lon: 105.8342, minRadius: 800, maxRadius: 1500, weight: 1 },
  { id: 'hong-kong', name: 'Hong Kong', lat: 22.3193, lon: 114.1694, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'taipei', name: 'Taipei', lat: 25.033, lon: 121.5654, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'shanghai', name: 'Shanghai', lat: 31.2304, lon: 121.4737, minRadius: 1000, maxRadius: 1900, weight: 2 },
  { id: 'beijing', name: 'Beijing', lat: 39.9042, lon: 116.4074, minRadius: 1000, maxRadius: 1900, weight: 1 },
  { id: 'osaka', name: 'Osaka', lat: 34.6937, lon: 135.5023, minRadius: 800, maxRadius: 1500, weight: 2 },
  { id: 'kuala-lumpur', name: 'Kuala Lumpur', lat: 3.139, lon: 101.6869, minRadius: 900, maxRadius: 1700, weight: 1 },
  { id: 'jakarta', name: 'Jakarta', lat: -6.2088, lon: 106.8456, minRadius: 1000, maxRadius: 1900, weight: 1 },
  { id: 'sydney', name: 'Sydney', lat: -33.8688, lon: 151.2093, minRadius: 900, maxRadius: 1700, weight: 2 },
  { id: 'auckland', name: 'Auckland', lat: -36.8509, lon: 174.7645, minRadius: 800, maxRadius: 1500, weight: 1 }
];

export const screensaverThemes: ScreensaverTheme[] = [
  {
    id: 'ember',
    name: 'Deep Ember',
    accent: '#d97706',
    canvas: {
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
    page: {
      background: '#050302',
      text: '#f8eee7',
      muted: '#c9a28b',
      panel: 'rgba(14, 7, 4, 0.72)',
      border: 'rgba(217, 119, 6, 0.2)'
    }
  },
  {
    id: 'aurora',
    name: 'Deep Violet',
    accent: '#8b5cf6',
    canvas: {
      background: ['#05040a', '#05040a', '#020106'],
      road: '#171225',
      building: '#0a0712',
      water: '#000003',
      highlight: '#8b5cf6',
      highlightHot: '#ddd6fe',
      source: '#a78bfa',
      sink: '#38bdf8',
      focusBackground: '#0d0917'
    },
    page: {
      background: '#05040a',
      text: '#f3eefc',
      muted: '#b7a8d8',
      panel: 'rgba(10, 7, 18, 0.74)',
      border: 'rgba(139, 92, 246, 0.2)'
    }
  },
  {
    id: 'lagoon',
    name: 'Deep Lagoon',
    accent: '#0891b2',
    canvas: {
      background: ['#020607', '#020607', '#000203'],
      road: '#0a2026',
      building: '#031013',
      water: '#000001',
      highlight: '#0891b2',
      highlightHot: '#a5f3fc',
      source: '#0d9488',
      sink: '#ca8a04',
      focusBackground: '#041115'
    },
    page: {
      background: '#020607',
      text: '#e9fbfd',
      muted: '#8dbec7',
      panel: 'rgba(3, 16, 19, 0.74)',
      border: 'rgba(8, 145, 178, 0.2)'
    }
  },
  {
    id: 'neon',
    name: 'Deep Moss',
    accent: '#65a30d',
    canvas: {
      background: ['#020502', '#020502', '#000200'],
      road: '#0d1c0a',
      building: '#050b04',
      water: '#000000',
      highlight: '#65a30d',
      highlightHot: '#d9f99d',
      source: '#84cc16',
      sink: '#dc6b19',
      focusBackground: '#071005'
    },
    page: {
      background: '#020502',
      text: '#f1f8e8',
      muted: '#a9bd8f',
      panel: 'rgba(5, 11, 4, 0.74)',
      border: 'rgba(101, 163, 13, 0.2)'
    }
  }
];

export const defaultScreensaverSettings: ScreensaverSettings = {
  play: false,
  algorithms: ['bfs', 'dfs', 'Kruskal', 'astar'],
  locations: screensaverLocations.map((location) => location.id),
  themes: ['ember'],
  audio: false
};

export const playableAlgorithms = algorithms.filter((algorithm) => algorithm.id !== 'random-edges');

export function viewportScaleForAlgorithm(algorithmId?: string): number {
  return getAlgorithmViewportScale(algorithmId);
}

export function parseScreensaverSettings(search = window.location.search): ScreensaverSettings {
  const params = new URLSearchParams(search);
  const split = (key: string, fallback: string[]) => {
    const value = params.get(key);
    return value ? value.split(',').filter(Boolean) : fallback;
  };

  const validAlgorithmIds = new Set(playableAlgorithms.map((algorithm) => algorithm.id));
  const validLocationIds = new Set(screensaverLocations.map((location) => location.id));
  const validThemeIds = new Set(screensaverThemes.map((theme) => theme.id));

  const selectedAlgorithms = split('algos', defaultScreensaverSettings.algorithms).filter((id) => validAlgorithmIds.has(id));
  const selectedLocations = split('locations', defaultScreensaverSettings.locations).filter((id) => validLocationIds.has(id));
  const selectedThemes = split('themes', defaultScreensaverSettings.themes).filter((id) => validThemeIds.has(id));

  return {
    play: params.get('play') === '1' || params.has('screensaver'),
    algorithms: selectedAlgorithms.length ? selectedAlgorithms : defaultScreensaverSettings.algorithms,
    locations: selectedLocations.length ? selectedLocations : defaultScreensaverSettings.locations,
    themes: selectedThemes.length ? selectedThemes : defaultScreensaverSettings.themes,
    audio: params.get('audio') === '1'
  };
}

export function buildScreensaverUrl(settings: ScreensaverSettings): string {
  const params = new URLSearchParams();
  params.set('play', '1');
  params.set('algos', settings.algorithms.join(','));
  params.set('locations', settings.locations.join(','));
  params.set('themes', settings.themes.join(','));
  params.set('audio', settings.audio ? '1' : '0');
  return `${window.location.pathname}?${params.toString()}`;
}

export function animationDelayForRadius(radius: number): number {
  return Math.round(interpolateByRadius(radius, 150, 80));
}

export function holdDurationForRadius(radius: number): number {
  return Math.round(interpolateByRadius(radius, 4400, 2600));
}

export function chooseTheme(settings: ScreensaverSettings, index: number): ScreensaverTheme {
  const selected = settings.themes
    .map((id) => screensaverThemes.find((theme) => theme.id === id))
    .filter((theme): theme is ScreensaverTheme => Boolean(theme));
  return selected[index % selected.length] ?? screensaverThemes[0];
}

export function chooseAlgorithmId(settings: ScreensaverSettings, recent: string[]): string {
  const pool = settings.algorithms.filter((id) => !recent.includes(id));
  const source = pool.length ? pool : settings.algorithms;
  return source[Math.floor(Math.random() * source.length)] ?? defaultScreensaverSettings.algorithms[0];
}

export async function prepareRandomLocation(
  settings: ScreensaverSettings,
  width: number,
  height: number,
  recentLocationIds: string[] = [],
  algorithmId?: string,
  onAttempt?: (location: ScreensaverLocation) => void
): Promise<PreparedLocation> {
  const selected = settings.locations
    .map((id) => screensaverLocations.find((location) => location.id === id))
    .filter((location): location is ScreensaverLocation => Boolean(location));
  const pool = selected.length ? selected : screensaverLocations;

  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    const location = weightedLocation(pool, recentLocationIds);
    const radius = randomRadius(location, attempt, algorithmId);
    onAttempt?.(location);

    try {
      const bbox = calculateBbox(location.lat, location.lon, width, height, radius);
      const data = await fetchOSMData(bbox);
      const highways = data.elements.filter((element) => element.tags?.highway);
      const buildings = data.elements.filter((element) => element.tags?.building);
      const water = data.elements.filter((element) => element.tags?.natural === 'water' || element.tags?.waterway || element.tags?.landuse === 'reservoir');
      const graph = buildGraph(highways);

      if (isUsableGraph(graph)) {
        return { graph, buildings, water, bbox, location, radius };
      }

      lastError = new Error(`${location.name} returned a sparse graph`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not load a usable map');
}

export function pickPins(
  graph: Graph,
  requiresSink: boolean,
  bbox: BoundingBox,
  width: number,
  height: number,
  algorithmId?: string
): PickedPins {
  return pickVisiblePins(graph, {
    bbox,
    width,
    height,
    requiresSink,
    algorithmId
  });
}

export function recordFreshEdges(freshness: Map<string, number>, edges: Set<string>, graph: Graph, timestamp = performance.now()) {
  const simplifiedById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  for (const edgeId of edges) {
    if (!freshness.has(edgeId)) freshness.set(edgeId, timestamp);
    const subEdges = simplifiedById.get(edgeId)?.subEdges;
    if (subEdges) {
      for (const subEdgeId of subEdges) {
        if (!freshness.has(subEdgeId)) freshness.set(subEdgeId, timestamp);
      }
    }
  }

  for (const [edgeId, born] of freshness) {
    if (timestamp - born > 14000) freshness.delete(edgeId);
  }
}

function randomRadius(location: ScreensaverLocation, attempt: number, algorithmId?: string): number {
  const scale = viewportScaleForAlgorithm(algorithmId);
  const min = Math.max(400, location.minRadius - attempt * 80);
  const max = location.maxRadius + attempt * 140;
  return Math.round((Math.floor(Math.random() * (max - min + 1)) + min) * scale);
}

function interpolateByRadius(radius: number, zoomedInValue: number, zoomedOutValue: number): number {
  const t = Math.min(1, Math.max(0, (radius - 500) / 1500));
  return zoomedInValue + (zoomedOutValue - zoomedInValue) * t;
}

function weightedLocation(locations: ScreensaverLocation[], recentIds: string[]): ScreensaverLocation {
  const weighted = locations.flatMap((location) => {
    const penalty = recentIds.includes(location.id) ? 0.25 : 1;
    return Array.from({ length: Math.max(1, Math.round(location.weight * penalty)) }, () => location);
  });
  return weighted[Math.floor(Math.random() * weighted.length)] ?? locations[0];
}

function isUsableGraph(graph: Graph): boolean {
  if (graph.nodes.size < 24 || graph.edges.length < 28) return false;
  const component = largestComponent(graph);
  return component.length >= Math.max(18, Math.floor(graph.nodes.size * 0.35));
}

function largestComponent(graph: Graph): string[] {
  const visited = new Set<string>();
  let largest: string[] = [];

  for (const nodeId of graph.nodes.keys()) {
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
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push(edge.to);
        }
      }
    }

    if (component.length > largest.length) largest = component;
  }

  return largest;
}
