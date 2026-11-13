import type { EconomicsInputs, FruitKey } from '../lib/types';

/**
 * Pěstitelské profily ovocných druhů.
 *
 * VŠECHNY hodnoty v tomto souboru jsou MODELOVÉ PŘEDPOKLADY pro demo.
 * Slouží k demonstraci výpočtu, nikoli jako odborné pěstitelské doporučení.
 * Profily jsou záměrně oddělené od UI i od skórovacího modelu, aby je šlo
 * nahradit odborně ověřenými údaji (ÚKZÚZ, VŠÚO Holovousy, MZe) beze změny UI.
 */

export interface FruitProfile {
  key: FruitKey;
  name: string;
  nameGenitive: string;
  emoji: string;
  spacing: { rows: number; trees: number; note: string };
  bearingYears: number;
  fullBearingYears: number;
  matureYieldTPerHa: number;
  pricePerKg: number;
  costs: { sapling: number; planting: number; annualPerHa: number; annualPerTree: number };
  needsPollinator: boolean;
  pollination: string;
  pruning: string;
  irrigation: string;
  protection: string;
  requirements: {
    phMin: number;
    phOptMin: number;
    phOptMax: number;
    phMax: number;
    depthMinCm: number;
    slopeMaxDeg: number;
    rainfallOptMm: number;
    frostSensitivity: number; // 1–5 (5 = velmi citlivý na jarní mrazy)
    droughtTolerance: number; // 1–5 (5 = dobře snáší sucho)
    heatNeed: number; // 1–5
    tempOptMinC: number;
    tempOptMaxC: number;
    altitudeMaxM: number;
  };
  advantages: string[];
  risks: string[];
}

