import { FRUITS } from "../data/fruitProfiles";
import type {
  AnalysisArea,
  CategoryKey,
  CategoryScore,
  FruitKey,
  SuitabilityResult,
} from "./types";
import type { RegionalData } from "./regionalData";
import { mean } from "./openData";
import {
  MANUAL_FIELDS,
  matchingRegionalData,
  normalizeManualInputs,
  regionalClimateValue,
  type ManualClimateKey,
} from "./manualInputs";

// HPJ ranges follow VÚMOP's soil groups. Numeric suitability is an explicit
// screening heuristic, not an official BPEJ rating or measured chemistry.
export const SOIL_GROUPS = [
  [1, 8, 90, "černozemě"],
  [9, 13, 85, "hnědozemě"],
  [14, 17, 80, "luvizemě"],
  [18, 20, 65, "rendziny a pararendziny"],
  [21, 23, 50, "regozemě"],
  [24, 33, 70, "kambizemě"],
  [34, 36, 45, "půdy chladných oblastí"],
  [37, 39, 20, "mělké půdy"],
  [40, 41, 30, "silně svažité půdy"],
  [42, 54, 40, "pseudogleje"],
  [55, 59, 65, "fluvizemě"],
  [60, 63, 60, "černice"],
  [64, 78, 20, "gleje"],
  [79, 81, 60, "koluvizemě"],
  [82, 89, 35, "antropozemě"],
] as const;
const weights: Record<CategoryKey, number> = {
  soil: 35,
  climate: 40,
  water: 25,
  terrain: 0,
  access: 0,
};
const labels: Record<CategoryKey, string> = {
  soil: "Půda",
  climate: "Klima",
  water: "Vláha",
  terrain: "Terén",
  access: "Provoz",
};
const climateKeys: ManualClimateKey[] = [
  "temperatureMeanC",
  "rainfallMm",
  "et0Mm",
  "springFrostDays",
  "summerDays",
];
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const fmt = (n: number) =>
  n.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });
export const validClimateYears = (data: RegionalData | null | undefined) =>
  data?.climate?.years.filter((y) =>
    [
      y.temperatureMeanC,
      y.rainfallMm,
      y.et0Mm,
      y.springFrostDays,
      y.summerDays,
    ].every((v) => v !== null && Number.isFinite(v)),
  ) ?? [];

