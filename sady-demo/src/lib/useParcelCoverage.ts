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
  checkData?: boolean;
  excludeGardens?: boolean;
}
export function useParcelCoverage({
  enabled,
  bounds,
  zoom,
  areas,
  checkData = true,
  excludeGardens = false,
}: Props): ParcelCoverageLayer {
  const [query, setQuery] = useState<{
    key: string;
    result: CoverageQuery | null;
    error: string;
    waiting: boolean;
  }>({ key: "", result: null, error: "", waiting: false });
  const key = `${bounds?.join(",") ?? ""}|gardens:${!excludeGardens}|data:${checkData}`;
  const extentMessage = coverageExtentMessage(bounds, zoom);
  const canLoad = enabled && !!bounds && !extentMessage;
  useEffect(() => {
    if (!canLoad || !bounds) return;
    const controller = new AbortController();
    // Keep already verified geometry visible during panning and the next request.
    // Fresh discovery replaces it atomically; no old value is assigned to a new parcel.
    setQuery(previous => ({ ...previous, error: "", waiting: true }));
    const timer = setTimeout(() => {
      queryCoverageParcels(bounds, controller.signal, {
        checkData,
        excludeGardens,
        onProgress: result => {
          if (!controller.signal.aborted) setQuery({ key, result, error: "", waiting: false });
        },
      })
        .then((result) => {
          if (!controller.signal.aborted) setQuery({ key, result, error: "", waiting: false });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setQuery(previous => ({
              key,
              result: previous.result,
              waiting: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Vrstva se nepodařila načíst.",
            }));
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Discovery and automatic core checks depend on viewport/filter state only.
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
    const moving = !bounds && zoom >= COVERAGE_MIN_ZOOM;
    if (extentMessage && !moving)
      return {
        parcels: [],
        counts,
        status: zoom < COVERAGE_MIN_ZOOM ? "zoom" : "extent",
        message: extentMessage,
        truncated: false,
        source: null,
      };
    if (!query.result)
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
    const parcels = query.result.parcels.filter(item => !excludeGardens || String(item.feature.properties.druhpozemkukod) !== "5").map((item) => {
      const match = known.get(geometryKey(item.feature.geometry));
      const saved = match ? coverageFromArea(match) : null;
      // In-flight analysis must not hide already verified factual snapshot coverage.
      const coverage = saved &&
        (saved.state === "sufficient" || saved.state === "insufficient" ||
          (["unknown", "loading"].includes(item.coverage.state) && saved.state !== "unknown"))
        ? saved : item.coverage;
      counts[coverage.state]++;
      return { ...item, coverage };
    });
    const scope = query.result.truncated
      ? "Zobrazeno nejvýše 200 parcel; přibližte mapu pro úplnější výřez."
      : `${parcels.length} zemědělských parcel v aktuálním výřezu.`;
    return {
      parcels,
      counts,
      status: query.error ? "error" : moving || query.waiting || query.key !== key || query.result.checking ? "loading" : "ready",
      message: query.error
        ? `${query.error} Zůstává poslední načtený výřez. Pro opakování vrstvu vypněte a zapněte.`
        : moving ? "Čekám na ustálení mapy…"
        : query.waiting || query.key !== key ? "Načítám nový výřez; dosavadní ověřené parcely zůstávají zobrazené."
        : query.result.checking
        ? `Automaticky ověřuji podklady viditelných parcel (${counts.sufficient + counts.insufficient} z ${parcels.length}).`
        : query.result.warning || scope,
      truncated: query.result.truncated,
      source: query.result.source,
    };
  }, [enabled, extentMessage, zoom, key, query, areas, bounds, excludeGardens]);
}
