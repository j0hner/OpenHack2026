import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisArea, FruitKey } from "./types";
import {
  plantingGeometryKey,
  type PlantingGeometrySettings,
  type PlantingLayout,
} from "./plantingGeometry";
import {
  appliedPlantingPlan,
  matchingPlantingPlan,
  plantingRequestKey,
  type AppliedPlantingPlan,
} from "./plantingPlan";
import type { PlantingWorkerResponse } from "../workers/planting.worker";

export function usePlantingLayout(
  area: AnalysisArea | null,
  fruit: FruitKey,
  onApply: (id: string, plan: AppliedPlantingPlan) => void,
) {
  const cache = useRef(new Map<string, PlantingLayout>());
  const running = useRef<{
    worker: Worker;
    timer: ReturnType<typeof setTimeout>;
    token: number;
  } | null>(null);
  const token = useRef(0);
  const latest = useRef({ area, fruit, onApply });
  latest.current = { area, fruit, onApply };
  const [state, setState] = useState<{
    key: string;
    layout: PlantingLayout | null;
    busy: boolean;
    error: string;
  }>({ key: "", layout: null, busy: false, error: "" });
  const applied = area ? matchingPlantingPlan(area, fruit) : undefined;
  const areaKey = area ? `${area.id}:${fruit}` : "";
  const savedKey =
    area && applied
      ? plantingRequestKey(area.geometry, fruit, applied.settings)
      : "";

  const cancel = useCallback(() => {
    token.current++;
    if (running.current) {
      clearTimeout(running.current.timer);
      running.current.worker.terminate();
      running.current = null;
    }
  }, []);

  const calculate = useCallback(
    (settings: PlantingGeometrySettings, profileId: string) => {
      const current = latest.current;
      if (!current.area) return;
      const target = current.area,
        targetFruit = current.fruit;
      const key = plantingRequestKey(target.geometry, targetFruit, settings);
      cancel();
      const requestToken = token.current;
      const finish = (layout: PlantingLayout) => {
        if (requestToken !== token.current) return;
        if (
          latest.current.area?.id !== target.id ||
          latest.current.fruit !== targetFruit ||
          plantingGeometryKey(latest.current.area.geometry) !==
            plantingGeometryKey(target.geometry)
        )
          return;
        if (layout.status !== "ready" && layout.status !== "empty") {
          setState({ key, layout: null, busy: false, error: layout.message });
          return;
        }
        const plan = appliedPlantingPlan(
          target.geometry,
          targetFruit,
          settings,
          profileId,
          layout,
        );
        if (!plan) {
          setState({
            key,
            layout: null,
            busy: false,
            error: "Výsledek neodpovídá geometrii nebo zadaným vstupům.",
          });
          return;
        }
        cache.current.delete(key);
        cache.current.set(key, layout);
        while (cache.current.size > 5)
          cache.current.delete(cache.current.keys().next().value!);
        setState({ key, layout, busy: false, error: "" });
        current.onApply(target.id, plan);
      };
      const cached = cache.current.get(key);
      if (cached) {
        finish(cached);
        return;
      }
      setState({ key, layout: null, busy: true, error: "" });
      try {
        const worker = new Worker(
          new URL("../workers/planting.worker.ts", import.meta.url),
          { type: "module" },
        );
        const fail = (message: string) => {
          if (requestToken !== token.current) return;
          cancel();
          setState({ key, layout: null, busy: false, error: message });
        };
        const timer = setTimeout(
          () =>
            fail(
              "Výpočet trval příliš dlouho. Zvětšete spon nebo rozdělte pozemek na menší části.",
            ),
          30_000,
        );
        running.current = { worker, timer, token: requestToken };
        worker.onmessage = (event: MessageEvent<PlantingWorkerResponse>) => {
          if (requestToken !== token.current) return;
          clearTimeout(timer);
          worker.terminate();
          running.current = null;
          if ("error" in event.data) {
            setState({
              key,
              layout: null,
              busy: false,
              error: event.data.error,
            });
            return;
          }
          finish(event.data.layout);
        };
        worker.onerror = () =>
          fail(
            "Výpočet rozmístění se nepodařilo spustit. Obnovte stránku a zkuste to znovu.",
          );
        worker.postMessage({ geometry: target.geometry, settings });
      } catch {
        cancel();
        setState({
          key,
          layout: null,
          busy: false,
          error:
            "Prohlížeč nepovolil výpočet na pozadí. Zkontrolujte podporu Web Workerů.",
        });
      }
    },
    [cancel],
  );

  useEffect(() => {
    cancel();
    setState({ key: "", layout: null, busy: false, error: "" });
    const current = latest.current;
    const plan = current.area
      ? matchingPlantingPlan(current.area, current.fruit)
      : undefined;
    if (plan) calculate(plan.settings, plan.profileId);
    return cancel;
    // Only geometry, species and applied settings drive reconstruction; name,
    // regional-data refresh and economic price edits must not restart the job.
  }, [areaKey, savedKey, cancel, calculate]);

  const sameTarget =
    !!area &&
    state.key.startsWith(`${plantingGeometryKey(area.geometry)}:${fruit}:`);
  return {
    // A failed draft must not erase the last applied map while its summary and
    // economics still refer to that valid plan. Never fall back across shapes.
    layout:
      sameTarget && state.key === savedKey
        ? state.layout
        : savedKey
          ? (cache.current.get(savedKey) ?? null)
          : null,
    busy: sameTarget && state.busy,
    error: sameTarget ? state.error : "",
    calculate,
    clear: () => {
      cancel();
      setState({ key: "", layout: null, busy: false, error: "" });
    },
  };
}
