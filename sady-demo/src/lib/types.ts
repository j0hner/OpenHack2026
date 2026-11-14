/**
 * Sdílené datové typy demo aplikace SADY.
 * UI, mapová logika, skórovací model i ekonomika pracují s těmito typy,
 * aby bylo možné demo data později nahradit skutečnými adaptéry.
 */

export type FruitKey = 'apple' | 'pear' | 'plum' | 'cherry' | 'apricot';

export type DataQuality = 'real' | 'precomputed' | 'assumption' | 'demo' | 'unavailable';

export type Availability = 'complete' | 'partial' | 'missing';

export type CategoryKey = 'soil' | 'climate' | 'water' | 'terrain' | 'access';

export type VerdictClass = 'good' | 'caution' | 'risk' | 'nodata';

export type AreaKind = 'sample' | 'custom' | 'parcel';

export interface SoilAttributes {
  bpej: string;
  soilType: string;
  texture: string;
  depthCm: number;
  ph: number;
  humusPct: number;
  note?: string;
}

export interface ClimateAttributes {
  tempAvgC: number;
  rainfallMm: number;
  frostDays: number;
  frostRisk: 'nízké' | 'střední' | 'vysoké';
  heatDays: number;
  note?: string;
}

export interface WaterAttributes {
  /** 0 = bez stresu suchem, 100 = extrémní nedostatek vláhy */
  droughtRisk: number;
  /** odhad potřeby doplňkové závlahy v mm/rok */
  irrigationNeedMm: number;
  note?: string;
}

export interface TerrainAttributes {
  slopeDeg: number;
  aspect: 'S' | 'SV' | 'V' | 'JV' | 'J' | 'JZ' | 'Z' | 'SZ' | 'rovina';
  erosionRisk: 'nízké' | 'střední' | 'vysoké';
  altitudeM: number;
}

export interface AccessAttributes {
  roadDistanceM: number;
  shapeQuality: number; // 0–100, tvar a sjízdnost pro techniku
  note?: string;
}

export interface ConstraintAttributes {
  protectedArea: string | null;
  floodZone: string | null;
  note?: string;
}

export interface AreaAttributes {
  soil: SoilAttributes | null;
  climate: ClimateAttributes | null;
  water: WaterAttributes | null;
  terrain: TerrainAttributes | null;
  access: AccessAttributes | null;
  constraints: ConstraintAttributes | null;
}

export type AvailabilityMap = Record<CategoryKey, Availability>;

export type PolygonGeometry = { type: 'Polygon'; coordinates: number[][][] };
export type AreaGeometry = PolygonGeometry | { type: 'MultiPolygon'; coordinates: number[][][][] };

export interface AreaLocation {
  code?: string;
  katastr: string;
  obec: string;
  okres: string;
  kraj: string;
}

export interface AnalysisArea {
  regional?: {status:'loading'|'ready'|'error';data:import('./regionalData').RegionalData|null;message?:string};
  derivedFrom?: {
    operation:'split'|'merge';
    sourceIds:string[];
    sourceNames:string[];
    /** Oldest known source areas, retained when intermediate working areas go away. */
    rootSourceIds?:string[];
    rootSourceNames?:string[];
    /** Official ancestors only; never makes a working child an official parcel. */
    rootCadastralIds?:string[];
  };
  id: string;
  /** 'A' | 'B' | 'C' u přednačtených ukázek */
  tag?: string;
  name: string;
  kind: AreaKind;
  landUse: string;
  geometry: AreaGeometry;
  cadastral?: {id:string;officialAreaM2:number|null};
  location: AreaLocation;
  attributes: AreaAttributes;
  availability: AvailabilityMap;
  sourceNote: string;
  /** krátké vysvětlení, proč je plocha v demu */
  story: string;
  irrigationAvailable?: boolean;
}

export interface CategoryScore {
  key: CategoryKey;
  label: string;
  weight: number;
  score: number | null;
  availability: Availability;
  status: 'computed' | 'partial' | 'missing';
  summary: string;
}

export interface RiskItem {
  label: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

export interface SuitabilityResult {
  fruit: FruitKey;
  overall: number | null;
  verdict: 'Vhodný' | 'Vhodný s opatřeními' | 'Rizikový' | 'Nedostatek dat';
  verdictClass: VerdictClass;
  reasons: string[];
  risks: RiskItem[];
  nextSteps: string[];
  categories: CategoryScore[];
  /** 0–100, vážená úplnost podkladů */
  completeness: number;
  missing: string[];
  assumptions: string[];
  constraints: { label: string; detail: string }[];
}

export interface EconomicsInputs {
  usefulSharePct: number;
  rowSpacingM: number;
  treeSpacingM: number;
  saplingCost: number;
  plantingCost: number;
  fenceCostPerM: number;
  irrigationCostPerHa: number;
  landMode: 'purchase' | 'lease';
  landPricePerHa: number;
  leasePerHaYear: number;
  annualCostPerHa: number;
  annualCostPerTree: number;
  pricePerKg: number;
  matureYieldTPerHa: number;
  yearsToBearing: number;
  rampYears: number;
  horizonYears: number;
  discountRatePct: number;
  subsidyPerHa: number;
  irrigation: boolean;
  subsidy: boolean;
}

export interface CashFlowYear {
  year: number;
  revenue: number;
  costs: number;
  net: number;
  cumulative: number;
  discounted: number;
}

export interface EconomicsResult {
  treeCount: number;
  usableAreaHa: number;
  investment: {
    trees: number;
    fence: number;
    irrigation: number;
    land: number;
    total: number;
  };
  annualCostsMature: number;
  matureRevenue: number;
  flows: CashFlowYear[];
  npv: number;
  paybackYear: number | null;
  subsidyTotal: number;
  irrigationUpliftPct: number;
}

export interface LayerLegendItem {
  color: string;
  label: string;
}

export interface MapLayerDef {
  id: string;
  name: string;
  description: string;
  quality: DataQuality;
  usedInModel: boolean;
  legend: LayerLegendItem[];
  source: string;
  /** vrstvy se kreslí z lokálně přibalených dat */
  features: GeoJSONFeature[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, string | number | null>;
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | { type: 'LineString'; coordinates: number[][] };
}

export interface ProvenanceRow {
  indicator: string;
  source: string;
  period: string;
  resolution: string;
  quality: DataQuality;
  connected: string;
  note?: string;
}

export interface RegionEntry {
  name: string;
  code: string;
  okresy?: RegionEntry[];
}

export interface EconomicsScenarioKey {
  key: 'conservative' | 'base' | 'favorable';
  label: string;
  yieldFactor: number;
  priceFactor: number;
  costFactor: number;
  note: string;
}
