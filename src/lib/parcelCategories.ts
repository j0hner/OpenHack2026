import { area as turfArea } from "@turf/area";
import { intersect } from "@turf/intersect";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { SCENARIOS, computeEconomics } from "./economics";
import { geometryBounds } from "./openData";
import type {
  AnalysisArea,
  EconomicsInputs,
  EconomicsResult,
  EconomicsScenarioKey,
  FruitKey,
} from "./types";

export interface ParcelCategory {
  id: string;
  name: string;
}
export interface ParcelCategoryState {
  categories: ParcelCategory[];
  assignments: Record<string, string>;
}
export interface CategoryControl {
  state: ParcelCategoryState;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAssign: (ids: string[], categoryId: string | null) => void;
}
export const UNASSIGNED_CATEGORY = "__unassigned__";
export const ALL_CATEGORIES = "__all__";

export function normalizeCategoryState(
  input: { categories?: unknown; assignments?: unknown } | null | undefined,
  areaIds: Iterable<string>,
): ParcelCategoryState {
  const categories: ParcelCategory[] = [],
    ids = new Set<string>(),
    names = new Set<string>();
  for (const value of Array.isArray(input?.categories)
    ? input.categories
    : []) {
    if (
      !value ||
      typeof value.id !== "string" ||
      typeof value.name !== "string"
    )
      continue;
    const name = value.name.trim().slice(0, 60),
      folded = name.toLocaleLowerCase("cs-CZ");
    if (
      !name ||
      !value.id.trim() ||
      [ALL_CATEGORIES, UNASSIGNED_CATEGORY].includes(value.id) ||
      ids.has(value.id) ||
      names.has(folded) ||
      categories.length >= 50
    )
      continue;
    categories.push({ id: value.id, name });
    ids.add(value.id);
    names.add(folded);
  }
  const allowedAreas = new Set(areaIds),
    assignments: Record<string, string> = {};
  if (
    input?.assignments &&
    typeof input.assignments === "object" &&
    !Array.isArray(input.assignments)
  )
    for (const [areaId, categoryId] of Object.entries(input.assignments))
      if (
        allowedAreas.has(areaId) &&
        typeof categoryId === "string" &&
        ids.has(categoryId)
      )
        assignments[areaId] = categoryId;
  return { categories, assignments };
}
function categoryName(
  state: ParcelCategoryState,
  value: string,
  except?: string,
) {
  const name = value.trim();
  if (!name || name.length > 60)
    throw Error("Název kategorie musí mít 1 až 60 znaků.");
  if (
    state.categories.some(
      (item) =>
        item.id !== except &&
        item.name.toLocaleLowerCase("cs-CZ") ===
          name.toLocaleLowerCase("cs-CZ"),
    )
  )
    throw Error("Kategorie s tímto názvem už existuje.");
  return name;
}
export function createCategory(
  state: ParcelCategoryState,
  name: string,
  id: string = globalThis.crypto.randomUUID(),
): ParcelCategoryState {
  if (state.categories.length >= 50)
    throw Error("Lze uložit nejvýše 50 kategorií.");
  if (
    !id ||
    state.categories.some((item) => item.id === id) ||
    [ALL_CATEGORIES, UNASSIGNED_CATEGORY].includes(id)
  )
    throw Error("Neplatný identifikátor kategorie.");
  return {
    ...state,
    categories: [...state.categories, { id, name: categoryName(state, name) }],
  };
}
export function renameCategory(
  state: ParcelCategoryState,
  id: string,
  name: string,
): ParcelCategoryState {
  if (!state.categories.some((item) => item.id === id))
    throw Error("Kategorie již neexistuje.");
  const next = categoryName(state, name, id);
  return {
    ...state,
    categories: state.categories.map((item) =>
      item.id === id ? { ...item, name: next } : item,
    ),
  };
}
export function deleteCategory(
  state: ParcelCategoryState,
  id: string,
): ParcelCategoryState {
  return {
    categories: state.categories.filter((item) => item.id !== id),
    assignments: Object.fromEntries(
      Object.entries(state.assignments).filter(
        ([, category]) => category !== id,
      ),
    ),
  };
}
export function assignCategory(
  state: ParcelCategoryState,
  ids: string[],
  categoryId: string | null,
): ParcelCategoryState {
  if (
    categoryId !== null &&
    !state.categories.some((item) => item.id === categoryId)
  )
    throw Error("Kategorie již neexistuje.");
  const assignments = { ...state.assignments };
  for (const id of ids) {
    if (categoryId) assignments[id] = categoryId;
    else delete assignments[id];
  }
  return { ...state, assignments };
}
export function categoryAreas(
  areas: AnalysisArea[],
  state: ParcelCategoryState,
  selected: string,
): AnalysisArea[] {
  return areas.filter(
    (area) =>
      selected === ALL_CATEGORIES ||
      (selected === UNASSIGNED_CATEGORY
        ? !state.assignments[area.id]
        : state.assignments[area.id] === selected),
  );
}