export function scoreRegionalArea(
  area: AnalysisArea,
  fruit: FruitKey,
): SuitabilityResult {
  const regional = area.regional,
    data = matchingRegionalData(area),
    req = FRUITS[fruit].requirements,
    years = validClimateYears(data);
  const manual = normalizeManualInputs(area.manualInputs);
  const deferredClimate =
    data?.deferred && !data.climate && !data.errors.length
      ? data.deferred
      : undefined;
  const manualFields = MANUAL_FIELDS.filter(
    ({ key }) => manual?.[key] !== undefined,
  ).map(({ key }) => key);
  const manualCategories = new Set<CategoryKey>();
  const raw: Partial<Record<CategoryKey, { score: number; summary: string }>> =
    {};
  const soil = data?.soil;
  if (soil?.valid && soil.coveragePct >= 80) {
    const parts = soil.parts.map((p) => ({
      p,
      group: SOIL_GROUPS.find(
        (g) =>
          Number(p.name.slice(1, 3)) >= g[0] &&
          Number(p.name.slice(1, 3)) <= g[1],
      ),
    }));
    const rated = parts.filter((p) => p.group),
      coverage = rated.reduce((s, x) => s + x.p.percent, 0);
    if (coverage >= 80)
      raw.soil = {
        score: clamp(
          rated.reduce((s, x) => s + x.p.percent * x.group![2], 0) / coverage,
        ),
        summary: `BPEJ pokrývá ${fmt(soil.coveragePct)} % plochy. ${rated.map((x) => `${x.p.name} (${x.group![3]}): ${fmt(x.p.percent)} %`).join("; ")}. Index dle skupiny HPJ; pH, humus a skutečná hloubka neznámé.`,
      };
  }
  if (manual?.soilHpj !== undefined) {
    const group = SOIL_GROUPS.find(
      (g) => manual.soilHpj! >= g[0] && manual.soilHpj! <= g[1],
    );
    if (group) {
      raw.soil = {
        score: group[2],
        summary: `Uživatelský scénář: reprezentativní HPJ ${String(manual.soilHpj).padStart(2, "0")} (${group[3]}) přiřazená celé plánované ploše. Pokrytí ani homogenita půdy nejsou ověřené; u smíšených půd plochu rozdělte. pH, humus a skutečná hloubka zůstávají neznámé.`,
      };
      manualCategories.add("soil");
    } else delete raw.soil;
  }
  // With no overrides, retain the existing joint complete-year rule and exactly
  // the original formula. A manual scenario may combine individually documented
  // regional indicators with explicit user means, never fabricated annual rows.
  const values: Partial<
    Record<
      ManualClimateKey,
      { value: number; source: "manual" | "open-data"; years: number }
    >
  > = {};
  for (const key of climateKeys) {
    if (manual?.[key] !== undefined)
      values[key] = { value: manual[key]!, source: "manual", years: 0 };
    else if (manual) {
      const observed = regionalClimateValue(data, key);
      if (observed) values[key] = { ...observed, source: "open-data" };
    } else if (years.length >= 15)
      values[key] = {
        value: mean(years.map((y) => y[key]))!,
        source: "open-data",
        years: years.length,
      };
  }
  const description = (key: ManualClimateKey) =>
    values[key]?.source === "manual"
      ? "ručně zadáno"
      : `${values[key]?.years ?? 0} skutečných let`;
  const t = values.temperatureMeanC?.value,
    rain = values.rainfallMm?.value,
    et = values.et0Mm?.value,
    frost = values.springFrostDays?.value,
    hot = values.summerDays?.value;
  if (t !== undefined && frost !== undefined && hot !== undefined) {
    const deviation = Math.max(req.tempOptMinC - t, t - req.tempOptMaxC, 0);
    const edited = ["temperatureMeanC", "springFrostDays", "summerDays"].some(
      (key) => manualFields.includes(key as ManualClimateKey),
    );
    if (edited) manualCategories.add("climate");
    raw.climate = {
      score: clamp(
        95 -
          deviation * 12 -
          Math.min(45, Math.max(0, frost - 10) * req.frostSensitivity * 0.7) -
          Math.max(0, req.heatNeed * 5 - hot) * 0.8,
      ),
      summary:
        !edited && years.length >= 15
          ? `${years.length} úplných let (${data!.climate!.period}), Ø ${fmt(t)} °C, ${fmt(frost)} mrazových dnů březen–květen, ${fmt(hot)} letních dnů. Regionální reanalýza; mrazy nejsou odhad škody v květu.`
          : `${edited ? "Uživatelský klimatický scénář" : "Regionální průměry po veličinách"}: Ø ${fmt(t)} °C (${description("temperatureMeanC")}), ${fmt(frost)} mrazových dnů březen–květen (${description("springFrostDays")}), ${fmt(hot)} letních dnů (${description("summerDays")}). Průměry nepopisují meziroční extrémy ani škody v květu.`,
    };
  }
  if (rain !== undefined && et !== undefined) {
    const deficit = Math.max(0, req.rainfallOptMm - rain),
      balance = Math.max(0, et - rain);
    const edited =
      manualFields.includes("rainfallMm") || manualFields.includes("et0Mm");
    if (edited) manualCategories.add("water");
    raw.water = {
      score: clamp(
        100 -
          deficit * 0.22 -
          (balance / Math.max(et, 1)) *
            55 *
            (1 + (3 - req.droughtTolerance) * 0.15),
      ),
      summary:
        !edited && years.length >= 15
          ? `Ø srážky ${fmt(rain)} mm/rok, ET0 ${fmt(et)} mm/rok; P−ET0 = ${fmt(rain - et)} mm. Jde o klimatickou bilanci, nikoli měřenou půdní vláhu ani potřebu závlahy.`
          : `${edited ? "Uživatelský scénář vláhy" : "Regionální průměry po veličinách"}: srážky ${fmt(rain)} mm/rok (${description("rainfallMm")}), ET0 ${fmt(et)} mm/rok (${description("et0Mm")}); P−ET0 = ${fmt(rain - et)} mm. Jde o klimatickou bilanci, nikoli měřenou půdní vláhu ani potřebu závlahy.`,
    };
  }
  const unverifiedSummary = data
    ? null
    : regional?.status === "loading"
      ? "Probíhá načítání podkladů pro tento pozemek."
      : !regional || regional.status === "idle"
        ? "Podklady dosud nebyly ověřeny."
        : "Podklady se nepodařilo načíst nebo ověřit.";
  const missingClimate = (keys: ManualClimateKey[]) =>
    keys
      .filter((key) => !values[key])
      .map((key) =>
        MANUAL_FIELDS.find(
          (field) => field.key === key,
        )!.label.toLocaleLowerCase("cs-CZ"),
      )
      .join(", ");
  const categories: CategoryScore[] = (Object.keys(weights) as CategoryKey[])
    .filter((key) => weights[key] > 0)
    .map((key) => ({
      key,
      label: labels[key],
      weight: weights[key],
      score: raw[key]?.score ?? null,
      status: raw[key] ? "partial" : "missing",
      availability: raw[key] ? "partial" : "missing",
      summary:
        raw[key]?.summary ??
        (deferredClimate && (key === "climate" || key === "water")
          ? deferredClimate.message
          : manual
            ? key === "soil"
              ? "Chybí nejméně 80 % hodnotitelné BPEJ nebo ručně zadaná reprezentativní HPJ."
              : `Pro scénář chybí: ${missingClimate(key === "climate" ? ["temperatureMeanC", "springFrostDays", "summerDays"] : ["rainfallMm", "et0Mm"])}. Každý vstup potřebuje vlastní uživatelskou hodnotu nebo nejméně 15 skutečných ročních pozorování.`
            : (unverifiedSummary ??
              (key === "soil"
                ? `BPEJ: ${soil ? fmt(soil.coveragePct) + " % pokrytí" : "nedostupná"}. Pro půdní index je nutné alespoň 80 % platného pokrytí.`
                : `Klima má ${years.length} úplných let; potřebujeme alespoň 15 z období 2005–2024.`))),
    }));
  const available = categories.filter((c) => c.score !== null),
    availableWeight = available.reduce((s, c) => s + c.weight, 0);
  const completeness = Math.round(
    available.reduce(
      (sum, c) => sum + c.weight * (manualCategories.has(c.key) ? 0.4 : 0.6),
      0,
    ),
  );
  const enough =
    !!raw.soil && !!raw.climate && !!raw.water && availableWeight >= 70;
  const overall = enough
    ? Math.round(
        available.reduce((s, c) => s + c.score! * c.weight, 0) /
          availableWeight,
      )
    : null;
  const hasOpenInput =
    (!!raw.soil && !manualCategories.has("soil")) ||
    Object.values(values).some((value) => value?.source === "open-data");
  const inputOrigin: SuitabilityResult["inputOrigin"] = manual
    ? hasOpenInput
      ? "mixed"
      : "manual"
    : "open-data";
  const dataStatus: SuitabilityResult["dataStatus"] = enough
    ? "ready"
    : regional?.status === "loading"
      ? "loading"
      : !regional || regional.status === "idle"
        ? "idle"
        : regional.status === "error" ||
            !data ||
            ((!data.soil || !data.climate) && data.errors.length > 0)
          ? "error"
          : deferredClimate
            ? "deferred"
            : "insufficient";
  const dataMessage =
    dataStatus === "deferred"
      ? deferredClimate!.message
      : manual
        ? enough
          ? `${inputOrigin === "mixed" ? "Smíšený" : "Ruční"} uživatelský scénář má všechny vstupy pro výpočet. Ruční údaje nejsou otevřená data ani ověřená klimatická historie.`
          : dataStatus === "loading"
            ? "Doplňuji otevřená data ke zadaným ručním hodnotám. Scénář zatím nemá všechny vstupy."
            : dataStatus === "error"
              ? "Zbývající otevřené podklady se nepodařilo ověřit. Doplňte chybějící vstupy ručně, nebo načtení zopakujte."
              : "Uživatelskému scénáři zatím chybí některé vstupy; podrobnosti jsou v kategoriích hodnocení."
        : dataStatus === "ready"
          ? "Dostatek podkladů pro výpočet. BPEJ a klimatická řada odpovídají poloze pozemku."
          : dataStatus === "loading"
            ? "Načítám půdní a klimatické podklady pro tento pozemek. Výsledek se zobrazí automaticky."
            : dataStatus === "idle"
              ? "Podklady pro tento pozemek zatím nebyly ověřeny."
              : dataStatus === "error"
                ? "Podklady se nepodařilo načíst nebo ověřit. Zkuste načtení zopakovat v záložce Data."
                : "Pro souhrnné skóre chybí alespoň 80 % platného pokrytí BPEJ nebo 15 úplných klimatických let.";
  const constraints: SuitabilityResult["constraints"] = [];
  const restrictive = [
    "lesní pozemek",
    "vodní plocha",
    "zastavěná plocha a nádvoří",
  ].includes(area.landUse);
  if (restrictive)
    constraints.push({
      label: "Druh pozemku",
      detail: `${area.landUse}: nejde o běžnou zemědělskou plochu pro založení sadu. Vyžaduje samostatné prověření.`,
    });
  let verdict: SuitabilityResult["verdict"] =
    overall === null
      ? (
          {
            idle: "Dosud neověřeno",
            loading: "Načítám podklady",
            deferred: "Čeká na klimatická data",
            error: "Chyba načítání",
            insufficient: "Nedostatek dat",
            ready: "Nedostatek dat",
          } as const
        )[dataStatus]
      : overall >= 75
        ? "Vhodný"
        : overall >= 55
          ? "Vhodný s opatřeními"
          : "Rizikový";
  if (overall !== null && available.some((c) => c.score! < 30))
    verdict = "Rizikový";
  if (overall !== null && restrictive) verdict = "Rizikový";
  const frostCaution =
    manual?.springFrostDays !== undefined
      ? manual.springFrostDays >= 18
      : years.some((y) => y.springFrostDays! >= 18);
  if (
    verdict === "Vhodný" &&
    (constraints.length || (req.frostSensitivity >= 4 && frostCaution))
  )
    verdict = "Vhodný s opatřeními";
  const reasons = available
    .slice()
    .sort((a, b) => a.score! - b.score!)
    .map((c) => `${c.label}: ${c.summary}`)
    .slice(0, 3);
  if (!enough) reasons.unshift(dataMessage);
  while (reasons.length < 3)
    reasons.push(
      data?.errors[reasons.length - 1] ??
        "Chybějící údaje nenahrazujeme profilem jiné lokality.",
    );
  const risks: SuitabilityResult["risks"] = available
    .filter((c) => c.score! < 60)
    .map((c) => ({
      label: c.label,
      detail: c.summary,
      severity: c.score! < 30 ? "high" : "medium",
    }));
  if (manual)
    risks.push({
      label: "Neověřené ruční vstupy",
      detail:
        "Uživatelské hodnoty mění plánovací scénář. Jejich správnost ani reprezentativnost pro celou plochu nejsou ověřené; ruční průměry nejsou časovou řadou a nepopisují meziroční extrémy.",
      severity: "medium",
    });
  risks.push({
    label: "Neověřené vlastnosti parcely",
    detail:
      "Chybí půdní rozbor (pH, humus, skutečná hloubka), mikroklima, zdroj závlahy, Q100 a právně zajištěný příjezd.",
    severity: "medium",
  });
  for (const c of constraints)
    risks.push({ label: c.label, detail: c.detail, severity: "high" });
  for (const error of data?.errors ?? [])
    risks.push({
      label: "Nedostupný podklad",
      detail: error,
      severity: "medium",
    });
  return {
    fruit,
    overall,
    inputOrigin,
    manualFields,
    dataStatus,
    dataMessage,
    verdict,
    verdictClass:
      overall === null
        ? "nodata"
        : verdict === "Vhodný"
          ? "good"
          : verdict === "Rizikový"
            ? "risk"
            : "caution",
    categories,
    completeness,
    missing: categories.filter((c) => c.score === null).map((c) => c.label),
    reasons: reasons.slice(0, 3),
    risks,
    constraints,
    nextSteps: [
      "Potvrdit půdní vlastnosti rozborem a ověřit hloubku profilu.",
      "Prověřit mikroklima a mrazové kotliny přímo na pozemku.",
      "Ověřit přístup, vodu, záplavy a právní podmínky založení sadu.",
    ],
    assumptions: [
      "Index kombinuje skutečná prostorová data s orientačními pravidly a pěstitelskými profily Moje Sady; nejde o validovanou pravděpodobnost úspěchu ani předpověď výnosu.",
      "Váhy regionálního indexu: půda 35 / klima 40 / vláha 25. Terén a provoz nejsou součástí indexu; chybějící povinný podklad zablokuje celkové skóre.",
      "Půda dle HPJ je pouze orientační screening; klimatické údaje patří gridu širší oblasti, nikoli mikroklimatu parcely.",
      manual
        ? "Ruční hodnoty mají přednost jen u výslovně zadaných polí. Ostatní vstupy zůstávají regionální nebo chybějící. Ručně ovlivněné kategorie mají konzervativní faktor kvality 40 %, ostatní 60 %."
        : "Úplnost snižujeme na 60 % dostupných vah kvůli regionálním a částečným podkladům. Závlaha v tomto indexu nemění klima ani automaticky nedoplňuje vodu.",
      ...(manual?.note
        ? [`Uživatelská poznámka ke vstupům: ${manual.note}`]
        : []),
    ],
  };
}
