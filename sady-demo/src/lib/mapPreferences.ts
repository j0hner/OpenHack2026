import { DEFAULT_LAYERS } from '../data/layers';
import type { PersistedState } from './storage';

export const LAYER_SETTINGS_VERSION = 1;

/** Enable automatic coverage once on upgrade, then retain deliberate toggles. */
export function initialMapLayers(state: Partial<PersistedState> | null): Record<string, boolean> {
  const layers: Record<string, boolean> = { ...DEFAULT_LAYERS, ...state?.layers, protected: true };
  if (state?.layerSettingsVersion !== LAYER_SETTINGS_VERSION) layers.coverage = true;
  return layers;
}
