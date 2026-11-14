import type { FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

/** All application geometry uses RFC 7946 longitude/latitude (EPSG:4326). */
export type Bbox = readonly [west: number, south: number, east: number, north: number];
export interface OrchardInput {
  name: string;
  longitude: number;
  latitude: number;
  notes?: string;
}
export interface Orchard extends Required<OrchardInput> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Provenance {
  sourceId: string;
  /** File name or precise public query URL; never credentials. */
  sourceUrl: string;
  attribution: string;
  license: string;
  /** Dataset revision or model; e.g. era5_land. */
  sourceVersion?: string;
}
export interface GeoJsonImport extends Provenance {
  /** Identifies a bounded area/query/file snapshot; re-import replaces that snapshot atomically. */
  scopeKey: string;
  /** Use a provider's stable property ID when feature.id is absent. */
  idProperty?: string;
  collection: FeatureCollection;
}
export interface ImportReceipt {
  id: string;
  sourceId: string;
  scopeKey: string;
  sourceUrl: string;
  attribution: string;
  license: string;
  sourceVersion: string | null;
  importedAt: string;
  recordCount: number;
  kind: 'features' | 'climate';
}
export interface StoredFeature {
  id: string;
  importId: string;
  externalId: string;
  sourceId: string;
  geometry: Geometry;
  properties: GeoJsonProperties;
  bbox: Bbox;
}
export interface FeatureQuery {
  sourceId?: string;
  importId?: string;
  bbox?: Bbox;
  limit?: number;
  offset?: number;
}
export interface ClimateDay {
  date: string;
  minimumTemperatureC: number | null;
  precipitationMm: number | null;
}
export interface ClimateImport extends Provenance {
  orchardId: string;
  scopeKey: string;
  longitude: number;
  latitude: number;
  model: string;
  timezone: 'Europe/Prague';
  days: ClimateDay[];
}
export interface ClimateSeries {
  import: ImportReceipt;
  longitude: number;
  latitude: number;
  model: string;
  timezone: string;
  days: ClimateDay[];
}
export interface StorageInfo {
  mode: 'opfs';
  schemaVersion: number;
  sqliteVersion: string;
}

/** One request is one worker operation; transactions never span UI/worker messages. */
export interface Operations {
  init: { input: undefined; output: StorageInfo };
  'orchards.list': { input: undefined; output: Orchard[] };
  'orchards.get': { input: string; output: Orchard | null };
  'orchards.save': { input: { id?: string; orchard: OrchardInput }; output: Orchard };
  'orchards.delete': { input: string; output: boolean };
  'features.import': { input: GeoJsonImport; output: ImportReceipt };
  'features.query': { input: FeatureQuery; output: StoredFeature[] };
  'imports.list': { input: undefined; output: ImportReceipt[] };
  'imports.delete': { input: string; output: boolean };
  'climate.import': { input: ClimateImport; output: ImportReceipt };
  'climate.list': { input: string; output: ClimateSeries[] };
  export: { input: undefined; output: Uint8Array };
  close: { input: undefined; output: undefined };
}
export type Operation = keyof Operations;
export type Request = { [K in Operation]: { id: number; method: K; input: Operations[K]['input'] } }[Operation];
export type Response = { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: { code: import('./errors').ErrorCode; message: string } };
