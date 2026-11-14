import type { AnalysisArea, ManualInputs } from "./types";
import { geometryKey, type RegionalData } from "./regionalData";

export type { ManualInputs } from "./types";
export type ManualFieldKey = Exclude<keyof ManualInputs, "note">;
export type ManualClimateKey = Exclude<ManualFieldKey, "soilHpj">;
export const MANUAL_FIELDS: {
  key: ManualFieldKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  integer?: boolean;
}[] = [
  {
    key: "soilHpj",
    label: "Reprezentativní HPJ půdy",
    unit: "kód 1–89",
    min: 1,
    max: 89,
    integer: true,
  },
  {
    key: "temperatureMeanC",
    label: "Průměrná roční teplota",
    unit: "°C",
    min: -15,
    max: 30,
  },
  {
    key: "rainfallMm",
    label: "Průměrné roční srážky",
    unit: "mm/rok",
    min: 0,
    max: 5000,
  },
  {
    key: "et0Mm",
    label: "Průměrná roční referenční evapotranspirace ET0",
    unit: "mm/rok",
    min: 0,
    max: 5000,
  },
  {
    key: "springFrostDays",
    label: "Průměr mrazových dnů březen–květen",
    unit: "dnů/rok",
    min: 0,
    max: 92,
  },
  {
    key: "summerDays",
    label: "Průměr letních dnů (Tmax ≥ 25 °C)",
    unit: "dnů/rok",
    min: 0,
    max: 366,
  },
];

export function isValidManualValue(
  key: ManualFieldKey,
  value: unknown,
): value is number {
  const field = MANUAL_FIELDS.find((item) => item.key === key)!;
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= field.min &&
    value <= field.max &&
    (!field.integer || Number.isInteger(value))
  );
}

/** Only finite, valid numeric values survive persistence. Empty strings never become zero. */
export function normalizeManualInputs(raw: unknown): ManualInputs | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const input = raw as Record<string, unknown>,
    value: ManualInputs = {};
  for (const { key } of MANUAL_FIELDS)
    if (isValidManualValue(key, input[key])) value[key] = input[key] as number;
  if (!Object.keys(value).length) return undefined;
  if (typeof input.note === "string" && input.note.trim())
    value.note = input.note.trim().slice(0, 240);
  return value;
}
export const hasManualInputs = (value: unknown): boolean =>
  normalizeManualInputs(value) !== undefined;

export type ManualFieldSource = "manual" | "open-data" | "needed" | "pending";
/** UI origin of an individual input; never treat a request in progress as a
 * confirmed gap. This does not alter the scoring/coverage thresholds. */
export function manualFieldSources(
  area: AnalysisArea,
): Record<ManualFieldKey, ManualFieldSource> {
  const manual = normalizeManualInputs(area.manualInputs),
    data = matchingRegionalData(area);
  const soil = data?.soil;
  const ratedCoverage =
    soil?.parts.reduce((sum, part) => {
      const hpj = Number(part.name.slice(1, 3));
      return (
        sum +
        (/^\d{5}$/.test(part.name) && hpj >= 1 && hpj <= 89 ? part.percent : 0)
      );
    }, 0) ?? 0;
  const pending =
    !area.regional ||
    area.regional.status === "idle" ||
    area.regional.status === "loading";
  return Object.fromEntries(
    MANUAL_FIELDS.map(({ key }) => [
      key,
      manual?.[key] !== undefined
        ? "manual"
        : (
              key === "soilHpj"
                ? soil?.valid && soil.coveragePct >= 80 && ratedCoverage >= 80
                : regionalClimateValue(data, key) !== null
            )
          ? "open-data"
          : pending
            ? "pending"
            : "needed",
    ]),
  ) as Record<ManualFieldKey, ManualFieldSource>;
}

export const MANUAL_FIELD_HELP: Record<ManualFieldKey, string> = {
  soilHpj:
    "HPJ je 2. a 3. číslice BPEJ: např. 00610 → 06. Jednotka má odpovídat celé plánované části.",
  temperatureMeanC: "Dlouhodobý průměr roční teploty; nejde o dnešní teplotu.",
  rainfallMm: "Dlouhodobý roční úhrn srážek v mm, nikoli měsíční úhrn.",
  et0Mm:
    "Dlouhodobá roční referenční evapotranspirace. Neznámý údaj nenahrazujte nulou.",
  springFrostDays:
    "Průměrný počet dnů s minimem pod 0 °C v období březen–květen.",
  summerDays: "Průměrný počet dnů za rok s maximem alespoň 25 °C.",
};

export function parseManualValue(
  key: ManualFieldKey,
  text: string,
): { value?: number; error?: string } {
  const input = text.trim();
  if (!input) return {};
  const field = MANUAL_FIELDS.find((item) => item.key === key)!;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(input))
    return { error: "Zadejte číslo, nebo pole ponechte prázdné." };
  const value = Number(input.replace(",", "."));
  if (!isValidManualValue(key, value))
    return {
      error: `${field.integer ? "Použijte celé číslo" : "Použijte hodnotu"} od ${field.min} do ${field.max}.`,
    };
  return { value };
}

export function matchingRegionalData(area: AnalysisArea): RegionalData | null {
  return area.regional?.status === "ready" &&
    area.regional.data?.key === geometryKey(area.geometry)
    ? area.regional.data
    : null;
}

/** A regional fallback still needs fifteen real annual observations of that
 * indicator. User means are separate inputs and never turned into a fake series. */
export function regionalClimateValue(
  data: RegionalData | null,
  key: ManualClimateKey,
): { value: number; years: number } | null {
  const years = new Map<number, number>();
  for (const row of data?.climate?.years ?? []) {
    if (
      Number.isInteger(row.year) &&
      row.year >= 2005 &&
      row.year <= 2024 &&
      isValidManualValue(key, row[key])
    )
      years.set(row.year, row[key]!);
  }
  if (years.size < 15) return null;
  return {
    value:
      [...years.values()].reduce((sum, value) => sum + value, 0) / years.size,
    years: years.size,
  };
}