export const FRUITS: Record<FruitKey, FruitProfile> = {
  apple: {
    key: 'apple',
    name: 'Jabloň',
    nameGenitive: 'jabloní',
    emoji: '🍎',
    spacing: { rows: 4.0, trees: 1.5, note: 'středně vzrůstné podnože (M9 / MM106)' },
    bearingYears: 3,
    fullBearingYears: 4,
    matureYieldTPerHa: 28,
    pricePerKg: 14,
    costs: { sapling: 180, planting: 90, annualPerHa: 26000, annualPerTree: 45 },
    needsPollinator: true,
    pollination:
      'Jabloň je cizosprašná. Vysaďte alespoň dvě odrůdy kvetoucí ve stejnou dobu (např. Gala + Golden Delicious) nebo ponechte opylovače v okolí.',
    pruning: 'Výchovný řez 1.–3. rok, dále každoroční zimní řez a letní probírka plodů.',
    irrigation:
      'Doplňková závlaha 60–100 mm za sezónu, kritické je období květen–srpen. Kapková závlaha je nejúspornější.',
    protection: 'Monitorovat strupovitost a padlí, květopase a obaleče; feromonové lapače od května.',
    requirements: {
      phMin: 5.2,
      phOptMin: 5.8,
      phOptMax: 7.0,
      phMax: 7.6,
      depthMinCm: 60,
      slopeMaxDeg: 10,
      rainfallOptMm: 600,
      frostSensitivity: 3,
      droughtTolerance: 2,
      heatNeed: 3,
      tempOptMinC: 7.5,
      tempOptMaxC: 9.8,
      altitudeMaxM: 550,
    },
    advantages: ['Široké uplatnění na trhu', 'Dobře zvládnutá agrotechnika', 'Více odrůd vhodných do ČR'],
    risks: ['Citlivost na jarní mrazy v květu', 'Strupovitost při vlhkém jaru', 'Potřeba opylovače'],
  },
  pear: {
    key: 'pear',
    name: 'Hrušeň',
    nameGenitive: 'hrušní',
    emoji: '🍐',
    spacing: { rows: 4.5, trees: 2.0, note: 'kdouloňové nebo semenáčové podnože' },
    bearingYears: 4,
    fullBearingYears: 5,
    matureYieldTPerHa: 22,
    pricePerKg: 19,
    costs: { sapling: 210, planting: 100, annualPerHa: 27000, annualPerTree: 50 },
    needsPollinator: true,
    pollination:
      'Hrušeň potřebuje opylovače – vhodná je jiná odrůda hrušně nebo některé okrasné hrušně v okolí.',
    pruning: 'Řez výchovný a udržovací, hrušně plodí na krátkých výhonech – řezat střídmě.',
    irrigation: 'Náročnější na vláhu než jabloň; doporučeno 80–120 mm doplňkové závlahy.',
    protection: 'Rzivost hrušně (mezihostitel jalovec), mšice, obaleč; sledovat spálu růžovitých.',
    requirements: {
      phMin: 5.5,
      phOptMin: 6.0,
      phOptMax: 7.2,
      phMax: 7.8,
      depthMinCm: 70,
      slopeMaxDeg: 9,
      rainfallOptMm: 620,
      frostSensitivity: 4,
      droughtTolerance: 2,
      heatNeed: 2,
      tempOptMinC: 7.0,
      tempOptMaxC: 9.4,
      altitudeMaxM: 500,
    },
    advantages: ['Vyšší realizační cena', 'Vhodné do teplejších poloh', 'Menší konkurence pěstitelů'],
    risks: ['Velmi citlivá na jarní mrazy', 'Rzivost hrušně', 'Kratší skladovatelnost některých odrůd'],
  },
  plum: {
    key: 'plum',
    name: 'Slivoň',
    nameGenitive: 'slivoní',
    emoji: '🫐',
    spacing: { rows: 5.0, trees: 3.0, note: 'myrobalán / Wangenheimova podnož' },
    bearingYears: 3,
    fullBearingYears: 4,
    matureYieldTPerHa: 18,
    pricePerKg: 17,
    costs: { sapling: 160, planting: 80, annualPerHa: 22000, annualPerTree: 35 },
    needsPollinator: true,
    pollination: 'Většina slivoní je částečně cizosprašná – vhodné vysadit dvě odrůdy.',
    pruning: 'Výchovný řez do 3 let, pak prosvětlovací řez; slivoně snášejí i radikálnější zmlazení.',
    irrigation: 'Střední nároky, 50–80 mm doplňkové závlahy v suchém létě.',
    protection: 'Šarka (přenos mšicemi) – jediné riziko, které může výsadbu zásadně omezit.',
    requirements: {
      phMin: 5.5,
      phOptMin: 6.0,
      phOptMax: 7.2,
      phMax: 7.8,
      depthMinCm: 60,
      slopeMaxDeg: 12,
      rainfallOptMm: 550,
      frostSensitivity: 3,
      droughtTolerance: 3,
      heatNeed: 3,
      tempOptMinC: 7.8,
      tempOptMaxC: 10.0,
      altitudeMaxM: 480,
    },
    advantages: ['Kratší náběh plodnosti', 'Dobrá tolerance sucha', 'Uplatnění pro přímý prodej i zpracování'],
    risks: ['Šarka švestky', 'Květopas a obaleči', 'Kratší trvanlivost plodů'],
  },
  cherry: {
    key: 'cherry',
    name: 'Třešeň',
    nameGenitive: 'třešní',
    emoji: '🍒',
    spacing: { rows: 5.5, trees: 3.5, note: 'zakrslé podnože (Gisela 5)' },
    bearingYears: 4,
    fullBearingYears: 5,
    matureYieldTPerHa: 14,
    pricePerKg: 32,
    costs: { sapling: 320, planting: 120, annualPerHa: 30000, annualPerTree: 60 },
    needsPollinator: true,
    pollination: 'Třešně jsou cizosprašné – potřebují vhodnou opylující odrůdu v dosahu včel.',
    pruning: 'Řez pouze v období vegetace (ochrana proti klejotoku), výchovný řez do 4 let.',
    irrigation: 'Vyšší nároky na vodu při nalévání plodů, 80–120 mm doplňkové závlahy.',
    protection: 'Vrtule třešňová, mšice, monilióza; krytí sítí proti ptákům u raných odrůd.',
    requirements: {
      phMin: 5.8,
      phOptMin: 6.2,
      phOptMax: 7.4,
      phMax: 7.9,
      depthMinCm: 80,
      slopeMaxDeg: 10,
      rainfallOptMm: 600,
      frostSensitivity: 4,
      droughtTolerance: 2,
      heatNeed: 4,
      tempOptMinC: 8.0,
      tempOptMaxC: 10.2,
      altitudeMaxM: 450,
    },
    advantages: ['Vysoká realizační cena', 'Dobrá mechanizace sklizně', 'Rychlý obrat při dobré kvalitě'],
    risks: ['Velmi citlivá na mrazy v květu', 'Ptáci a vrtule', 'Vyšší investice na hektar'],
  },
  apricot: {
    key: 'apricot',
    name: 'Meruňka',
    nameGenitive: 'meruněk',
    emoji: '🍑',
    spacing: { rows: 5.5, trees: 4.0, note: 'myrobalán nebo meruňkový semenáč' },
    bearingYears: 3,
    fullBearingYears: 4,
    matureYieldTPerHa: 13,
    pricePerKg: 38,
    costs: { sapling: 280, planting: 110, annualPerHa: 28000, annualPerTree: 55 },
    needsPollinator: true,
    pollination: 'Částečně cizosprašná, vhodné dvě odrůdy kvetoucí současně.',
    pruning: 'Silný řez po sklizni, ochrana ran; krátkověkost vyžaduje obnovu výsadby.',
    irrigation: 'V suchých oblastech je závlaha prakticky nutná – 100–140 mm za sezónu.',
    protection: 'Monilióza, mrazové poškození kmene, kadeřavost; výsadba na chráněných svazích.',
    requirements: {
      phMin: 6.0,
      phOptMin: 6.4,
      phOptMax: 7.5,
      phMax: 8.0,
      depthMinCm: 80,
      slopeMaxDeg: 9,
      rainfallOptMm: 520,
      frostSensitivity: 5,
      droughtTolerance: 4,
      heatNeed: 5,
      tempOptMinC: 8.8,
      tempOptMaxC: 10.6,
      altitudeMaxM: 350,
    },
    advantages: ['Nejvyšší cena za kg', 'Rané uvedení na trh', 'Vhodná do teplých oblastí'],
    risks: ['Nejcitlivější na jarní mrazy', 'Krátká životnost sadu', 'Monilióza a poškození kmene'],
  },
};

