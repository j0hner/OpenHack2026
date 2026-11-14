import type { MapLayerDef } from "../lib/types";

export const MAP_LAYERS: MapLayerDef[] = [
  {
    id: "bpej",
    name: "Půda a BPEJ",
    description:
      "Skutečné jednotky BPEJ v připravených prostorových výřezech. Kódy a plošné podíly jsou v detailu. pH ani humus z nich neurčujeme.",
    quality: "real",
    usedInModel: false,
    legend: [{ color: "#ba8b54", label: "BPEJ – kód jednotky" }],
    source: "ČÚZK / RÚIAN – BPEJ",
    features: [],
  },
  {
    id: "protected",
    name: "Chráněná území",
    description:
      "Velko- a maloplošná ZCHÚ, EVL a ptačí oblasti. Celostátní mapová služba AOPK je zobrazená trvale; podmínky výsadby je nutné ověřit u příslušného orgánu.",
    quality: "real",
    usedInModel: false,
    legend: [{ color: "#5c8f3f", label: "Vybrané kategorie ochrany" }],
    source: "AOPK ČR – otevřená data",
    features: [],
  },
  {
    id: "suitability",
    name: "Vhodnost pro zvolený druh",
    description:
      "Barevné označení uložených pozemků podle regionálního indexu pro jejich ovocný druh. Jde o výstup orientačního modelu, nikoli měření nebo pravděpodobnost úspěchu.",
    quality: "assumption",
    usedInModel: false,
    legend: [
      { color: "#2f7d4f", label: "vhodný (75+)" },
      { color: "#c9a227", label: "vhodný s opatřeními (55–74)" },
      { color: "#b8432f", label: "rizikový (<55)" },
      { color: "#8a8f98", label: "nedostatek dat" },
    ],
    source: "Regionální index Moje Sady ze skutečných prostorových podkladů",
    features: [],
  },
];
export const DEFAULT_LAYERS: Record<string, boolean> = {
  bpej: false,
  protected: true,
  suitability: true,
  coverage: true,
};
