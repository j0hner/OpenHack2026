import type { FeatureCollection, Polygon, MultiPolygon } from "geojson";
import {
  geometryBounds,
  inBounds,
  loadLocation,
  locationIndex,
  staticData,
  type LocationData,
  type ParcelFeature,
} from "./openData";
import {
  ELIGIBLE_LAND_USE_CODES,
  parcelEligibility,
} from "./parcelEligibility";
import { distanceKm, geometryKey } from "./regionalData";
import {
  boundsIntersect,
  coverageFromSnapshot,
  unknownCoverage,
  type CoverageParcel,
  type ParcelCoverage,
} from "./parcelCoverage";

export type CoverageBounds = [number, number, number, number];
export const COVERAGE_LIMIT = 200;
export const COVERAGE_MIN_ZOOM = 14;
export interface CoverageQuery {
  parcels: CoverageParcel[];
  truncated: boolean;
  source: "snapshot" | "live" | "mixed";
  warning: string;
}
const snapshotCache = new Map<string, ParcelCoverage>();
const queryCache = new Map<string, { at: number; value: CoverageQuery }>();
function checkAbort(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}
const containsBounds = (outer: number[], inner: number[]) =>
  inBounds([inner[0], inner[1]], outer) &&
  inBounds([inner[2], inner[3]], outer);

export function coverageExtentMessage(
  bounds: CoverageBounds | null,
  zoom: number,
): string {
  if (!bounds || zoom < COVERAGE_MIN_ZOOM)
    return "Přibližte mapu alespoň na úroveň 14 pro dostupnost dat jednotlivých parcel.";
  if (
    bounds.some((value) => !Number.isFinite(value)) ||
    bounds[0] >= bounds[2] ||
    bounds[1] >= bounds[3]
  )
    return "Neplatný mapový výřez.";
  if (
    bounds[2] < 12 ||
    bounds[0] > 18.9 ||
    bounds[3] < 48.5 ||
    bounds[1] > 51.2
  )
    return "Dostupnost dat zobrazujeme pro parcely v České republice.";
  if (distanceKm([bounds[0], bounds[1]], [bounds[2], bounds[3]]) > 8)
    return "Ještě mapu přibližte: vrstva zpracovává výřez do 8 km úhlopříčky a nejvýše 200 parcel.";
  return "";
}
function validFeature(value: unknown): value is ParcelFeature {
  const f = value as Partial<ParcelFeature> | null;
  return (
    !!f?.geometry &&
    ["Polygon", "MultiPolygon"].includes(f.geometry.type) &&
    /^\d+$/.test(String(f.properties?.id)) &&
    parcelEligibility(f as ParcelFeature).allowed
  );
}
async function liveParcels(
  bounds: CoverageBounds,
  signal: AbortSignal,
): Promise<{ features: ParcelFeature[]; truncated: boolean }> {
  const p = new URLSearchParams({
    where: `druhpozemkukod IN (${ELIGIBLE_LAND_USE_CODES.join(",")})`,
    geometry: bounds.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "id,cisloparcely,vymeraparcely,druhpozemkukod,katastralniuzemi",
    orderByFields: "id",
    f: "geojson",
    resultRecordCount: String(COVERAGE_LIMIT + 1),
  });
  const response = await fetch(
    `https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5/query?${p}`,
    { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) },
  );
  if (!response.ok) throw Error(`ČÚZK odpověděl HTTP ${response.status}.`);
  const data = await response.json();
  if (data.error || !Array.isArray(data.features))
    throw Error("ČÚZK vrátil neúplnou odpověď parcel.");
  return {
    features: data.features.filter(
      (feature: unknown) =>
        validFeature(feature) &&
        boundsIntersect(geometryBounds(feature.geometry), bounds),
    ),
    truncated:
      !!data.exceededTransferLimit || data.features.length > COVERAGE_LIMIT,
  };
}

/** Only cadastral geometry is fetched live. The layer never fans out weather,
 * BPEJ or AOPK calls per visible parcel; outside factual excerpts it stays unknown. */
