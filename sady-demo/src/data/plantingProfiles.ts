import type { PlantingGeometrySettings } from "../lib/plantingGeometry";
import type { FruitKey } from "../lib/types";

/** A small curated set of numerical recommendations, not a spatial dataset.
 * The selected values are planning defaults inside the cited published ranges.
 * Suitability of a specific rootstock, cultivar and machinery is not inferred.
 */
export const PLANTING_SOURCE = {
  label: "MENDELU · Výsadbový plán ovocného sadu",
  url: "https://web2.mendelu.cz/af_291_projekty/files/10/skripta/index.php?I=8&J=0&K=0&N=4",
  checkedAt: "2026-11-14",
};

export interface PlantingProfile {
  id: string;
  label: string;
  rowSpacingM: number;
  treeSpacingM: number;
  rowRange: readonly [number, number];
  treeRange: readonly [number, number];
  note: string;
}

const PROFILES: Record<FruitKey, PlantingProfile[]> = {
  apple: [
    {
      id: "apple-wall",
      label: "Zakrslá podnož · ovocná stěna",
      rowSpacingM: 4,
      treeSpacingM: 1.5,
      rowRange: [3.5, 4.5],
      treeRange: [1, 2],
      note: "Hustší pěstební tvar vyžaduje odpovídající podnož a vedení koruny.",
    },
    {
      id: "apple-bush",
      label: "Zákrsek · volnější pásová výsadba",
      rowSpacingM: 5,
      treeSpacingM: 3,
      rowRange: [4, 5],
      treeRange: [2, 4],
      note: "Větší prostor pro koruny; nejde o spon vysokokmenů.",
    },
  ],
  pear: [
    {
      id: "pear-wall",
      label: "Stěnová výsadba",
      rowSpacingM: 4,
      treeSpacingM: 2.5,
      rowRange: [3.5, 4.5],
      treeRange: [1.5, 4],
      note: "Volbu podnože i opory je potřeba potvrdit pro danou odrůdu.",
    },
    {
      id: "pear-bush",
      label: "Zákrsek · volnější pásová výsadba",
      rowSpacingM: 5,
      treeSpacingM: 3.5,
      rowRange: [4, 6],
      treeRange: [2, 4],
      note: "Nejde o doporučení pro vzrůstný hrušňový semenáč.",
    },
  ],
  plum: [
    {
      id: "plum-strip",
      label: "Pásová výsadba slivoní",
      rowSpacingM: 5,
      treeSpacingM: 3.5,
      rowRange: [4, 6],
      treeRange: [2, 5],
      note: "Spon upravte podle síly růstu zvolené podnože a odrůdy.",
    },
  ],
  cherry: [
    {
      id: "cherry-wall",
      label: "Stěnová výsadba · nižší tvar",
      rowSpacingM: 5,
      treeSpacingM: 3,
      rowRange: [4, 6],
      treeRange: [2, 5],
      note: "Nižší tvar potřebuje vhodnou podnož a pravidelné vedení koruny.",
    },
    {
      id: "cherry-strip",
      label: "Volnější pásová výsadba",
      rowSpacingM: 6.5,
      treeSpacingM: 4.5,
      rowRange: [6, 7],
      treeRange: [4, 5],
      note: "Pro vzrůstné stromy může být potřeba ještě větší rozestup.",
    },
  ],
  apricot: [
    {
      id: "apricot-strip",
      label: "Pásová výsadba meruněk",
      rowSpacingM: 6.5,
      treeSpacingM: 4.5,
      rowRange: [6, 7],
      treeRange: [4, 5],
      note: "Výchozí návrh potřebuje ověření konkrétní podnože a tvaru koruny.",
    },
  ],
};

export const getPlantingProfiles = (
  fruit: FruitKey,
): readonly PlantingProfile[] => PROFILES[fruit];
export const getPlantingProfile = (
  fruit: FruitKey,
  id: string,
): PlantingProfile | undefined =>
  PROFILES[fruit].find((profile) => profile.id === id);
export function getDefaultPlantingSettings(
  fruit: FruitKey,
): PlantingGeometrySettings {
  const first = PROFILES[fruit][0];
  return {
    rowSpacingM: first.rowSpacingM,
    treeSpacingM: first.treeSpacingM,
    edgeClearanceM: 3,
    headlandM: 4,
    orientation: "auto",
    bearingDeg: 0,
  };
}
