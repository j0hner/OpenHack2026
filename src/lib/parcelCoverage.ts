import { area as turfArea } from "@turf/area";
import type { AnalysisArea, AreaGeometry } from "./types";
import type { LocationData, ParcelFeature } from "./openData";
import { geometryBounds, inBounds } from "./openData";
import {
  distanceKm,
  geometryKey,
  soilSummary,
  type RegionalData,
} from "./regionalData";
import { SOIL_GROUPS, validClimateYears } from "./regionalScoring";

export type CoverageState =
  | "sufficient"
  | "insufficient"
  | "unknown"
  | "loading"
  | "deferred"
  | "error";
export interface ParcelCoverage {
  state: CoverageState;
  soilCoveragePct: number | null;
  ratedSoilCoveragePct: number | null;
  climateYears: number | null;
  availableCategories: number | null;
  geometrySupported: boolean;
  source: "snapshot" | "analysis" | "unknown";
  reason: string;
  retryAt?: number;
}
export interface CoverageParcel {
  feature: ParcelFeature;
  coverage: ParcelCoverage;
}
export type CoverageCounts = Record<CoverageState, number>;
export const COVERAGE_STYLES: Record<
  CoverageState,
  { color: string; label: string }
> = {
  sufficient: { color: "#247e67", label: "Dostatek pro index" },
  insufficient: { color: "#c88b24", label: "Podklady nestačí" },
  unknown: { color: "#7b8794", label: "Dosud neověřeno" },
  loading: { color: "#407cb8", label: "Načítání podkladů" },
  deferred: { color: "#7b8794", label: "Čeká na klimatická data" },
  error: { color: "#b55365", label: "Chyba ověření" },
};
export const emptyCoverageCounts = (): CoverageCounts => ({
  sufficient: 0,
  insufficient: 0,
  unknown: 0,
  loading: 0,
  deferred: 0,
  error: 0,
});
export const unknownCoverage = (
  reason = "Podklady této geometrie zatím nejsou ověřené. Při zapnuté dostupnosti dat probíhá ověření automaticky.",
): ParcelCoverage => ({
  state: "unknown",
  soilCoveragePct: null,
  ratedSoilCoveragePct: null,
  climateYears: null,
  availableCategories: null,
  geometrySupported: true,
  source: "unknown",
  reason,
});
export function geometryHasRegionalSupport(geometry: AreaGeometry): boolean {
  const b = geometryBounds(geometry);
  return (
    inBounds([b[0], b[1]], [12, 48.5, 18.9, 51.2]) &&
    inBounds([b[2], b[3]], [12, 48.5, 18.9, 51.2]) &&
    distanceKm([b[0], b[1]], [b[2], b[3]]) <= 3 &&
    turfArea(geometry) <= 1_000_000
  );
}

/** Availability uses the same mandatory categories and thresholds as regionalScoring.
 * It is deliberately independent of agronomic suitability and its quality penalty. */
export function coverageFromData(
  geometry: AreaGeometry,
  data: RegionalData,
  source: "snapshot" | "analysis" = "analysis",
): ParcelCoverage {
  const geometrySupported = geometryHasRegionalSupport(geometry);
  const soil = data.soil;
  const rated =
    soil?.parts.reduce((sum, part) => {
      const hpj = Number(part.name.slice(1, 3));
      return (
        sum +
        (/^\d{5}$/.test(part.name) &&
        SOIL_GROUPS.some((group) => hpj >= group[0] && hpj <= group[1])
          ? part.percent
          : 0)
      );
    }, 0) ?? null;
  const soilAvailable =
    !!soil?.valid && soil.coveragePct >= 80 && rated !== null && rated >= 80;
  const climateYears = data.climate ? validClimateYears(data).length : null;
  const climateAvailable = climateYears !== null && climateYears >= 15;
  const availableCategories =
    Number(soilAvailable) + (climateAvailable ? 2 : 0);
  const sufficient = geometrySupported && availableCategories === 3;
  const reason = !geometrySupported
    ? "Geometrie přesahuje limit regionálního modelu (100 ha nebo 3 km úhlopříčky). Rozdělte ji na menší části."
    : sufficient
      ? "Půda, klima i vláha mají minimální podklady pro regionální index. Nejde o potvrzení vhodnosti sadu."
      : "Pro regionální index chybí alespoň 80 % hodnotitelného pokrytí BPEJ nebo 15 úplných klimatických let.";
  return {
    state: sufficient ? "sufficient" : "insufficient",
    soilCoveragePct: soil ? Math.min(100, Math.max(0, soil.coveragePct)) : null,
    ratedSoilCoveragePct:
      rated === null ? null : Math.min(100, Math.max(0, rated)),
    climateYears,
    availableCategories,
    geometrySupported,
    source,
    reason,
  };
}

