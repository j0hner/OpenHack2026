import type { AnalysisArea } from '../lib/types';

/**
 * PŘEDNAČTENÉ UKÁZKOVÉ PLOCHY (DEMO DATA)
 *
 * Geometrie jsou zjednodušené polygony v reálném území ČR, NIKOLI skutečné
 * katastrální parcely. V UI jsou proto označené jako „ukázková plocha“.
 * Atributy půdy, klimatu, vláhy, terénu a dostupnosti jsou modelové hodnoty
 * odvozené z typických podmínek dané oblasti – jsou to demo data, ne měření
 * konkrétní parcely. Popisky v aplikaci to říkají na každém místě, kde se s nimi
 * pracuje.
 */

const availabilityFull = {
  soil: 'complete',
  climate: 'complete',
  water: 'complete',
  terrain: 'complete',
  access: 'complete',
} as const;

export const DEMO_AREAS: AnalysisArea[] = [
  {
    id: 'demo-a',
    tag: 'A',
    name: 'Ukázková plocha A – Bílany',
    kind: 'sample',
    landUse: 'orná půda',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [17.4095, 49.3062],
          [17.415, 49.3065],
          [17.4153, 49.3037],
          [17.4098, 49.3034],
          [17.4095, 49.3062],
        ],
      ],
    },
    location: {
      code: 'DEMO-A',
      katastr: 'Bílany',
      obec: 'Kroměříž',
      okres: 'Kroměříž',
      kraj: 'Zlínský kraj',
    },
    story: 'Úrodná Haná, hluboká černozem, dostatek srážek a dobrý přístup. Referenční „příznivý“ pozemek.',
    sourceNote: 'Ukázková plocha (demo geometrie), atributy = modelový profil oblasti Haná.',
    irrigationAvailable: true,
    attributes: {
      soil: {
        bpej: '06.20.01',
        soilType: 'černozem modální',
        texture: 'hlinitá',
        depthCm: 95,
        ph: 6.9,
        humusPct: 3.1,
      },
      climate: {
        tempAvgC: 9.0,
        rainfallMm: 565,
        frostDays: 22,
        frostRisk: 'střední',
        heatDays: 26,
      },
      water: { droughtRisk: 34, irrigationNeedMm: 40, note: 'vláhová bilance příznivá, závlaha doplňková' },
      terrain: { slopeDeg: 1.4, aspect: 'J', erosionRisk: 'nízké', altitudeM: 195 },
      access: { roadDistanceM: 120, shapeQuality: 88, note: 'příjezd z obecní cesty, pravidelný tvar' },
      constraints: { protectedArea: null, floodZone: null, note: 'bez zjištěného střetu (demo)' },
    },
    availability: { ...availabilityFull },
  },
  {
    id: 'demo-b',
    tag: 'B',
    name: 'Ukázková plocha B – Staňkovice',
    kind: 'sample',
    landUse: 'orná půda',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [13.47, 50.3565],
          [13.4766, 50.3568],
          [13.4769, 50.3536],
          [13.4703, 50.3533],
          [13.47, 50.3565],
        ],
      ],
    },
    location: {
      code: 'DEMO-B',
      katastr: 'Staňkovice u Žatce',
      obec: 'Staňkovice',
      okres: 'Louny',
      kraj: 'Ústecký kraj',
    },
    story: 'Teplá a suchá Žatecká pánev. Kvalitní půda, ale výrazný nedostatek vláhy; část plochy v záplavovém území Ohře.',
    sourceNote: 'Ukázková plocha (demo geometrie), atributy = modelový profil Žatecka.',
    irrigationAvailable: true,
    attributes: {
      soil: {
        bpej: '01.12.02',
        soilType: 'černozem na spraši',
        texture: 'hlinitá',
        depthCm: 90,
        ph: 7.2,
        humusPct: 2.4,
      },
      climate: {
        tempAvgC: 9.3,
        rainfallMm: 410,
        frostDays: 20,
        frostRisk: 'střední',
        heatDays: 36,
        note: 'výrazné letní sucho, vysoký výpar',
      },
      water: {
        droughtRisk: 84,
        irrigationNeedMm: 130,
        note: 'bez závlahy opakovaný vláhový deficit v červenci a srpnu',
      },
      terrain: { slopeDeg: 2.1, aspect: 'JZ', erosionRisk: 'střední', altitudeM: 205 },
      access: { roadDistanceM: 210, shapeQuality: 79, note: 'příjezd po polní cestě, nutná úprava vjezdu' },
      constraints: {
        protectedArea: null,
        floodZone: 'Záplavové území Q100 – Blšanka',
        note: 'jižní část plochy zasahuje do záplavového území (demo)',
      },
    },
    availability: { ...availabilityFull },
  },
  {
    id: 'demo-c',
    tag: 'C',
    name: 'Ukázková plocha C – Horní Maršov',
    kind: 'sample',
    landUse: 'trvalý travní porost',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [15.8125, 50.662],
          [15.819, 50.6624],
          [15.8196, 50.6588],
          [15.8131, 50.6584],
          [15.8125, 50.662],
        ],
      ],
    },
    location: {
      code: 'DEMO-C',
      katastr: 'Horní Maršov',
      obec: 'Horní Maršov',
      okres: 'Trutnov',
      kraj: 'Královéhradecký kraj',
    },
    story: 'Horská poloha u Krkonoš. Chybí půdní i klimatické podklady – ukázka poctivého stavu „Nedostatek dat“.',
    sourceNote: 'Ukázková plocha (demo geometrie). Půdní a klimatické podklady záměrně nedostupné.',
    irrigationAvailable: false,
    attributes: {
      soil: null,
      climate: null,
      water: null,
      terrain: { slopeDeg: 13.8, aspect: 'JV', erosionRisk: 'vysoké', altitudeM: 640 },
      access: { roadDistanceM: 380, shapeQuality: 62, note: 'příjezd po obecní cestě, svažitý vjezd' },
      constraints: {
        protectedArea: 'KRNAP – ochranné pásmo',
        floodZone: null,
        note: 'nutné ověřit režim ochrany přírody před jakýmkoli záměrem',
      },
    },
    availability: {
      soil: 'missing',
      climate: 'missing',
      water: 'missing',
      terrain: 'complete',
      access: 'complete',
    },
  },
  {
    id: 'demo-d',
    tag: 'D',
    name: 'Ukázková plocha D – Hustopeče',
    kind: 'sample',
    landUse: 'orná půda',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [16.727, 48.9412],
          [16.7338, 48.9416],
          [16.7342, 48.9384],
          [16.7274, 48.938],
          [16.727, 48.9412],
        ],
      ],
    },
    location: {
      code: 'DEMO-D',
      katastr: 'Hustopeče u Brna',
      obec: 'Hustopeče',
      okres: 'Břeclav',
      kraj: 'Jihomoravský kraj',
    },
    story: 'Teplá jižní Morava, vhodná pro meruňky a slivoně; vyšší riziko sucha a jarních mrazů.',
    sourceNote: 'Ukázková plocha (demo geometrie), atributy = modelový profil Hustopečska.',
    irrigationAvailable: true,
    attributes: {
      soil: {
        bpej: '06.12.02',
        soilType: 'černozem luvická',
        texture: 'hlinitá',
        depthCm: 85,
        ph: 7.2,
        humusPct: 2.2,
      },
      climate: {
        tempAvgC: 9.6,
        rainfallMm: 480,
        frostDays: 16,
        frostRisk: 'střední',
        heatDays: 40,
        note: 'velmi teplá poloha, riziko pozdních mrazů v květu',
      },
      water: { droughtRisk: 62, irrigationNeedMm: 90, note: 'vláhový deficit zejména v červenci' },
      terrain: { slopeDeg: 3.5, aspect: 'JZ', erosionRisk: 'střední', altitudeM: 220 },
      access: { roadDistanceM: 260, shapeQuality: 74, note: 'příjezd ze silnice III. třídy' },
      constraints: { protectedArea: null, floodZone: null, note: 'bez zjištěného střetu (demo)' },
    },
    availability: { ...availabilityFull },
  },
  {
    id: 'demo-e',
    tag: 'E',
    name: 'Ukázková plocha E – Třebíč',
    kind: 'sample',
    landUse: 'orná půda',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [15.8725, 49.2163],
          [15.879, 49.2166],
          [15.8793, 49.2132],
          [15.8728, 49.2129],
          [15.8725, 49.2163],
        ],
      ],
    },
    location: {
      code: 'DEMO-E',
      katastr: 'Třebíč',
      obec: 'Třebíč',
      okres: 'Třebíč',
      kraj: 'Kraj Vysočina',
    },
    story: 'Chladnější Vysočina s dostatkem srážek. Vhodná spíše pro jabloň a slivoň, vyšší riziko mrazů.',
    sourceNote: 'Ukázková plocha (demo geometrie), atributy = modelový profil Třebíčska.',
    irrigationAvailable: false,
    attributes: {
      soil: {
        bpej: '29.11.02',
        soilType: 'kambizem modální',
        texture: 'hlinitopísčitá',
        depthCm: 65,
        ph: 5.6,
        humusPct: 1.9,
        note: 'kyselejší půda, vhodné vápnění',
      },
      climate: {
        tempAvgC: 7.6,
        rainfallMm: 645,
        frostDays: 42,
        frostRisk: 'vysoké',
        heatDays: 8,
        note: 'delší chladné jaro, časté přízemní mrazy',
      },
      water: { droughtRisk: 20, irrigationNeedMm: 10, note: 'srážkově příznivé, závlaha zpravidla není nutná' },
      terrain: { slopeDeg: 5.6, aspect: 'S', erosionRisk: 'střední', altitudeM: 470 },
      access: { roadDistanceM: 450, shapeQuality: 68, note: 'delší příjezd po polní cestě' },
      constraints: { protectedArea: null, floodZone: null, note: 'bez zjištěného střetu (demo)' },
    },
    availability: { ...availabilityFull },
  },
];

export const findDemoArea = (id: string) => DEMO_AREAS.find((a) => a.id === id);