export async function queryCoverageParcels(
  bounds: CoverageBounds,
  signal: AbortSignal,
): Promise<CoverageQuery> {
  checkAbort(signal);
  const extentError = coverageExtentMessage(bounds, COVERAGE_MIN_ZOOM);
  if (extentError) throw Error(extentError);
  const key = bounds.map((v) => v.toFixed(6)).join(",");
  const hit = queryCache.get(key);
  if (hit && Date.now() - hit.at < 120_000) return hit.value;
  let entries: Awaited<ReturnType<typeof locationIndex>> = [];
  let warning = "";
  try {
    entries = (await locationIndex()).filter((entry) =>
      boundsIntersect(entry.bounds, bounds),
    );
  } catch {
    warning =
      "Připravené podklady se nepodařilo načíst; dostupnost neověřených parcel zůstává neznámá.";
  }
  checkAbort(signal);
  const snapshots: LocationData[] = [];
  const local: ParcelFeature[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      try {
        const [data, parcels] = await Promise.all([
          loadLocation(entry),
          staticData<FeatureCollection<Polygon | MultiPolygon>>(
            entry.parcelsFile,
          ),
        ]);
        checkAbort(signal);
        snapshots.push(data);
        local.push(
          ...(parcels.features.filter(
            (f) =>
              validFeature(f) &&
              boundsIntersect(geometryBounds(f.geometry), bounds),
          ) as ParcelFeature[]),
        );
      } catch (error) {
        checkAbort(signal);
        warning =
          "Část připravených podkladů není dostupná; neověřené parcely nejsou označené jako bez dat.";
      }
    }),
  );
  checkAbort(signal);
  const coveredLocally = snapshots.some((snapshot) =>
    containsBounds(snapshot.bounds, bounds),
  );
  let live: ParcelFeature[] = [],
    remoteTruncated = false;
  if (!coveredLocally) {
    try {
      const result = await liveParcels(bounds, signal);
      live = result.features;
      remoteTruncated = result.truncated;
    } catch (error) {
      checkAbort(signal);
      if (!local.length) throw error;
      warning =
        "Živý katastr se nenačetl. Zobrazené jsou jen parcely z připraveného výřezu; pokrytí pohledu není úplné.";
    }
  }
  checkAbort(signal);
  const unique = [
    ...new Map(
      [...local, ...live].map((feature) => [
        String(feature.properties.id),
        feature,
      ]),
    ).values(),
  ];
  // Deterministic ordering keeps refreshes stable; limit applies before geometry intersections.
  unique.sort((a, b) =>
    String(a.properties.id).localeCompare(String(b.properties.id), "en", {
      numeric: true,
    }),
  );
  const truncated =
    remoteTruncated ||
    unique.length > COVERAGE_LIMIT ||
    (!coveredLocally && !live.length && !!warning);
  const parcels: CoverageParcel[] = [];
  for (const feature of unique.slice(0, COVERAGE_LIMIT)) {
    checkAbort(signal);
    const b = geometryBounds(feature.geometry);
    const snapshot = snapshots.find((data) => containsBounds(data.bounds, b));
    let coverage = unknownCoverage();
    if (snapshot) {
      const cacheKey =
        geometryKey(feature.geometry) + "|" + snapshot.bounds.join(",");
      coverage =
        snapshotCache.get(cacheKey) ??
        (() => {
          try {
            return coverageFromSnapshot(feature.geometry, snapshot);
          } catch {
            return {
              ...unknownCoverage(
                "Průnik podkladů této geometrie se nepodařilo ověřit.",
              ),
              state: "error" as const,
            };
          }
        })();
      if (snapshotCache.size >= 1200)
        snapshotCache.delete(snapshotCache.keys().next().value!);
      snapshotCache.set(cacheKey, coverage);
    }
    parcels.push({ feature, coverage });
    // Yield between small batches, so moving/closing the layer can abort expensive work.
    if (parcels.length % 12 === 0)
      await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const value: CoverageQuery = {
    parcels,
    truncated,
    source: coveredLocally ? "snapshot" : local.length ? "mixed" : "live",
    warning,
  };
  if (!warning) {
    if (queryCache.size >= 12)
      queryCache.delete(queryCache.keys().next().value!);
    queryCache.set(key, { at: Date.now(), value });
  }
  return value;
}
