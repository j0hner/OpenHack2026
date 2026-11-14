import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisArea } from "./types";
import { geometryKey, loadRegionalData } from "./regionalData";

export function useRegionalData(areas: AnalysisArea[], wantedIds: string[]) {
  const [records, setRecords] = useState<
    Record<string, AnalysisArea["regional"]>
  >({});
  const [retry, setRetry] = useState({ key: "", seq: 0 });
  const lastRetry = useRef(0);
  const wanted = areas.filter((area) => wantedIds.includes(area.id));
  const signature = wanted
    .map((area) => geometryKey(area.geometry))
    .sort()
    .join("|");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const forceKey = retry.seq > lastRetry.current ? retry.key : "";
    lastRetry.current = retry.seq;
    const todo = [
      ...new Map(
        wanted.map((area) => [geometryKey(area.geometry), area]),
      ).values(),
    ].filter(
      (area) =>
        records[geometryKey(area.geometry)]?.status !== "ready" ||
        forceKey === geometryKey(area.geometry),
    );
    const worker = async () => {
      while (active && todo.length) {
        const area = todo.shift()!,
          key = geometryKey(area.geometry);
        if(records[key]?.status!=="ready"||forceKey===key)
          setRecords((previous) => ({
            ...previous,
            [key]: { status: "loading", data: null },
          }));
        try {
          const data = await loadRegionalData(
            area.geometry,
            controller.signal,
            forceKey === key,
          );
          if (active&&data.key===key)
            setRecords((previous) => ({
              ...previous,
              [key]: { status: "ready", data },
            }));
        } catch (error) {
          if (active)
            setRecords((previous) => ({
              ...previous,
              [key]: {
                status: "error",
                data: null,
                message:
                  error instanceof Error
                    ? error.message
                    : "Podklady se nepodařilo načíst.",
              },
            }));
        }
      }
    };
    void worker();
    void worker();
    return () => {
      active = false;
      controller.abort();
    };
    // Data is keyed by geometry, never by the parcel name or selected fruit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, retry.seq]);
  const evaluated = useMemo<AnalysisArea[]>(
    () =>
      areas.map((area) => ({
        ...area,
        regional: records[geometryKey(area.geometry)] ?? {
          status: "idle" as const,
          data: null,
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
          soil: "missing" as const,
          climate: "missing" as const,
          water: "missing" as const,
          terrain: "missing" as const,
          access: "missing" as const,
        },
        sourceNote:
          (area.derivedFrom ? area.sourceNote + " " : "") +
          "Hodnocení z otevřených dat přiřazených geometrií a souřadnicemi; regionální údaje jsou označené.",
        story: area.derivedFrom
          ? area.story
          : area.kind === "parcel"
            ? "Skutečná parcela. Druh pozemku sám o sobě nepotvrzuje povolení výsadby."
            : "Uživatelská geometrie hodnocená skutečnými podklady podle polohy.",
      })),
    [areas, records],
  );
  return {
    areas: evaluated,
    retry: (area: AnalysisArea) =>
      setRetry((previous) => ({
        key: geometryKey(area.geometry),
        seq: previous.seq + 1,
      })),
  };
}
