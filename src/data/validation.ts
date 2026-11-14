import type { Geometry, Position } from 'geojson';
import { requireValue } from './errors';
import type { Bbox, OrchardInput, Provenance } from './types';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_FEATURES = 10_000;

export function text(value: unknown, label: string, max = 1000): asserts value is string {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    `${label} must be nonempty text of at most ${max} characters.`);
}
export function coordinates(longitude: number, latitude: number): void {
  requireValue(Number.isFinite(longitude) && longitude >= -180 && longitude <= 180,
    'Longitude must be between -180 and 180.');
  requireValue(Number.isFinite(latitude) && latitude >= -90 && latitude <= 90,
    'Latitude must be between -90 and 90.');
}
export function orchardInput(value: OrchardInput): void {
  text(value.name, 'Orchard name', 200);
  coordinates(value.longitude, value.latitude);
  requireValue(value.notes === undefined || (typeof value.notes === 'string' && value.notes.length <= 10_000),
    'Notes must be text of at most 10000 characters.');
}
export function provenance(value: Provenance): void {
  text(value.sourceId, 'Source ID', 100);
  requireValue(/^[a-z0-9][a-z0-9._-]*$/.test(value.sourceId), 'Source ID must be a lowercase slug.');
  text(value.sourceUrl, 'Source URL/file name', 2000);
  text(value.attribution, 'Attribution', 2000);
  text(value.license, 'License', 1000);
  if (value.sourceVersion !== undefined) text(value.sourceVersion, 'Source version', 200);
}
export function bbox(value: Bbox): void {
  requireValue(Array.isArray(value) && value.length === 4, 'Expected [west, south, east, north].');
  coordinates(value[0], value[1]);
  coordinates(value[2], value[3]);
  requireValue(value[0] <= value[2] && value[1] <= value[3], 'Bbox must be ordered and cannot cross the antimeridian.');
}
export function isoDate(value: unknown): asserts value is string {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
  'Expected a valid YYYY-MM-DD date.');
}

/** Validates shape as well as coordinates; projected GML/ArcGIS data must be normalized first. */
export function geometryBounds(geometry: Geometry): Bbox {
  requireValue(geometry !== null && typeof geometry === 'object', 'Feature geometry is required.');
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const point = (p: Position): void => {
    requireValue(Array.isArray(p) && (p.length === 2 || p.length === 3) && p.every(Number.isFinite),
      'A position must contain two or three finite numbers.');
    const [x, y] = p as [number, number];
    coordinates(x, y);
    west = Math.min(west, x); south = Math.min(south, y);
    east = Math.max(east, x); north = Math.max(north, y);
  };
  const line = (ps: Position[]): void => {
    requireValue(Array.isArray(ps) && ps.length >= 2, 'A line needs at least two positions.');
    ps.forEach(point);
  };
  const polygon = (rings: Position[][]): void => {
    requireValue(Array.isArray(rings) && rings.length > 0, 'A polygon needs at least one ring.');
    for (const ring of rings) {
      requireValue(Array.isArray(ring) && ring.length >= 4, 'A ring needs at least four positions.');
      ring.forEach(point);
      requireValue(JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1)), 'Polygon rings must be closed.');
    }
  };
  const nonempty = (items: unknown[]): void => requireValue(Array.isArray(items) && items.length > 0, 'Geometry cannot be empty.');
  switch (geometry.type) {
    case 'Point': point(geometry.coordinates); break;
    case 'MultiPoint': nonempty(geometry.coordinates); geometry.coordinates.forEach(point); break;
    case 'LineString': line(geometry.coordinates); break;
    case 'MultiLineString': nonempty(geometry.coordinates); geometry.coordinates.forEach(line); break;
    case 'Polygon': polygon(geometry.coordinates); break;
    case 'MultiPolygon': nonempty(geometry.coordinates); geometry.coordinates.forEach(polygon); break;
    // Deliberately unsupported until a bounded recursive validator is needed.
    default: requireValue(false, 'Unsupported geometry type. Use Point, LineString, Polygon, or their Multi variants.');
  }
  return [west, south, east, north];
}