/** location.code is an internal cadastral ID, not the official parcel number. */
export function officialParcelNumber(area: AnalysisArea): string | null {
  if (!area.cadastral) return null;
  const explicit = area.cadastral.parcelNumber?.trim();
  if (explicit) return explicit;
  return (
    area.name.match(/^Parcela\s+((?:st\.\s*)?\d+(?:\s*\/\s*\d+)?)$/i)?.[1] ??
    null
  );
}
export function showOfficialParcelNumber(area: AnalysisArea): boolean {
  const number = officialParcelNumber(area);
  return (
    !!number &&
    area.name.trim().toLocaleLowerCase("cs-CZ") !==
      `parcela ${number}`.toLocaleLowerCase("cs-CZ")
  );
}

export interface CategoryScenarioTotal {
  scenario: EconomicsScenarioKey;
  totals: EconomicsResult;
}
export interface CategoryScenarioSummary {
  status: "ready" | "empty" | "overlap" | "error";
  message: string;
  parcelCount: number;
  areaHa: number;
  overlaps: { first: string; second: string; areaM2: number }[];
  scenarios: CategoryScenarioTotal[];
}
function asFeature(area: AnalysisArea): Feature<Polygon | MultiPolygon> {
  return { type: "Feature", properties: {}, geometry: area.geometry };
}
function intersectBounds(a: number[], b: number[]) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

