import { useEffect, useMemo, useState } from "react";
import type { AnalysisArea } from "./types";
import { geometryKey } from "./regionalData";
import {
  coverageExtentMessage,
  COVERAGE_MIN_ZOOM,
  queryCoverageParcels,
  type CoverageBounds,
  type CoverageQuery,
} from "./coverageData";
import {
  coverageFromArea,
  emptyCoverageCounts,
  type CoverageCounts,
  type CoverageParcel,
} from "./parcelCoverage";

export type CoverageLayerStatus =
  | "off"
  | "zoom"
  | "extent"
  | "loading"
  | "ready"
  | "error";
export interface ParcelCoverageLayer {
  parcels: CoverageParcel[];
  counts: CoverageCounts;
  status: CoverageLayerStatus;
  message: string;
  truncated: boolean;
  source: CoverageQuery["source"] | null;
}
interface Props {
  enabled: boolean;
  bounds: CoverageBounds | null;
  zoom: number;
  areas: AnalysisArea[];
}
export function useParcelCoverage({
  enabled,
  bounds,
  zoom,
  areas,
}: Props): ParcelCoverageLayer {
  const [query, setQuery] = useState<{
    key: string;
    result: CoverageQuery | null;
    error: string;
  }>({ key: "", result: null, error: "" });
  const key = bounds?.join(",") ?? "";
  const extentMessage = coverageExtentMessage(bounds, zoom);
  const canLoad = enabled && !!bounds && !extentMessage;
  useEffect(() => {
    if (!canLoad || !bounds) return;
    const controller = new AbortController();
    setQuery({ key, result: null, error: "" });
    const timer = setTimeout(() => {
      queryCoverageParcels(bounds, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setQuery({ key, result, error: "" });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setQuery({
              key,
              result: null,
              error:
                error instanceof Error
                  ? error.message
                  : "Vrstva se nepodařila načíst.",
            });
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Cadastral fetch depends on viewport only, not asynchronously updated selected-area data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, key]);
  return useMemo(() => {
    const counts = emptyCoverageCounts();
    if (!enabled)
      return {
        parcels: [],
        counts,
        status: "off",
        message: "",
        truncated: false,
        source: null,
      };
    if (!bounds && zoom >= COVERAGE_MIN_ZOOM)
      return {parcels: [], counts, status: 'loading', message: 'Čekám na ustálení mapy…', truncated: false, source: null};
    if (extentMessage)
      return {
        parcels: [],
        counts,
        status: zoom < COVERAGE_MIN_ZOOM ? "zoom" : "extent",
        message: extentMessage,
        truncated: false,
        source: null,
      };
    if (query.key !== key || !query.result)
      return {
        parcels: [],
        counts,
        status: query.key === key && query.error ? "error" : "loading",
        message:
          query.key === key && query.error
            ? `${query.error} Změňte přiblížení nebo vrstvu vypněte a znovu zapněte pro opakování.`
            : "Načítám hranice parcel a ověřuji dostupné místní podklady…",
        truncated: false,
        source: null,
      };
    const known = new Map(
      areas.map((area) => [geometryKey(area.geometry), area]),
    );
    const parcels = query.result.parcels.map((item) => {
      const match = known.get(geometryKey(item.feature.geometry));
      const saved = match ? coverageFromArea(match) : null;
      // In-flight analysis must not hide already verified factual snapshot coverage.
      const coverage =
        saved &&
        ((saved.state !== "loading" && saved.state !== "unknown") ||
          item.coverage.state === "unknown")
          ? saved
          : item.coverage;
      counts[coverage.state]++;
      return { ...item, coverage };
    });
    const scope = query.result.truncated
      ? "Zobrazeno nejvýše 200 parcel; přibližte mapu pro úplnější výřez."
      : `${parcels.length} zemědělských parcel v aktuálním výřezu.`;
    return {
      parcels,
      counts,
      status: "ready",
      message: query.result.warning || scope,
      truncated: query.result.truncated,
      source: query.result.source,
    };
  }, [enabled, extentMessage, zoom, key, query, areas, bounds]);
}
