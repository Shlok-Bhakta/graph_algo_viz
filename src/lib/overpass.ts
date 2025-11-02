import type { BoundingBox, OverpassResponse } from '../types';

export function calculateBbox(
  centerLat: number,
  centerLon: number,
  canvasWidth: number,
  canvasHeight: number,
  zoomMeters: number = 1000
): BoundingBox {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(centerLat * Math.PI / 180);

  const aspectRatio = canvasWidth / canvasHeight;

  const latOffset = (zoomMeters / metersPerDegreeLat) / 2;
  const lonOffset = (zoomMeters * aspectRatio / metersPerDegreeLon) / 2;

  return {
    south: centerLat - latOffset,
    north: centerLat + latOffset,
    west: centerLon - lonOffset,
    east: centerLon + lonOffset
  };
}

export async function fetchOSMData(bbox: BoundingBox): Promise<OverpassResponse> {
  const query = `[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|service)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  relation["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out geom;`;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query)
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  return await response.json();
}
