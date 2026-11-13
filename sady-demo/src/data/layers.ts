import type { GeoJSONFeature, MapLayerDef } from '../lib/types';
import { DEMO_AREAS } from './demoAreas';

/**
 * Mapové vrstvy.
 *
 * Vrstvy označené quality: 'demo' jsou lokálně vytvořené ilustrativní geometrie
 * navázané na ukázkové plochy. NEJSOU to stažená data ČÚZK, LPIS ani AOPK.
 * Každá vrstva nese příznak `usedInModel`, tedy zda její hodnoty vstupují do
 * skórovacího modelu, nebo je vrstva pouze orientační.
 */

type Bbox = [number, number, number, number];

const bboxOf = (coordinates: number[][][]): Bbox => {
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  for (const ring of coordinates) {
    for (const [lon, lat] of ring) {
      w = Math.min(w, lon);
      e = Math.max(e, lon);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
  }
  return [w, s, e, n];
};

const rect = (w: number, s: number, e: number, n: number): number[][][] => [
  [
    [w, s],
    [e, s],
    [e, n],
    [w, n],
    [w, s],
  ],
];

const feature = (geometry: GeoJSONFeature['geometry'], properties: GeoJSONFeature['properties']): GeoJSONFeature => ({
  type: 'Feature',
  properties,
  geometry,
});

const polygon = (coordinates: number[][][], properties: GeoJSONFeature['properties']): GeoJSONFeature =>
  feature({ type: 'Polygon', coordinates }, properties);

/** Rozšíří obdélník kolem plochy o zadaný podíl (pro ilustrativní vrstvy). */
const expand = ([w, s, e, n]: Bbox, ratio = 0.35): Bbox => {
  const dx = (e - w) * ratio;
  const dy = (n - s) * ratio;
  return [w - dx, s - dy, e + dx, n + dy];
};

const areaBbox = (id: string): Bbox => {
  const area = DEMO_AREAS.find((a) => a.id === id);
  if (!area) return [14, 49, 15, 50];
  return bboxOf(area.geometry.coordinates);
};

const midX = ([w, , e]: Bbox) => (w + e) / 2;

/* ---------- LPIS – zemědělské půdní bloky (demo) ---------- */
const lpisFeatures: GeoJSONFeature[] = ['demo-a', 'demo-b', 'demo-d', 'demo-e'].flatMap((id, index) => {
  const [w, s, e, n] = expand(areaBbox(id), 0.55);
  return [
    polygon(rect(w, s, e, n), {
      label: `Blok ${4201 + index}/${index + 3}`,
      detail: 'orná půda, výměra cca 20–40 ha (demo)',
    }),
  ];
});

/* ---------- BPEJ (demo) ---------- */
const bpejUnits: Record<string, { code: string; name: string; classColor: string; className: string }[]> = {
  'demo-a': [
    { code: '06.20.01', name: 'černozem modální, hlinitá', classColor: '#4d7f3f', className: 'bonita 1' },
    { code: '06.20.04', name: 'černozem modální, mírně skeletovitá', classColor: '#8cbf5a', className: 'bonita 2' },
  ],
  'demo-b': [
    { code: '01.12.02', name: 'černozem na spraši, hlinitá', classColor: '#8cbf5a', className: 'bonita 2' },
    { code: '01.22.12', name: 'černozem luvická, hlinitá', classColor: '#d9c25a', className: 'bonita 3' },
  ],
  'demo-d': [
    { code: '06.12.02', name: 'černozem luvická, hlinitá', classColor: '#8cbf5a', className: 'bonita 2' },
    { code: '06.32.01', name: 'černozem erodovaná, hlinitá', classColor: '#d9c25a', className: 'bonita 3' },
  ],
  'demo-e': [
    { code: '29.11.02', name: 'kambizem modální, hlinitopísčitá', classColor: '#d9c25a', className: 'bonita 3' },
    { code: '29.11.05', name: 'kambizem kyselá, hlinitopísčitá', classColor: '#c98d4a', className: 'bonita 4' },
  ],
};

const bpejFeatures: GeoJSONFeature[] = Object.entries(bpejUnits).flatMap(([id, units]) => {
  const box = expand(areaBbox(id), 0.18);
  const m = midX(box);
  const [w, s, e, n] = box;
  return units.map((unit, i) =>
    polygon(rect(i === 0 ? w : m, s, i === 0 ? m : e, n), {
      label: `BPEJ ${unit.code}`,
      detail: `${unit.name} – ${unit.className} (demo)`,
      color: unit.classColor,
    }),
  );
});

/* ---------- Sklon a orientace (demo) ---------- */
const terrainClasses: Record<string, { slope: string; color: string; aspect: string }[]> = {
  'demo-a': [
    { slope: '0–3°', color: '#e3efd8', aspect: 'jih' },
    { slope: '3–8°', color: '#f2e7b8', aspect: 'jihovýchod' },
  ],
  'demo-b': [
    { slope: '0–3°', color: '#e3efd8', aspect: 'jihozápad' },
    { slope: '3–8°', color: '#f2e7b8', aspect: 'západ' },
  ],
  'demo-c': [
    { slope: '8–15°', color: '#e7b98f', aspect: 'jihovýchod' },
    { slope: '> 15°', color: '#d1836b', aspect: 'východ' },
  ],
  'demo-d': [
    { slope: '0–3°', color: '#e3efd8', aspect: 'jihozápad' },
    { slope: '3–8°', color: '#f2e7b8', aspect: 'jih' },
  ],
  'demo-e': [
    { slope: '3–8°', color: '#f2e7b8', aspect: 'sever' },
    { slope: '8–15°', color: '#e7b98f', aspect: 'severozápad' },
  ],
};

const terrainFeatures: GeoJSONFeature[] = Object.entries(terrainClasses).flatMap(([id, units]) => {
  const box = expand(areaBbox(id), 0.9);
  const m = midX(box);
  const [w, s, e, n] = box;
  return units.map((unit, i) =>
    polygon(rect(i === 0 ? w : m, s, i === 0 ? m : e, n), {
      label: `sklon ${unit.slope}`,
      detail: `orientace ${unit.aspect} (demo odhad z výškového modelu)`,
      color: unit.color,
    }),
  );
});

/* ---------- Sucho / dostupnost vláhy (demo) ---------- */
const droughtZones = [
  { id: 'demo-b', color: '#b8462f', label: 'vysoké riziko sucha', detail: 'Modelový deficit vláhy, průměrné srážky 410 mm (demo).' },
  { id: 'demo-d', color: '#dd9a4e', label: 'střední riziko sucha', detail: 'Teplá oblast s letním vláhovým deficitem (demo).' },
  { id: 'demo-a', color: '#e8d79a', label: 'nižší riziko sucha', detail: 'Srážkově příznivější nížina (demo).' },
  { id: 'demo-e', color: '#a9c98a', label: 'nízké riziko sucha', detail: 'Vysočina s vyššími srážkami (demo).' },
  { id: 'demo-c', color: '#a9c98a', label: 'nízké riziko sucha', detail: 'Horská poloha, vyšší srážky (demo).' },
];

const droughtFeatures: GeoJSONFeature[] = droughtZones.map((zone) => {
  const [w, s, e, n] = expand(areaBbox(zone.id), 2.6);
  return polygon(rect(w, s, e, n), { label: zone.label, detail: zone.detail, color: zone.color });
});

/* ---------- Mrazové riziko (demo) ---------- */
const frostZones = [
  { id: 'demo-e', color: '#3f68b0', label: 'vysoké mrazové riziko', detail: 'Chladné jaro, 42 mrazových dnů (demo).' },
  { id: 'demo-c', color: '#3f68b0', label: 'vysoké mrazové riziko', detail: 'Horská poloha, časté přízemní mrazy (demo).' },
  { id: 'demo-a', color: '#8fb4e0', label: 'střední mrazové riziko', detail: 'Nížina s mírným jarem (demo).' },
  { id: 'demo-b', color: '#8fb4e0', label: 'střední mrazové riziko', detail: 'Teplá pánev, riziko inverzních mrazíků (demo).' },
  { id: 'demo-d', color: '#c7dcf2', label: 'nižší mrazové riziko', detail: 'Velmi teplá poloha, riziko pozdních mrazů v květu (demo).' },
];

const frostFeatures: GeoJSONFeature[] = frostZones.map((zone) => {
  const [w, s, e, n] = expand(areaBbox(zone.id), 2.2);
  return polygon(rect(w, s, e, n), { label: zone.label, detail: zone.detail, color: zone.color });
});

/* ---------- Záplavové území (demo) ---------- */
const floodFeatures: GeoJSONFeature[] = [
  polygon(rect(13.466, 50.3508, 13.4805, 50.3539), {
    label: 'záplavové území Q100 – Blšanka',
    detail: 'Ilustrativní průběh záplavového území. Ověřit u vodoprávního úřadu.',
    color: '#6fb9e0',
  }),
];

/* ---------- Chráněná území (demo) ---------- */
const protectedFeatures: GeoJSONFeature[] = [
  polygon(rect(15.8065, 50.6555, 15.8265, 50.6665), {
    label: 'KRNAP – ochranné pásmo',
    detail: 'Ilustrativní hranice ochranného pásma. Ověřit u AOPK ČR / Správy KRNAP.',
    color: '#5c8f3f',
  }),
];

/* ---------- Dostupnost cest (demo) ---------- */
const roadLines: { id: string; coords: number[][] }[] = [
  { id: 'demo-a', coords: [[17.3995, 49.3048], [17.4095, 49.3048], [17.412, 49.3048]] },
  { id: 'demo-b', coords: [[13.462, 50.3596], [13.4715, 50.3556], [13.4735, 50.355]] },
  { id: 'demo-c', coords: [[15.8065, 50.6525], [15.814, 50.658], [15.8168, 50.6595]] },
  { id: 'demo-d', coords: [[16.7205, 48.939], [16.7295, 48.9395], [16.7305, 48.9396]] },
  { id: 'demo-e', coords: [[15.8675, 49.2105], [15.8765, 49.214], [15.878, 49.2145]] },
];

const roadFeatures: GeoJSONFeature[] = roadLines.map((line) =>
  feature({ type: 'LineString', coordinates: line.coords }, {
    label: 'příjezdová cesta (demo)',
    detail: 'Ilustrativní dostupnost, nikoli data RÚIAN/OSM.',
  }),
);

export const MAP_LAYERS: MapLayerDef[] = [
  {
    id: 'lpis',
    name: 'Zemědělské půdní bloky',
    description:
      'Orientační hranice půdních bloků LPIS. V demu pouze ilustruje zemědělské využití, do výpočtu vhodnosti nevstupuje.',
    quality: 'demo',
    usedInModel: false,
    legend: [{ color: '#8aa05a', label: 'půdní blok (demo)' }],
    source: 'LPIS (MZe) – zamýšlený zdroj, v demu nenapojeno',
    features: lpisFeatures,
  },
  {
    id: 'bpej',
    name: 'Půda a BPEJ',
    description:
      'Bonitované půdně ekologické jednotky a půdní vlastnosti. V demu jde o modelové jednotky přiřazené ukázkovým plochám; vstupují do kategorie půda.',
    quality: 'demo',
    usedInModel: true,
    legend: [
      { color: '#4d7f3f', label: 'bonita 1 (nejvyšší)' },
      { color: '#8cbf5a', label: 'bonita 2' },
      { color: '#d9c25a', label: 'bonita 3' },
      { color: '#c98d4a', label: 'bonita 4' },
    ],
    source: 'BPEJ (MZe / VÚMOP) – zamýšlený zdroj, v demu modelové jednotky',
    features: bpejFeatures,
  },
  {
    id: 'terrain',
    name: 'Terén, sklon a orientace',
    description:
      'Sklon a expozice svahu. V demu odhad z výškového modelu; vstupuje do kategorie terén a ovlivňuje erozní riziko.',
    quality: 'demo',
    usedInModel: true,
    legend: [
      { color: '#e3efd8', label: 'sklon 0–3°' },
      { color: '#f2e7b8', label: 'sklon 3–8°' },
      { color: '#e7b98f', label: 'sklon 8–15°' },
      { color: '#d1836b', label: 'sklon nad 15°' },
    ],
    source: 'ČÚZK DMR 5G – zamýšlený zdroj, v demu odhad',
    features: terrainFeatures,
  },
  {
    id: 'drought',
    name: 'Sucho a dostupnost vláhy',
    description:
      'Modelové zóny vláhového deficitu. Vstupují do kategorie vláha; závlahu lze v analýze zapnout jako opatření.',
    quality: 'demo',
    usedInModel: true,
    legend: [
      { color: '#a9c98a', label: 'nízké riziko sucha' },
      { color: '#e8d79a', label: 'nižší riziko' },
      { color: '#dd9a4e', label: 'střední riziko' },
      { color: '#b8462f', label: 'vysoké riziko' },
    ],
    source: 'ČHMÚ / InterSucho – zamýšlený zdroj, v demu modelové zóny',
    features: droughtFeatures,
  },
  {
    id: 'frost',
    name: 'Mrazové riziko',
    description:
      'Historické riziko jarních mrazů v květu. V demu modelové zóny vstupující do kategorie klima.',
    quality: 'demo',
    usedInModel: true,
    legend: [
      { color: '#c7dcf2', label: 'nižší riziko' },
      { color: '#8fb4e0', label: 'střední riziko' },
      { color: '#3f68b0', label: 'vysoké riziko' },
    ],
    source: 'ČHMÚ – zamýšlený zdroj, v demu modelové zóny',
    features: frostFeatures,
  },
  {
    id: 'flood',
    name: 'Záplavová území',
    description:
      'Orientační záplavové území. V demu ilustruje územní kolizi u plochy B – vždy je nutné ověření u vodoprávního úřadu.',
    quality: 'demo',
    usedInModel: true,
    legend: [{ color: '#6fb9e0', label: 'záplavové území Q100 (demo)' }],
    source: 'VÚV TGM / vodohospodářské mapy – zamýšlený zdroj, v demu ilustrace',
    features: floodFeatures,
  },
  {
    id: 'protected',
    name: 'Chráněná území',
    description:
      'Orientační hranice ochranného pásma KRNAP u plochy C. Vstupuje do územních omezení, nikoli do skóre.',
    quality: 'demo',
    usedInModel: true,
    legend: [{ color: '#5c8f3f', label: 'ochranné pásmo ZCHÚ (demo)' }],
    source: 'AOPK ČR – zamýšlený zdroj, v demu ilustrace',
    features: protectedFeatures,
  },
  {
    id: 'roads',
    name: 'Dostupnost cest',
    description:
      'Ilustrativní příjezdové cesty k ukázkovým plochám. V demu pouze orientační, atributy přístupu jsou modelové.',
    quality: 'demo',
    usedInModel: false,
    legend: [{ color: '#b06f2f', label: 'příjezd (demo)' }],
    source: 'RÚIAN / OpenStreetMap – zamýšlený zdroj, v demu ilustrace',
    features: roadFeatures,
  },
  {
    id: 'suitability',
    name: 'Vhodnost pro zvolený druh',
    description:
      'Barevné označení ukázkových ploch podle výsledku skórovacího modelu pro aktuálně zvolený ovocný druh. Tato vrstva je výstupem modelu, nikoli vstupem.',
    quality: 'assumption',
    usedInModel: false,
    legend: [
      { color: '#2f7d4f', label: 'vhodný (75+)' },
      { color: '#c9a227', label: 'vhodný s opatřeními (55–74)' },
      { color: '#b8432f', label: 'rizikový (< 55)' },
      { color: '#8a8f98', label: 'nedostatek dat' },
    ],
    source: 'Výpočet demo modelu SADY',
    features: [],
  },
];

export const DEFAULT_LAYERS: Record<string, boolean> = {
  lpis: false,
  bpej: false,
  terrain: false,
  drought: false,
  frost: false,
  flood: false,
  protected: false,
  roads: false,
  suitability: true,
};