export const FRUIT_ORDER: FruitKey[] = ['apple', 'pear', 'plum', 'cherry', 'apricot'];

export const DEFAULT_ECONOMICS: EconomicsInputs = {
  usefulSharePct: 82,
  rowSpacingM: 4.0,
  treeSpacingM: 1.5,
  saplingCost: 180,
  plantingCost: 90,
  fenceCostPerM: 260,
  irrigationCostPerHa: 48000,
  landMode: 'lease',
  landPricePerHa: 850000,
  leasePerHaYear: 4500,
  annualCostPerHa: 26000,
  annualCostPerTree: 45,
  pricePerKg: 14,
  matureYieldTPerHa: 28,
  yearsToBearing: 3,
  rampYears: 4,
  horizonYears: 20,
  discountRatePct: 4,
  subsidyPerHa: 35000,
  irrigation: false,
  subsidy: false,
};

/** Ekonomické výchozí hodnoty podle druhu – po přepnutí druhu se doplní. */
export function economicsForFruit(fruit: FruitKey, previous?: EconomicsInputs): EconomicsInputs {
  const p = FRUITS[fruit];
  const base = previous ?? DEFAULT_ECONOMICS;
  return {
    ...base,
    rowSpacingM: p.spacing.rows,
    treeSpacingM: p.spacing.trees,
    saplingCost: p.costs.sapling,
    plantingCost: p.costs.planting,
    annualCostPerHa: p.costs.annualPerHa,
    annualCostPerTree: p.costs.annualPerTree,
    pricePerKg: p.pricePerKg,
    matureYieldTPerHa: p.matureYieldTPerHa,
    yearsToBearing: p.bearingYears,
    rampYears: p.fullBearingYears,
  };
}
