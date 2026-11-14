import { intersect } from "@turf/intersect";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { CoverageParcel } from "./parcelCoverage";
import {
  boundsIntersect,
  coverageFromArea,
  geometryHasRegionalSupport,
  unknownCoverage,
} from "./parcelCoverage";
import { geometryBounds, parcelArea } from "./openData";
import {
  aggregateWeather,
  distanceKm,
  geometryKey,
  rememberRegionalCore,
  representativePoint,
  soilSummary,
  type RegionalData,
} from "./regionalData";

type SoilCollection = FeatureCollection<Polygon | MultiPolygon>;
type Climate = NonNullable<RegionalData["climate"]>;
const climateCache = new Map<string, { at: number; data: Climate }>();
const climateFailures = new Map<string, { at: number; message: string }>();
const CLIMATE_TTL = 7 * 86400000;
export const COVERAGE_CLIMATE_CONCURRENCY = 2;
const checkAbort = (signal: AbortSignal) => {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
};
async function json(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]),
  });
  checkAbort(signal);
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  const value = await response.json();
  if (value.error) throw Error(value.reason ?? value.error.message ?? "Chyba poskytovatele");
  return value;
}

/** Exact clipping, not simplification: all parcel-local boundaries and holes
 * remain unchanged, while distant vertices no longer enter each intersection. */
export function clipCoverageSoil(collection: SoilCollection, extent: number[], signal?: AbortSignal): SoilCollection {
  const [west, south, east, north] = extent;
  const boundary: Feature<Polygon> = { type: "Feature", properties: {}, geometry: {
    type: "Polygon", coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  } };
  const result: SoilCollection = { type: "FeatureCollection", features: [] };
  for (const feature of collection.features) {
    if (signal) checkAbort(signal);
    const clipped = intersect({ type: "FeatureCollection", features: [boundary, feature] });
    if (clipped) result.features.push({ ...feature, geometry: clipped.geometry });
  }
  return result;
}

/** One bounded soil query covers the complete geometries, including parcel edges
 * outside the viewport. A truncated response is never treated as absent soil. */
async function viewportSoil(parcels: CoverageParcel[], signal: AbortSignal): Promise<SoilCollection> {
  const bounds = parcels.map(({ feature }) => geometryBounds(feature.geometry));
  const extent = [Math.min(...bounds.map(b => b[0])), Math.min(...bounds.map(b => b[1])), Math.max(...bounds.map(b => b[2])), Math.max(...bounds.map(b => b[3]))];
  const collection: SoilCollection = { type: "FeatureCollection", features: [] };
  for (let offset = 0; offset < 2000; offset += 500) {
    checkAbort(signal);
    const params = new URLSearchParams({
      where: "1=1", geometry: extent.join(","), geometryType: "esriGeometryEnvelope",
      inSR: "4326", outSR: "4326", spatialRel: "esriSpatialRelIntersects",
      outFields: "kod,nazev", f: "geojson", resultRecordCount: "500", resultOffset: String(offset),
    });
    const value = await json(`https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28/query?${params}`, signal);
    if (!Array.isArray(value.features)) throw Error("BPEJ neobsahuje geometrie.");
    if (!value.features.every((feature: { geometry?: { type?: string } }) => feature.geometry && ["Polygon", "MultiPolygon"].includes(feature.geometry.type ?? "")))
      throw Error("BPEJ obsahuje neplatnou geometrii.");
    // ArcGIS returns complete BPEJ units, which can contain tens of thousands of
    // vertices far outside this viewport. Clip each unit once, exactly, instead
    // of reprocessing its remote boundary for every one of the 200 parcels.
    // This preserves all boundaries/holes inside the complete parcel extent.
    let yieldedAt = performance.now();
    for (const feature of value.features as SoilCollection["features"]) {
      collection.features.push(...clipCoverageSoil({ type: "FeatureCollection", features: [feature] }, extent, signal).features);
      if (performance.now() - yieldedAt >= 12) {
        await new Promise(resolve => setTimeout(resolve, 0));
        yieldedAt = performance.now();
      }
    }
    if (!value.exceededTransferLimit) return collection;
  }
  throw Error("Výřez BPEJ překročil limit 2 000 jednotek. Přibližte mapu.");
}

function climateCell(point: [number, number]): [number, number] {
  return point.map(value => Math.round(value * 4) / 4) as [number, number];
}
async function climateAt(cell: [number, number], signal: AbortSignal): Promise<Climate> {
  const key = cell.join(","), cached = climateCache.get(key);
  if (cached && Date.now() - cached.at < CLIMATE_TTL) return cached.data;
  const failure = climateFailures.get(key);
  if (failure && Date.now() - failure.at < 15000)
    throw Error(`${failure.message} Další automatický pokus nejdříve za 15 sekund.`);
  const params = new URLSearchParams({
    latitude: String(cell[1]), longitude: String(cell[0]), models: "era5",
    start_date: "2005-01-01", end_date: "2024-12-31",
    daily: "temperature_2m_mean,temperature_2m_min,temperature_2m_max,precipitation_sum,et0_fao_evapotranspiration",
    timezone: "Europe/Prague", cell_selection: "nearest", elevation: "nan",
  });
  let value;
  try {
    value = await json(`https://archive-api.open-meteo.com/v1/archive?${params}`, signal);
  } catch (error) {
    checkAbort(signal);
    if (climateFailures.size >= 48) climateFailures.delete(climateFailures.keys().next().value!);
    climateFailures.set(key, { at: Date.now(), message: error instanceof Error ? error.message : "Klima není dostupné." });
    throw error;
  }
  if (!value.daily || !Array.isArray(value.daily.time) || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude))
    throw Error("Neúplné klimatické souřadnice nebo řada.");
  const grid: [number, number] = [value.longitude, value.latitude];
  if (distanceKm(grid, cell) > 1) throw Error("Odpověď neodpovídá požadovanému gridu ERA5.");
  const data: Climate = {
    years: aggregateWeather(value.daily), period: "2005–2024", model: "ERA5",
    resolution: "0.25° (~25 km), nikoli mikroklima parcely", grid, distanceKm: null,
  };
  checkAbort(signal);
  if (climateCache.size >= 48) climateCache.delete(climateCache.keys().next().value!);
  climateCache.set(key, { at: Date.now(), data });
  climateFailures.delete(key);
  return data;
}

