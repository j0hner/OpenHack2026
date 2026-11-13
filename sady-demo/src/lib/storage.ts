import type { EconomicsInputs, FruitKey, PolygonGeometry } from './types';

const KEY = 'sady-demo-v1';

export interface PersistedState {
  mode: 'demo' | 'custom';
  fruit: FruitKey;
  irrigation: boolean;
  selectedIds: string[];
  activeId: string | null;
  region: { kraj: string; okres: string; obec: string; katastr: string };
  layers: Record<string, boolean>;
  economicsByFruit: Partial<Record<FruitKey, EconomicsInputs>>;
  drawnGeometry: PolygonGeometry | null;
  demoProfileId: string | null;
}

export function loadState(): Partial<PersistedState> | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage může být zakázaný (privátní režim) – demo musí fungovat dál.
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
