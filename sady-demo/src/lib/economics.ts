import { areaHa as geometryAreaHa, perimeterM } from './geo';
import type {
  AnalysisArea,
  CashFlowYear,
  EconomicsInputs,
  EconomicsResult,
  EconomicsScenarioKey,
  FruitKey,
} from './types';

/**
 * EKONOMICKÝ MODEL DEMO
 *
 * Všechny výpočty vycházejí výhradně ze vstupů v panelu Ekonomika.
 * Ceny, výnosy a náklady jsou modelové předpoklady, nikoli nabídky dodavatelů
 * ani zaručené výsledky. Podpora je modelová částka vyžadující ověření podmínek.
 */

export const SCENARIOS: EconomicsScenarioKey[] = [
  {
    key: 'conservative',
    label: 'Konzervativní',
    yieldFactor: 0.75,
    priceFactor: 0.85,
    costFactor: 1.1,
    note: 'nižší výnos, nižší cena, vyšší náklady',
  },
  {
    key: 'base',
    label: 'Základní',
    yieldFactor: 1,
    priceFactor: 1,
    costFactor: 1,
    note: 'vstupní hodnoty bez úprav',
  },
  {
    key: 'favorable',
    label: 'Příznivý',
    yieldFactor: 1.15,
    priceFactor: 1.1,
    costFactor: 0.97,
    note: 'vyšší výnos a cena, mírně nižší náklady',
  },
];

export const IRRIGATION_ANNUAL_PER_HA = 3800;

export function computeTreeCount(
  areaHa: number,
  usefulSharePct: number,
  rowSpacingM: number,
  treeSpacingM: number,
): number {
  if (areaHa <= 0 || rowSpacingM <= 0 || treeSpacingM <= 0) return 0;
  const usefulM2 = areaHa * 10_000 * (usefulSharePct / 100);
  return Math.max(0, Math.floor(usefulM2 / (rowSpacingM * treeSpacingM)));
}

interface ComputeOptions {
  irrigation: boolean;
  subsidy: boolean;
  scenario: EconomicsScenarioKey;
}

export function computeEconomics(
  area: AnalysisArea,
  _fruit: FruitKey,
  inputs: EconomicsInputs,
  options: ComputeOptions,
): EconomicsResult {
  const scenario = options.scenario;
  const areaHa = geometryAreaHa(area.geometry);
  const usableAreaHa = areaHa * (inputs.usefulSharePct / 100);
  const treeCount = computeTreeCount(areaHa, inputs.usefulSharePct, inputs.rowSpacingM, inputs.treeSpacingM);

  const fence = Math.round(perimeterM(area.geometry) * inputs.fenceCostPerM);
  const irrigationInvestment = options.irrigation ? Math.round(inputs.irrigationCostPerHa * areaHa) : 0;
  const land = inputs.landMode === 'purchase' ? Math.round(inputs.landPricePerHa * areaHa) : 0;
  const trees = Math.round(treeCount * (inputs.saplingCost + inputs.plantingCost));
  const total = trees + fence + irrigationInvestment + land;

  const lease = inputs.landMode === 'lease' ? inputs.leasePerHaYear * areaHa : 0;
  const annualCostsMature = Math.round(
    (areaHa * inputs.annualCostPerHa + treeCount * inputs.annualCostPerTree + lease) * scenario.costFactor +
      (options.irrigation ? IRRIGATION_ANNUAL_PER_HA * areaHa : 0),
  );

  const droughtRisk = area.regional ? 0 : area.attributes.water?.droughtRisk ?? 30;
  const irrigationUpliftPct = options.irrigation ? Math.round(Math.min(18, droughtRisk * 0.18)) : 0;

  const maturityYield = areaHa * inputs.matureYieldTPerHa * scenario.yieldFactor * (1 + irrigationUpliftPct / 100);
  const matureRevenue = Math.round(maturityYield * 1000 * inputs.pricePerKg * scenario.priceFactor);

  const subsidyTotal = options.subsidy ? Math.round(inputs.subsidyPerHa * areaHa) : 0;
  const rate = inputs.discountRatePct / 100;

  const flows: CashFlowYear[] = [];
  let cumulative = -total;
  let npv = -total;
  flows.push({
    year: 0,
    revenue: 0,
    costs: total,
    net: -total,
    cumulative,
    discounted: -total,
  });

  const rampDenominator = Math.max(1, inputs.rampYears);
  for (let year = 1; year <= inputs.horizonYears; year += 1) {
    const yearsBearing = year - inputs.yearsToBearing;
    const ramp = yearsBearing <= 0 ? 0 : Math.min(1, yearsBearing / rampDenominator);
    const revenue =
      Math.round(areaHa * inputs.matureYieldTPerHa * scenario.yieldFactor * (1 + irrigationUpliftPct / 100) * ramp * 1000 * inputs.pricePerKg * scenario.priceFactor) +
      (options.subsidy && year === 1 ? subsidyTotal : 0);
    const costs = annualCostsMature;
    const net = revenue - costs;
    const discounted = net / (1 + rate) ** year;
    cumulative += net;
    npv += discounted;
    flows.push({ year, revenue, costs, net, cumulative, discounted });
  }

  const payback = flows.find((flow) => flow.year > 0 && flow.cumulative >= 0)?.year ?? null;

  return {
    treeCount,
    usableAreaHa,
    investment: { trees, fence, irrigation: irrigationInvestment, land, total },
    annualCostsMature,
    matureRevenue,
    flows,
    npv: Math.round(npv),
    paybackYear: payback,
    subsidyTotal,
    irrigationUpliftPct,
  };
}

/** Poměr ročních nákladů k tržbám v plné plodnosti – orientační kontrola rentability. */
export const costRevenueRatio = (result: EconomicsResult): number | null =>
  result.matureRevenue > 0 ? result.annualCostsMature / result.matureRevenue : null;

export const scenarioNote = (key: string) => SCENARIOS.find((scenario) => scenario.key === key)?.note ?? '';
