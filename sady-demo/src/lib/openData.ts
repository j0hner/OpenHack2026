import { intersect } from "@turf/intersect";
import { area } from "@turf/area";
import type {
  Feature,
  FeatureCollection,
  Polygon,
  MultiPolygon,
} from "geojson";
import type { AnalysisArea, AreaGeometry } from "./types";
import { eligibleParcels, LAND_USE } from "./parcelEligibility";
export { LAND_USE } from "./parcelEligibility";

export type ParcelFeature = Feature<
  Polygon | MultiPolygon,
  Record<string, unknown>
>;
export interface LocationData {
  center: [number, number];
  bounds: [number, number, number, number];
  layers: Record<string, FeatureCollection<Polygon | MultiPolygon>>;
  climate: null | {
    period: string;
    model: string;
    resolution: string;
    grid?: [number, number];
    rainfallGrid?: [number, number];
    years: {
      year: number;
      temperatureMeanC: number | null;
      rainfallMm: number | null;
      et0Mm: number | null;
      springFrostDays: number | null;
      summerDays: number | null;
    }[];
  };
}
export interface LocationEntry {
  id: string;
  bounds: [number, number, number, number];
  file: string;
  parcelsFile: string;
  center: [number, number];
}
const memo = new Map<string, Promise<unknown>>();
export async function staticData<T>(file: string): Promise<T> {
  if (!memo.has(file))
    memo.set(
      file,
      fetch(`${import.meta.env.BASE_URL}data/${file}`)
        .then(async (r) => {
          if (!r.ok) throw Error("Datový soubor není dostupný.");
          return r.json();
        })
        .catch((e) => {
          memo.delete(file);
          throw e;
        }),
    );
  return memo.get(file) as Promise<T>;
}
export const locationIndex = () =>
  staticData<LocationEntry[]>("locations-index.json");
export const loadLocation = (entry: LocationEntry) =>
  staticData<LocationData>(entry.file);
export function inBounds([x, y]: number[], [w, s, e, n]: number[]) {
  return x >= w && x <= e && y >= s && y <= n;
}
export async function locationFor(geometry: AreaGeometry) {
  const bounds = geometryBounds(geometry);
  const entry = (await locationIndex()).find(
    (e) =>
      inBounds([bounds[0], bounds[1]], e.bounds) &&
      inBounds([bounds[2], bounds[3]], e.bounds),
  );
  return entry ? loadLocation(entry) : null;
}
export function geometryBounds(
  geometry: AreaGeometry,
): [number, number, number, number] {
  const points = geometry.coordinates.flat(
    geometry.type === "Polygon" ? 1 : 2,
  ) as number[][];
  return [
    Math.min(...points.map((p) => p[0])),
    Math.min(...points.map((p) => p[1])),
    Math.max(...points.map((p) => p[0])),
    Math.max(...points.map((p) => p[1])),
  ];
}
export function overlaps(
  geometry: AreaGeometry,
  collection: FeatureCollection<Polygon | MultiPolygon>,
) {
  const total = area(geometry);
  const result: { name: string; percent: number }[] = [];
  for (const f of collection.features) {
    const clipped = intersect({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry }, f],
    });
    if (clipped) {
      const size = area(clipped);
      if (size > 0.01)
        result.push({
          name: String(f.properties?.nazev ?? f.properties?.name ?? "Území"),
          percent: (100 * size) / total,
        });
    }
  }
  return result;
}
export const mean = (values: (number | null)[]) => {
  const valid = values.filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  return valid.length ? valid.reduce((s, x) => s + x, 0) / valid.length : null;
};
export function containsPoint(
  g: AreaGeometry,
  point: [number, number],
): boolean {
  const ring = (pts: number[][]) => {
    let inside = false;
    const [x, y] = point;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i],
        [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  };
  const polygon = (p: number[][][]) => ring(p[0]) && !p.slice(1).some(ring);
  return g.type === "Polygon"
    ? polygon(g.coordinates)
    : g.coordinates.some(polygon);
}
export function cadastralUrl(id: string) {
  return `https://sgi-nahlizenidokn.cuzk.gov.cz/marushka/default.aspx?themeid=3&MarQueryId=2EDA9E088&MarParamCount=1&MarParam0=${encodeURIComponent(id)}`;
}
export async function queryParcels(
  point: [number, number],
  signal?: AbortSignal,
): Promise<ParcelFeature[]> {
  const entries = await locationIndex();
  const local = entries.find((e) => inBounds(point, e.bounds));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (local) {
    const data = await staticData<FeatureCollection<Polygon | MultiPolygon>>(
      local.parcelsFile,
    );
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return eligibleParcels(
      data.features.filter((f) =>
        containsPoint(f.geometry, point),
      ) as ParcelFeature[],
    );
  }
  const p = new URLSearchParams({
    where: "1=1",
    geometry: point.join(","),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields:
      "id,cisloparcely,vymeraparcely,druhpozemkukod,zpusobyvyuzitipozemku,katastralniuzemi",
    f: "geojson",
    resultRecordCount: "20",
  });
  const timeout = AbortSignal.timeout(12000);
  const r = await fetch(
    `https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5/query?${p}`,
    { signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
  );
  if (!r.ok) throw Error(`ČÚZK odpověděl HTTP ${r.status}.`);
  const data = await r.json();
  if (data.error || !Array.isArray(data.features) || data.exceededTransferLimit)
    throw Error("Neúplná nebo chybná odpověď ČÚZK.");
  return eligibleParcels(
    data.features.filter(
      (f: ParcelFeature) =>
        f.geometry &&
        ["Polygon", "MultiPolygon"].includes(f.geometry.type) &&
        /^\d+$/.test(String(f.properties?.id)),
    ),
  );
}
export function parcelArea(f: ParcelFeature): AnalysisArea {
  const p = f.properties,
    id = String(p.id);
  return {
    id: `parcel-${id}`,
    kind: "parcel",
    name: `Parcela ${p.cisloparcely}`,
    geometry: f.geometry,
    landUse: LAND_USE[String(p.druhpozemkukod)] ?? "neuvedeno",
    location: {
      code: id,
      katastr: String(p.katastralniuzemi),
      obec: "neurčeno",
      okres: "neurčeno",
      kraj: "neurčeno",
    },
    attributes: {
      soil: null,
      climate: null,
      water: null,
      terrain: null,
      access: null,
      constraints: null,
    },
    availability: {
      soil: "missing",
      climate: "missing",
      water: "missing",
      terrain: "missing",
      access: "missing",
    },
    sourceNote:
      "Skutečná geometrie a atributy ČÚZK / RÚIAN. Další otevřené podklady jsou uvedeny samostatně níže; chybějící údaje zůstávají neznámé.",
    story: "Výběr z katastru. Druh pozemku nepotvrzuje povolení výsadby.",
    cadastral: {
      id,
      officialAreaM2: Number.isFinite(Number(p.vymeraparcely))
        ? Number(p.vymeraparcely)
        : null,
    },
  };
}
