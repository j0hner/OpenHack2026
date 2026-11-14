import type { PlaceResult } from "./adapters";

export type MunicipalityRow = [
  number,
  string,
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export interface Municipality {
  code: number;
  name: string;
  district: string;
  lon: number;
  lat: number;
  status: number;
  bounds: [number, number, number, number];
}
export interface MunicipalityResult extends PlaceResult {
  code: number;
  bounds: [number, number, number, number];
}
export const normalizeLocality = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const collator = new Intl.Collator("cs", {
  sensitivity: "base",
  numeric: true,
});
const indexes = new WeakMap<
  Municipality[],
  { place: Municipality; name: string; all: string }[]
>();
let municipalityRequest: Promise<Municipality[]> | null = null;

export function decodeMunicipalities(rows: unknown): Municipality[] {
  if (!Array.isArray(rows) || rows.length < 1)
    throw Error("Seznam obcí je prázdný.");
  const result: Municipality[] = [],
    ids = new Set<number>();
  for (const row of rows) {
    if (
      !Array.isArray(row) ||
      row.length !== 10 ||
      !Number.isInteger(row[0]) ||
      typeof row[1] !== "string" ||
      typeof row[2] !== "string" ||
      !row[1] ||
      !row[2] ||
      row.slice(3).some((v) => typeof v !== "number" || !Number.isFinite(v))
    )
      throw Error("Seznam obcí má neplatný formát.");
    const [code, name, district, lon, lat, status, w, s, e, n] =
      row as MunicipalityRow;
    if (
      ids.has(code) ||
      lon < 11 ||
      lon > 20 ||
      lat < 48 ||
      lat > 52 ||
      w > lon ||
      lon > e ||
      s > lat ||
      lat > n
    )
      throw Error("Seznam obcí obsahuje neplatné souřadnice.");
    ids.add(code);
    result.push({
      code,
      name,
      district,
      lon,
      lat,
      status,
      bounds: [w, s, e, n],
    });
  }
  return result;
}
export function loadMunicipalities(): Promise<Municipality[]> {
  if (!municipalityRequest)
    municipalityRequest = fetch(
      `${import.meta.env.BASE_URL}data/municipalities.json`,
      { signal: AbortSignal.timeout(15000) },
    )
      .then(async (response) => {
        if (!response.ok)
          throw Error(`Seznam obcí není dostupný (HTTP ${response.status}).`);
        return decodeMunicipalities(await response.json());
      })
      .catch((error) => {
        municipalityRequest = null;
        throw error;
      });
  return municipalityRequest;
}
export function findMunicipalities(
  places: Municipality[],
  query: string,
  limit = 8,
): Municipality[] {
  const normalized = normalizeLocality(query);
  if (normalized.length < 2) return [];
  let index = indexes.get(places);
  if (!index) {
    index = places.map((place) => ({
      place,
      name: normalizeLocality(place.name),
      all: normalizeLocality(`${place.name} ${place.district} ${place.code}`),
    }));
    indexes.set(places, index);
  }
  const words = normalized.split(" "),
    rated: { place: Municipality; rank: number }[] = [];
  for (const item of index) {
    let rank = -1;
    if (item.name === normalized) rank = 0;
    else if (item.name.startsWith(normalized)) rank = 10;
    else if (item.name.split(" ").some((word) => word.startsWith(normalized)))
      rank = 20;
    else if (item.name.includes(normalized)) rank = 30;
    else if (words.every((word) => item.all.includes(word))) rank = 40;
    if (rank >= 0) rated.push({ place: item.place, rank });
  }
  const statusPriority = (place: Municipality) =>
    place.status === 5
      ? 4
      : place.status === 4
        ? 3
        : place.status === 3
          ? 2
          : place.status === 6
            ? 1
            : 0;
  return rated
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        statusPriority(b.place) - statusPriority(a.place) ||
        collator.compare(a.place.name, b.place.name) ||
        collator.compare(a.place.district, b.place.district) ||
        a.place.code - b.place.code,
    )
    .slice(0, Math.max(1, Math.min(30, limit)))
    .map((item) => item.place);
}
export function municipalityToPlace(place: Municipality): MunicipalityResult {
  const type =
    place.status === 5
      ? "hlavní město"
      : place.status === 4
        ? "statutární město"
        : place.status === 3
          ? "město"
          : place.status === 6
            ? "městys"
            : "obec";
  return {
    code: place.code,
    label: `${place.name}, ${place.district === "Hlavní město Praha" ? "hlavní město Praha" : "okres " + place.district}`,
    lat: place.lat,
    lon: place.lon,
    bounds: place.bounds,
    type,
    source: "ČÚZK / RÚIAN",
  };
}
