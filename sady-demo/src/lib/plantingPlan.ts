import type { AnalysisArea, AreaGeometry, FruitKey } from "./types";
import {
  PLANTING_GEOMETRY_VERSION,
  normalizePlantingSettings,
  plantingGeometryKey,
  type PlantingGeometrySettings,
  type PlantingLayout,
} from "./plantingGeometry";

/** Persist only the small, geometry-bound summary. Tree coordinates are rebuilt
 * in a Worker and never fill localStorage with thousands of points. */
export interface AppliedPlantingPlan {
  version: string;
  geometryKey: string;
  fruit: FruitKey;
  profileId: string;
  settings: PlantingGeometrySettings;
  status: "ready" | "empty";
  treeCount: number;
  rowCount: number;
  bearingDeg: number;
  createdAt: string;
}
export type PlantingPlansByArea = Record<
  string,
  Partial<Record<FruitKey, AppliedPlantingPlan>>
>;
const FRUITS: FruitKey[] = ["apple", "pear", "plum", "cherry", "apricot"];

export function plantingSettingsKey(
  settings: PlantingGeometrySettings,
): string {
  return JSON.stringify([
    settings.rowSpacingM,
    settings.treeSpacingM,
    settings.edgeClearanceM,
    settings.headlandM,
    settings.orientation,
    settings.bearingDeg,
  ]);
}
export const plantingRequestKey = (
  geometry: AreaGeometry,
  fruit: FruitKey,
  settings: PlantingGeometrySettings,
) =>
  `${plantingGeometryKey(geometry)}:${fruit}:${plantingSettingsKey(settings)}`;

export function normalizeAppliedPlantingPlan(
  raw: unknown,
  geometry: AreaGeometry,
  fruit: FruitKey,
): AppliedPlantingPlan | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
  const plan = raw as AppliedPlantingPlan;
  const settings = normalizePlantingSettings(plan.settings);
  if (
    !settings ||
    plan.version !== PLANTING_GEOMETRY_VERSION ||
    plan.geometryKey !== plantingGeometryKey(geometry) ||
    plan.fruit !== fruit
  )
    return;
  if (
    !["ready", "empty"].includes(plan.status) ||
    !Number.isInteger(plan.treeCount) ||
    plan.treeCount < 0 ||
    plan.treeCount > 10_000 ||
    !Number.isInteger(plan.rowCount) ||
    plan.rowCount < 0 ||
    plan.rowCount > plan.treeCount
  )
    return;
  if (
    plan.status === "empty"
      ? plan.treeCount !== 0 || plan.rowCount !== 0
      : plan.treeCount < 1 || plan.rowCount < 1
  )
    return;
  if (
    !Number.isFinite(plan.bearingDeg) ||
    plan.bearingDeg < 0 ||
    plan.bearingDeg >= 180
  )
    return;
  if (
    typeof plan.profileId !== "string" ||
    plan.profileId.length > 80 ||
    typeof plan.createdAt !== "string" ||
    plan.createdAt.length > 40 ||
    !Number.isFinite(Date.parse(plan.createdAt))
  )
    return;
  return {
    version: plan.version,
    geometryKey: plan.geometryKey,
    fruit,
    settings,
    profileId: plan.profileId,
    status: plan.status,
    treeCount: plan.treeCount,
    rowCount: plan.rowCount,
    bearingDeg: plan.bearingDeg,
    createdAt: plan.createdAt,
  };
}

export const matchingPlantingPlan = (area: AnalysisArea, fruit: FruitKey) =>
  normalizeAppliedPlantingPlan(area.plantingPlan, area.geometry, fruit);

export function appliedPlantingPlan(
  geometry: AreaGeometry,
  fruit: FruitKey,
  settings: PlantingGeometrySettings,
  profileId: string,
  layout: PlantingLayout,
): AppliedPlantingPlan | undefined {
  if (layout.status !== "ready" && layout.status !== "empty") return;
  return normalizeAppliedPlantingPlan(
    {
      version: PLANTING_GEOMETRY_VERSION,
      geometryKey: layout.geometryKey,
      fruit,
      settings,
      profileId,
      status: layout.status,
      treeCount: layout.trees.length,
      rowCount: layout.rows.length,
      bearingDeg: layout.bearingDeg,
      createdAt: new Date().toISOString(),
    },
    geometry,
    fruit,
  );
}

export function normalizePlantingPlans(
  raw: unknown,
  areas: AnalysisArea[],
): PlantingPlansByArea {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const saved = raw as Record<string, Partial<Record<FruitKey, unknown>>>,
    next: PlantingPlansByArea = {};
  for (const area of areas) {
    const records = saved[area.id];
    if (!records || typeof records !== "object") continue;
    for (const fruit of FRUITS) {
      const plan = normalizeAppliedPlantingPlan(
        records[fruit],
        area.geometry,
        fruit,
      );
      if (plan) (next[area.id] ??= {})[fruit] = plan;
    }
  }
  return next;
}
