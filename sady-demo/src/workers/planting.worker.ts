import {
  generatePlantingLayout,
  type PlantingGeometrySettings,
  type PlantingLayout,
} from "../lib/plantingGeometry";
import type { AreaGeometry } from "../lib/types";

export interface PlantingWorkerRequest {
  geometry: AreaGeometry;
  settings: PlantingGeometrySettings;
}
export type PlantingWorkerResponse =
  | { layout: PlantingLayout }
  | { error: string };
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<PlantingWorkerRequest>) => void) | null;
  postMessage: (message: PlantingWorkerResponse) => void;
};
scope.onmessage = (event) => {
  try {
    scope.postMessage({
      layout: generatePlantingLayout(event.data.geometry, event.data.settings),
    });
  } catch (error) {
    scope.postMessage({
      error:
        error instanceof Error
          ? error.message
          : "Výpočet rozmístění se nepodařil.",
    });
  }
};
