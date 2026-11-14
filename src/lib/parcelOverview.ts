import { FRUITS } from "../data/fruitProfiles";
import { areaHa } from "./geo";
import { officialParcelNumber } from "./parcelCategories";
import type { AnalysisArea, FruitKey, SuitabilityResult } from "./types";

export type ParcelSortKey = "name" | "area" | "fruit" | "suitability";
export type ParcelSortDirection = "asc" | "desc";
export interface ParcelOverviewFilters {
  query: string;
  fruit: "all" | FruitKey;
  areaMin: string;
  areaMax: string;
  suitabilityMin: string;
  suitabilityMax: string;
  rating: "all" | "rated" | "unrated";
}
export const EMPTY_PARCEL_FILTERS: ParcelOverviewFilters = {
  query: "",
  fruit: "all",
  areaMin: "",
  areaMax: "",
  suitabilityMin: "",
  suitabilityMax: "",
  rating: "all",
};
export interface ParcelOverviewRow {
  area: AnalysisArea;
  fruit: FruitKey;
  score: SuitabilityResult;
  areaHa: number | null;
  suitability: number | null;
  locality: string;
  searchText: string;
  index: number;
}
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("cs-CZ");
const knownLocality = (value: string | undefined) =>
  !!value &&
  !["neurčeno", "neznámé", "neuvedeno"].includes(
    value.trim().toLocaleLowerCase("cs-CZ"),
  );
export function parcelLocality(area: AnalysisArea): string {
  const values = [area.location.obec, area.location.okres].filter(
    knownLocality,
  );
  if (knownLocality(area.location.katastr)) {
    const katastr = area.location.katastr;
    const label =
      katastr === "více území"
        ? "více katastrálních území"
        : `k. ú. ${katastr}`;
    if (!values.includes(katastr)) values.push(label);
  }
  return values.length
    ? [...new Set(values)].join(" · ")
    : "Lokalita není určená";
}
export function createParcelOverviewRows(
  areas: AnalysisArea[],
  fruitForArea: (area: AnalysisArea) => FruitKey,
  scoreForArea: (area: AnalysisArea) => SuitabilityResult,
): ParcelOverviewRow[] {
  return areas.map((area, index) => {
    const fruit = fruitForArea(area),
      score = scoreForArea(area),
      locality = parcelLocality(area);
    let size: number | null;
    try {
      const measured = areaHa(area.geometry);
      size = Number.isFinite(measured) && measured >= 0 ? measured : null;
    } catch {
      size = null;
    }
    const suitability =
      score.overall !== null && Number.isFinite(score.overall)
        ? score.overall
        : null;
    return {
      area,
      fruit,
      score,
      areaHa: size,
      suitability,
      locality,
      searchText: normalize(
        `${area.name} ${officialParcelNumber(area) ?? ""} ${locality}`,
      ),
      index,
    };
  });
}
type ParsedRange = {
  minimum: number | null;
  maximum: number | null;
  error: string | null;
};
function parseRange(
  minimumText: string,
  maximumText: string,
  label: string,
  upperLimit?: number,
): ParsedRange {
  const parse = (text: string) =>
    text.trim() ? Number(text.trim().replace(",", ".")) : null;
  const minimum = parse(minimumText),
    maximum = parse(maximumText);
  for (const value of [minimum, maximum]) {
    if (
      value !== null &&
      (!Number.isFinite(value) ||
        value < 0 ||
        (upperLimit !== undefined && value > upperLimit))
    )
      return {
        minimum,
        maximum,
        error: `${label}: zadejte číslo od 0${upperLimit === undefined ? "" : ` do ${upperLimit}`}.`,
      };
  }
  if (minimum !== null && maximum !== null && minimum > maximum)
    return {
      minimum,
      maximum,
      error: `${label}: dolní mez nesmí být větší než horní.`,
    };
  return { minimum, maximum, error: null };
}
export function parseParcelOverviewRanges(filters: ParcelOverviewFilters) {
  const area = parseRange(filters.areaMin, filters.areaMax, "Výměra");
  const suitability = parseRange(
    filters.suitabilityMin,
    filters.suitabilityMax,
    "Vhodnost",
    100,
  );
  return { area, suitability, error: area.error ?? suitability.error };
}
function inRange(value: number | null, range: ParsedRange) {
  if (range.minimum === null && range.maximum === null) return true;
  return (
    value !== null &&
    (range.minimum === null || value >= range.minimum) &&
    (range.maximum === null || value <= range.maximum)
  );
}
export function filterParcelOverviewRows(
  rows: ParcelOverviewRow[],
  filters: ParcelOverviewFilters,
): ParcelOverviewRow[] {
  const ranges = parseParcelOverviewRanges(filters);
  if (ranges.error) return [];
  const query = normalize(filters.query.trim());
  return rows.filter(
    (row) =>
      (!query || row.searchText.includes(query)) &&
      (filters.fruit === "all" || row.fruit === filters.fruit) &&
      inRange(row.areaHa, ranges.area) &&
      inRange(row.suitability, ranges.suitability) &&
      (filters.rating === "all" ||
        (filters.rating === "rated"
          ? row.suitability !== null
          : row.suitability === null)),
  );
}
export function sortParcelOverviewRows(
  rows: ParcelOverviewRow[],
  key: ParcelSortKey,
  direction: ParcelSortDirection,
): ParcelOverviewRow[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let result: number;
    if (key === "area" || key === "suitability") {
      const first = key === "area" ? a.areaHa : a.suitability,
        second = key === "area" ? b.areaHa : b.suitability;
      // Unknown values remain last in either direction; they are never zero.
      if (first === null || second === null)
        return first === second ? a.index - b.index : first === null ? 1 : -1;
      result = first - second;
    } else {
      const first = key === "fruit" ? FRUITS[a.fruit].name : a.area.name;
      const second = key === "fruit" ? FRUITS[b.fruit].name : b.area.name;
      result = first.localeCompare(second, "cs-CZ", {
        sensitivity: "base",
        numeric: true,
      });
    }
    return result * sign || a.index - b.index;
  });
}
