import type {
  AnalysisArea,
  EconomicsInputs,
  FruitKey,
  PolygonGeometry,
} from "./types";

import { migrateState } from "./migration";

// Retain the original key so existing real user parcels survive the upgrade.
const KEY = "sady-demo-v1";

export interface PersistedState {
  fruitByArea?: Record<string, FruitKey>;
  splitHistory?: SplitRecord[];
  modelVersion?: string;
  /** Read-only compatibility with historical saved state. */
  mode?: "demo" | "custom";
  fruit: FruitKey;
  irrigation: boolean;
  selectedIds: string[];
  activeId: string | null;
  region: { kraj: string; okres: string; obec: string; katastr: string };
  layers: Record<string, boolean>;
  economicsByFruit: Partial<Record<FruitKey, EconomicsInputs>>;
  drawnGeometry: PolygonGeometry | null;
  demoProfileId?: string | null;
  parcels?: AnalysisArea[];
  workingAreas?: AnalysisArea[];
  areaNames?: Record<string, string>;
  hiddenSampleIds?: string[];
}

export function loadState(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed !== "object") return null;
    return migrateState(parsed);
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage může být zakázaný (privátní režim) – aplikace musí fungovat dál.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export const STORAGE_KEY = KEY;
export interface SplitRecord {
  id: string;
  source: AnalysisArea;
  childIds: string[];
  selectedIds: string[];
  fruit: FruitKey;
}