export function coverageFromArea(area: AnalysisArea): ParcelCoverage {
  const regional = area.regional;
  if (!regional) return unknownCoverage();
  if (regional.status === "idle") return unknownCoverage();
  if (regional.status === "loading")
    return {
      ...unknownCoverage("Probíhá skutečné ověření podkladů této geometrie."),
      state: "loading",
    };
  if (regional.status === "error")
    return {
      ...unknownCoverage(
        regional.message ??
          "Podklady se nepodařilo ověřit. Nejde o potvrzený nedostatek dat.",
      ),
      state: "error",
    };
  if (!regional.data || regional.data.key !== geometryKey(area.geometry))
    return unknownCoverage("Dostupná analýza nepatří této přesné geometrii.");
  const coverage = coverageFromData(area.geometry, regional.data);
  if (coverage.geometrySupported && regional.data.deferred && !regional.data.errors.length && !regional.data.climate)
    return { ...coverage, state: 'deferred', reason: regional.data.deferred.message, retryAt: regional.data.deferred.retryAt };
  // A network failure is not evidence that the underlying source contains no data.
  if (
    coverage.geometrySupported &&
    regional.data.errors.length &&
    (coverage.soilCoveragePct === null || coverage.climateYears === null)
  ) {
    return {
      ...coverage,
      state: "error",
      reason:
        `Dostupnost není úplně ověřena. ${regional.data.errors.join(' ')}`,
    };
  }
  return coverage;
}

export function coverageFromSnapshot(
  geometry: AreaGeometry,
  snapshot: LocationData,
): ParcelCoverage {
  if (!geometryHasRegionalSupport(geometry))
    return {
      ...unknownCoverage(),
      state: "insufficient",
      geometrySupported: false,
      source: "snapshot",
      availableCategories: 0,
      reason:
        "Geometrie přesahuje limit regionálního modelu (100 ha nebo 3 km úhlopříčky).",
    };
  const b = geometryBounds(geometry);
  if (
    !inBounds([b[0], b[1]], snapshot.bounds) ||
    !inBounds([b[2], b[3]], snapshot.bounds)
  )
    return unknownCoverage();
  const candidates = snapshot.layers.bpej.features.filter((f) =>
    boundsIntersect(geometryBounds(f.geometry), b),
  );
  const soil = soilSummary(geometry, {
    type: "FeatureCollection",
    features: candidates,
  });
  const data: RegionalData = {
    key: geometryKey(geometry),
    fetchedAt: "",
    point: [0, 0],
    source: "snapshot",
    soil,
    climate: snapshot.climate
      ? {
          ...snapshot.climate,
          grid: snapshot.climate.grid ?? null,
          distanceKm: null,
        }
      : null,
    errors: [],
  };
  return coverageFromData(geometry, data, "snapshot");
}

export function boundsIntersect(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}
export function coverageDescription(coverage: ParcelCoverage): string {
  const soil =
    coverage.soilCoveragePct === null
      ? "BPEJ neověřeno"
      : `BPEJ ${coverage.soilCoveragePct.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %`;
  const years =
    coverage.climateYears === null
      ? "klima neověřeno"
      : `klima ${coverage.climateYears}/20 úplných let`;
  const count =
    coverage.availableCategories === null
      ? "kategorie neověřeny"
      : `${coverage.availableCategories}/3 kategorií pro index`;
  const source =
    coverage.source === "snapshot"
      ? "Připravený prostorový výřez."
      : coverage.source === "analysis"
        ? "Analýza této geometrie."
        : "";
  return `${COVERAGE_STYLES[coverage.state].label}. ${soil}; ${years}; ${count}. ${source} ${coverage.reason}`.trim();
}