/** Verify only core availability. No protection lookup, saved parcel, or synthetic
 * regional profile is needed. Soil is shared per viewport, climate per real cell. */
export async function verifyVisibleCoverage(
  input: CoverageParcel[],
  signal: AbortSignal,
  onProgress: (parcels: CoverageParcel[]) => void,
): Promise<CoverageParcel[]> {
  checkAbort(signal);
  const parcels = input.map(item => ({ ...item }));
  const pending = parcels.filter(item => item.coverage.state === "unknown");
  if (!pending.length) return parcels;
  const supported: CoverageParcel[] = [];
  for (const item of pending) {
    if (!geometryHasRegionalSupport(item.feature.geometry)) {
      item.coverage = {
        ...unknownCoverage("Geometrie přesahuje limit regionálního modelu (100 ha nebo 3 km úhlopříčky)."),
        state: "insufficient", geometrySupported: false, availableCategories: 0,
      };
    } else {
      supported.push(item);
      item.coverage = { ...unknownCoverage("Probíhá automatické ověření půdy a klimatu."), state: "loading" };
    }
  }
  const publish = () => { checkAbort(signal); onProgress(parcels.map(item => ({ ...item }))); };
  publish();
  if (!supported.length) return parcels;
  const cells = new Map<string, { cell: [number, number]; parcels: CoverageParcel[] }>();
  const points = new Map<CoverageParcel, [number, number]>();
  for (const item of supported) {
    try {
      const point = representativePoint(item.feature.geometry), cell = climateCell(point), key = cell.join(",");
      points.set(item, point);
      if (!cells.has(key)) cells.set(key, { cell, parcels: [] });
      cells.get(key)!.parcels.push(item);
    } catch {
      item.coverage = { ...unknownCoverage("Nelze určit vnitřní bod platné geometrie."), state: "error" };
    }
  }
  if (!cells.size) { publish(); return parcels; }
  type Result<T> = { value: T | null; error: string | null };
  const attempt = async <T>(task: () => Promise<T>): Promise<Result<T>> => {
    try { return { value: await task(), error: null }; }
    catch (error) { checkAbort(signal); return { value: null, error: error instanceof Error ? error.message : "Zdroj nedostupný." }; }
  };
  // Start the single soil job alongside climate jobs, never once per parcel.
  const soilPromise = attempt(() => viewportSoil(supported, signal));
  const queue = [...cells.values()];
  const worker = async () => {
    let yieldedAt = performance.now(), publishedAt = yieldedAt;
    while (queue.length) {
      checkAbort(signal);
      const group = queue.shift()!;
      const [soil, climate] = await Promise.all([soilPromise, attempt(() => climateAt(group.cell, signal))]);
      checkAbort(signal);
      const indexed = soil.value?.features.map(feature => ({ feature, bounds: geometryBounds(feature.geometry) }));
      for (const item of group.parcels) {
        checkAbort(signal);
        const point = points.get(item)!;
        const errors = [soil.error ? `BPEJ: ${soil.error}` : null, climate.error ? `Klima: ${climate.error}` : null].filter((value): value is string => !!value);
        try {
          const bounds = geometryBounds(item.feature.geometry);
          const data: RegionalData = {
            key: geometryKey(item.feature.geometry), fetchedAt: new Date().toISOString(), point, source: "live",
            soil: indexed ? soilSummary(item.feature.geometry, { type: "FeatureCollection", features: indexed.filter(entry => boundsIntersect(entry.bounds, bounds)).map(entry => entry.feature) }) : null,
            climate: climate.value ? { ...climate.value, distanceKm: climate.value.grid ? distanceKm(point, climate.value.grid) : null } : null,
            protected: null, errors,
          };
          item.coverage = coverageFromArea({ ...parcelArea(item.feature), regional: { status: "ready", data } });
          if (!errors.length) rememberRegionalCore(data);
        } catch (error) {
          item.coverage = { ...unknownCoverage(error instanceof Error ? error.message : "Prostorový průnik se nepodařil."), state: "error" };
        }
        // Time budgeting keeps movement/abort responsive even when a few parcels
        // have more vertices. Publishing is less frequent than yielding so Leaflet
        // does not redraw 200 polygons for every individual intersection.
        const now = performance.now();
        if (now - yieldedAt >= 12) {
          if (now - publishedAt >= 100) { publish(); publishedAt = now; }
          await new Promise(resolve => setTimeout(resolve, 0));
          yieldedAt = performance.now();
        }
      }
      publish();
    }
  };
  await Promise.all(Array.from({ length: Math.min(COVERAGE_CLIMATE_CONCURRENCY, cells.size) }, worker));
  checkAbort(signal);
  return parcels;
}