/** Aggregate individual plans, never an average yield, score or payback year. */
export function aggregateCategoryScenarios(
  areas: AnalysisArea[],
  fruitByArea: Record<string, FruitKey>,
  defaultFruit: FruitKey,
  economicsByFruit: Record<FruitKey, EconomicsInputs>,
  irrigation: boolean,
): CategoryScenarioSummary {
  const unique = [...new Map(areas.map((area) => [area.id, area])).values()];
  const result: CategoryScenarioSummary = {
    status: "empty",
    message: "V této kategorii zatím nejsou žádné pozemky.",
    parcelCount: unique.length,
    areaHa: 0,
    overlaps: [],
    scenarios: [],
  };
  if (!unique.length) return result;
  try {
    const indexed = unique.map((area) => ({
      area,
      bounds: geometryBounds(area.geometry),
      size: turfArea(area.geometry),
    }));
    if (indexed.some((item) => !Number.isFinite(item.size) || item.size <= 0))
      throw Error("Některý pozemek nemá platnou kladnou výměru.");
    result.areaHa = indexed.reduce((sum, item) => sum + item.size / 10000, 0);
    for (let i = 0; i < indexed.length && result.overlaps.length < 5; i++)
      for (let j = i + 1; j < indexed.length; j++) {
        const a = indexed[i],
          b = indexed[j];
        if (!intersectBounds(a.bounds, b.bounds)) continue;
        const intersection = intersect({
          type: "FeatureCollection",
          features: [asFeature(a.area), asFeature(b.area)],
        });
        const overlap = intersection ? turfArea(intersection) : 0;
        if (overlap > Math.max(0.01, Math.min(a.size, b.size) * 1e-8)) {
          result.overlaps.push({
            first: a.area.name,
            second: b.area.name,
            areaM2: overlap,
          });
          if (result.overlaps.length >= 5) break;
        }
      }
    if (result.overlaps.length)
      return {
        ...result,
        status: "overlap",
        message:
          "Pozemky v kategorii se překrývají. Ponechte v ní původní parcelu, nebo její části, aby se výměra a ekonomika nezapočítaly dvakrát.",
      };
    for (const area of unique) {
      const inputs = economicsByFruit[fruitByArea[area.id] ?? defaultFruit];
      if (
        !inputs ||
        !Object.values(inputs).every(
          (value) => typeof value !== "number" || Number.isFinite(value),
        ) ||
        inputs.horizonYears < 1 ||
        inputs.horizonYears > 100 ||
        !Number.isInteger(inputs.horizonYears) ||
        inputs.rowSpacingM <= 0 ||
        inputs.treeSpacingM <= 0
      )
        throw Error(
          `Pozemek ${area.name} nemá platné vstupy ekonomického scénáře.`,
        );
    }
    result.scenarios = SCENARIOS.map((scenario) => {
      const results = unique.map((area) => {
        const fruit = fruitByArea[area.id] ?? defaultFruit,
          inputs = economicsByFruit[fruit];
        return computeEconomics(area, fruit, inputs, {
          scenario,
          irrigation,
          subsidy: inputs.subsidy,
        });
      });
      const sum = (get: (item: EconomicsResult) => number) =>
        results.reduce((total, item) => total + get(item), 0);
      const maxYear = Math.max(
        ...results.map((item) => item.flows.at(-1)!.year),
      );
      let cumulative = 0;
      const flows = Array.from({ length: maxYear + 1 }, (_, year) => {
        const annual = results.flatMap((item) =>
          item.flows.filter((flow) => flow.year === year),
        );
        const revenue = annual.reduce((total, item) => total + item.revenue, 0),
          costs = annual.reduce((total, item) => total + item.costs, 0),
          net = annual.reduce((total, item) => total + item.net, 0);
        cumulative += net;
        return {
          year,
          revenue,
          costs,
          net,
          cumulative,
          discounted: annual.reduce(
            (total, item) => total + item.discounted,
            0,
          ),
        };
      });
      const totals: EconomicsResult = {
        treeCount: sum((item) => item.treeCount),
        usableAreaHa: sum((item) => item.usableAreaHa),
        investment: {
          trees: sum((item) => item.investment.trees),
          fence: sum((item) => item.investment.fence),
          irrigation: sum((item) => item.investment.irrigation),
          land: sum((item) => item.investment.land),
          total: sum((item) => item.investment.total),
        },
        annualCostsMature: sum((item) => item.annualCostsMature),
        matureRevenue: sum((item) => item.matureRevenue),
        flows,
        npv: Math.round(
          flows.reduce((total, flow) => total + flow.discounted, 0),
        ),
        paybackYear:
          flows.find((flow) => flow.year > 0 && flow.cumulative >= 0)?.year ??
          null,
        subsidyTotal: sum((item) => item.subsidyTotal),
        irrigationUpliftPct: 0,
      };
      return { scenario, totals };
    });
    const horizons = new Set(
      unique.map(
        (area) =>
          economicsByFruit[fruitByArea[area.id] ?? defaultFruit].horizonYears,
      ),
    );
    const rates = new Set(
      unique.map(
        (area) =>
          economicsByFruit[fruitByArea[area.id] ?? defaultFruit]
            .discountRatePct,
      ),
    );
    const periodNote =
      horizons.size > 1
        ? "Pozemky mají různé délky scénáře. Součet za každý rok obsahuje jen plány, které do tohoto roku dosahují; za jejich horizont nic nedoplňujeme."
        : "Součet samostatných plánů jednotlivých pozemků.";
    return {
      ...result,
      status: "ready",
      message:
        periodNote +
        " Náklady oplocení se počítají pro každý pozemek zvlášť." +
        (rates.size > 1
          ? " NPV sčítá dílčí plány s jejich vlastními diskontními sazbami."
          : ""),
    };
  } catch (error) {
    return {
      ...result,
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Souhrn se nepodařilo spočítat.",
    };
  }
}
