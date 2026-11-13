import { FRUITS } from '../data/fruitProfiles';
import { fmtNum } from './format';
import type {
  AnalysisArea,
  Availability,
  CategoryKey,
  CategoryScore,
  FruitKey,
  RiskItem,
  SuitabilityResult,
} from './types';

/**
 * TRANSPARENTNÍ DEMO SKÓROVACÍ MODEL
 *
 * - Váhy (půda 30 %, klima 30 %, vláha 20 %, terén 10 %, provoz 10 %) jsou
 *   NÁVRH PRO DEMO, nikoli odborně validovaná metodika.
 * - Skóre 0–100 vyjadřuje míru souladu podmínek s nároky druhu. NENÍ to
 *   pravděpodobnost úspěchu ani očekávaný výnos.
 * - Chybějící kategorii nahrazujeme normalizací vah, ne nulou. Pokud chybí
 *   zásadní podklady (půda nebo klima) nebo je dostupných méně než 70 % vah,
 *   vracíme „Nedostatek dat“ místo čísla.
 */

export const MODEL_WEIGHTS: Record<CategoryKey, number> = {
  soil: 30,
  climate: 30,
  water: 20,
  terrain: 10,
  access: 10,
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  soil: 'Půda',
  climate: 'Klima',
  water: 'Vláha',
  terrain: 'Terén',
  access: 'Provoz',
};

export const MODEL_NOTE =
  'Váhy 30 / 30 / 20 / 10 / 10 jsou transparentní návrh pro demo. Ekonomika, kvalita podkladů a územní kolize se vyhodnocují samostatně.';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

interface CategoryResult {
  score: number;
  summary: string;
}

const ASPECT_BONUS: Record<string, number> = {
  J: 5,
  JZ: 3,
  JV: 2,
  rovina: 2,
  Z: 0,
  V: -2,
  SZ: -5,
  S: -8,
};

function scoreSoil(area: AnalysisArea, fruit: FruitKey): CategoryResult | null {
  const soil = area.attributes.soil;
  if (!soil) return null;
  const profile = FRUITS[fruit];
  const req = profile.requirements;
  let score = 92;

  const phDev =
    soil.ph < req.phOptMin ? req.phOptMin - soil.ph : soil.ph > req.phOptMax ? soil.ph - req.phOptMax : 0;
  score -= Math.min(42, phDev * 12);

  const depthShort = Math.max(0, req.depthMinCm - soil.depthCm);
  score -= Math.min(35, depthShort * 0.9);

  if (soil.texture.includes('písčitá') && !soil.texture.includes('hlinito')) score -= 14;
  else if (soil.texture.includes('hlinitopísčitá')) score -= 5;
  else if (soil.texture.includes('jílovitá')) score -= 8;

  if (soil.humusPct < 1.8) score -= 8;
  else if (soil.humusPct < 2.2) score -= 3;
  else if (soil.humusPct >= 2.8) score += 4;

  score = clamp(Math.round(score), 10, 100);

  const phText =
    phDev > 0
      ? `pH ${fmtNum(soil.ph, 1)} je ${soil.ph < req.phOptMin ? 'nízké' : 'vysoké'} (vhodné ${fmtNum(req.phOptMin, 1)}–${fmtNum(req.phOptMax, 1)})`
      : `pH ${fmtNum(soil.ph, 1)} je v pásmu vhodném pro ${profile.name.toLowerCase()}`;
  const depthText =
    soil.depthCm < req.depthMinCm
      ? `hloubka ${soil.depthCm} cm je pod potřebnými ${req.depthMinCm} cm`
      : `hloubka ${soil.depthCm} cm dostačuje`;
  const humusText =
    soil.humusPct < 1.8 ? `nízký humus ${fmtNum(soil.humusPct, 1)} %` : `humus ${fmtNum(soil.humusPct, 1)} %`;

  return {
    score,
    summary: `${soil.soilType}, BPEJ ${soil.bpej}: ${phText}, ${depthText}, ${humusText} (${soil.texture}).`,
  };
}

function scoreClimate(area: AnalysisArea, fruit: FruitKey): CategoryResult | null {
  const climate = area.attributes.climate;
  if (!climate) return null;
  const profile = FRUITS[fruit];
  const req = profile.requirements;
  let score = 90;

  const tempDev =
    climate.tempAvgC < req.tempOptMinC
      ? req.tempOptMinC - climate.tempAvgC
      : climate.tempAvgC > req.tempOptMaxC
        ? climate.tempAvgC - req.tempOptMaxC
        : 0;
  score -= Math.min(32, tempDev * 12);

  const frostPenalty = Math.min(42, profile.requirements.frostSensitivity * Math.max(0, climate.frostDays - 15) * 1.4);
  score -= frostPenalty;

  const heatShort = Math.max(0, req.heatNeed * 5 - climate.heatDays);
  score -= Math.min(16, heatShort * 0.8);

  score = clamp(Math.round(score), 10, 100);

  const frostText =
    frostPenalty >= 28
      ? `jarní mrazy (${climate.frostDays} dnů, riziko ${climate.frostRisk}) jsou pro ${profile.name.toLowerCase()} limitující`
      : `mrazové riziko ${climate.frostRisk} (${climate.frostDays} mrazových dnů)`;
  const tempText = `průměrná teplota ${fmtNum(climate.tempAvgC, 1)} °C, ${climate.heatDays} letních dnů`;

  return { score, summary: `${tempText}; ${frostText}.` };
}

function scoreWater(area: AnalysisArea, fruit: FruitKey, irrigation: boolean): CategoryResult | null {
  const water = area.attributes.water;
  const climate = area.attributes.climate;
  if (!water || !climate) return null;
  const profile = FRUITS[fruit];
  const req = profile.requirements;

  const irrigationMm = irrigation ? water.irrigationNeedMm * 0.8 : 0;
  const effectiveRain = climate.rainfallMm + irrigationMm;
  const effectiveDrought = irrigation ? water.droughtRisk * 0.45 : water.droughtRisk;
  const deficit = Math.max(0, req.rainfallOptMm - effectiveRain);
  const toleranceFactor = 1 - (profile.requirements.droughtTolerance - 3) * 0.12;

  const penalty = (deficit * 0.35 + effectiveDrought * 0.3) * toleranceFactor;
  const score = clamp(Math.round(100 - penalty), 5, 100);

  const rainText = irrigation
    ? `srážky ${climate.rainfallMm} mm + modelová závlaha ${Math.round(irrigationMm)} mm`
    : `srážky ${climate.rainfallMm} mm bez doplňkové závlahy`;
  const deficitText =
    deficit > 0
      ? `chybí cca ${Math.round(deficit)} mm proti nároku ${req.rainfallOptMm} mm`
      : `srážky pokrývají orientační nárok ${req.rainfallOptMm} mm`;
  return {
    score,
    summary: `${rainText}; ${deficitText}, index rizika sucha ${Math.round(effectiveDrought)}/100.`,
  };
}

function scoreTerrain(area: AnalysisArea, fruit: FruitKey): CategoryResult | null {
  const terrain = area.attributes.terrain;
  if (!terrain) return null;
  const profile = FRUITS[fruit];
  const req = profile.requirements;
  let score = 94;

  score -= Math.min(45, Math.max(0, terrain.slopeDeg - 4) * 3);
  score -= terrain.erosionRisk === 'vysoké' ? 14 : terrain.erosionRisk === 'střední' ? 6 : 0;
  score += ASPECT_BONUS[terrain.aspect] ?? 0;
  score -= Math.min(24, Math.max(0, terrain.altitudeM - req.altitudeMaxM) * 0.12);

  score = clamp(Math.round(score), 10, 100);

  const slopeText =
    terrain.slopeDeg > req.slopeMaxDeg
      ? `sklon ${fmtNum(terrain.slopeDeg, 1)}° přesahuje limit ${req.slopeMaxDeg}°`
      : `sklon ${fmtNum(terrain.slopeDeg, 1)}° je zvládnutelný`;
  return {
    score,
    summary: `${slopeText}, orientace ${terrain.aspect}, ${terrain.altitudeM} m n. m., erozní riziko ${terrain.erosionRisk}.`,
  };
}

function scoreAccess(area: AnalysisArea): CategoryResult | null {
  const access = area.attributes.access;
  if (!access) return null;
  let score = 96;
  score -= Math.max(0, access.roadDistanceM - 150) * 0.04;
  score -= (100 - access.shapeQuality) * 0.25;
  score = clamp(Math.round(score), 15, 100);
  return {
    score,
    summary: `Příjezd ${access.roadDistanceM} m, tvar a sjízdnost plochy ${access.shapeQuality}/100.`,
  };
}

const availabilityFactor = (availability: Availability): number =>
  availability === 'complete' ? 1 : availability === 'partial' ? 0.6 : 0;

export function scoreArea(
  area: AnalysisArea,
  fruit: FruitKey,
  options: { irrigation: boolean },
): SuitabilityResult {
  const profile = FRUITS[fruit];
  const results: Record<CategoryKey, CategoryResult | null> = {
    soil: scoreSoil(area, fruit),
    climate: scoreClimate(area, fruit),
    water: scoreWater(area, fruit, options.irrigation),
    terrain: scoreTerrain(area, fruit),
    access: scoreAccess(area),
  };

  const categories: CategoryScore[] = (Object.keys(MODEL_WEIGHTS) as CategoryKey[]).map((key) => {
    const result = results[key];
    const availability = area.availability[key];
    return {
      key,
      label: CATEGORY_LABELS[key],
      weight: MODEL_WEIGHTS[key],
      score: result ? result.score : null,
      availability,
      status: !result ? 'missing' : availability === 'partial' ? 'partial' : 'computed',
      summary: result ? result.summary : 'Podklad pro tuto kategorii není k dispozici.',
    };
  });

  const completeness = Math.round(
    categories.reduce((sum, category) => sum + category.weight * availabilityFactor(category.availability), 0),
  );

  const availableWeight = categories
    .filter((category) => category.score !== null)
    .reduce((sum, category) => sum + category.weight, 0);

  const missing = categories.filter((category) => category.score === null).map((category) => category.label);
  const essentialMissing = results.soil === null || results.climate === null;

  const constraints: { label: string; detail: string }[] = [];
  const constraintData = area.attributes.constraints;
  if (constraintData?.floodZone) {
    constraints.push({
      label: 'Záplavové území',
      detail: `${constraintData.floodZone}. Ověřte rozsah u vodoprávního úřadu – vstup do porostu i stavby mohou být omezené.`,
    });
  }
  if (constraintData?.protectedArea) {
    constraints.push({
      label: 'Ochrana přírody',
      detail: `${constraintData.protectedArea}. Záměr je nutné projednat s orgánem ochrany přírody; omezení může být zásadní.`,
    });
  }

  const assumptions: string[] = [];
  if (area.kind === 'sample') {
    assumptions.push('Atributy ukázkové plochy jsou modelové hodnoty pro demonstraci, nikoli měření parcely.');
  }
  if (area.availability.soil === 'partial' || area.availability.climate === 'partial') {
    assumptions.push('Část podkladů je dostupná jen částečně – skóre je orientační.');
  }
  if (options.irrigation) {
    assumptions.push('Zapnutá závlaha je modelový předpoklad opatření, ne potvrzená dostupnost vody ani povolení.');
  }
  assumptions.push('Váhy modelu jsou návrh pro demo, ne odborně validovaná metodika.');

  if (essentialMissing || availableWeight < 70) {
    const reasons: string[] = [];
    if (!results.soil) {
      reasons.push('Chybí půdní podklady (BPEJ, hloubka, pH) – bez nich nelze půdní vhodnost vyhodnotit.');
    }
    if (!results.climate) {
      reasons.push('Chybí klimatické řady (teploty, srážky, mrazové dny) pro dané území.');
    }
    if (!results.water) {
      reasons.push('Chybí podklad o dostupnosti vláhy a riziku sucha.');
    }
    while (reasons.length < 3) {
      reasons.push('Dostupná data pokrývají méně než 70 % vah modelu, proto skóre záměrně neuvádíme.');
    }

    const nextSteps = [
      'Doplnit půdní rozbor nebo BPEJ pro konkrétní plochu.',
      'Získat klimatické charakteristiky nejbližší stanice ČHMÚ.',
      'Ověřit využití plochy v LPIS a územní omezení (AOPK, vodoprávní úřad).',
    ];
    if (constraintData?.protectedArea) {
      nextSteps.push('Projednat záměr s orgánem ochrany přírody.');
    }

    return {
      fruit,
      overall: null,
      verdict: 'Nedostatek dat',
      verdictClass: 'nodata',
      reasons,
      risks: [
        {
          label: 'Chybějící podklady',
          detail: `Chybí ${missing.join(', ').toLowerCase()}. Výsledek by mohl být zavádějící, proto se nepočítá.`,
          severity: 'high',
        },
        ...(constraintData?.protectedArea
          ? [
              {
                label: 'Ochrana přírody',
                detail: `${constraintData.protectedArea} – podmínky využití je nutné ověřit před plánováním.`,
                severity: 'high' as const,
              },
            ]
          : []),
      ],
      nextSteps,
      categories,
      completeness,
      missing,
      assumptions,
      constraints,
    };
  }

  const overall = Math.round(
    categories.reduce((sum, category) => sum + (category.score ?? 0) * category.weight, 0) / availableWeight,
  );

  let verdict: SuitabilityResult['verdict'] =
    overall >= 75 ? 'Vhodný' : overall >= 55 ? 'Vhodný s opatřeními' : 'Rizikový';

  const worst = categories
    .filter((category): category is CategoryScore & { score: number } => category.score !== null)
    .sort((a, b) => a.score - b.score)[0];

  const criticalCategory = worst && worst.score < 30;
  if (criticalCategory) verdict = 'Rizikový';

  const frostCap =
    profile.requirements.frostSensitivity >= 4 &&
    (area.attributes.climate?.frostDays ?? 0) >= 18 &&
    !constraintData?.protectedArea;
  const constraintsCap = constraints.length > 0;
  if ((frostCap || constraintsCap) && verdict === 'Vhodný') {
    verdict = 'Vhodný s opatřeními';
  }

  const risks: RiskItem[] = [];

  if (results.water && results.water.score < 55) {
    risks.push({
      label: options.irrigation ? 'Vláha i se závlahou' : 'Nedostatek vláhy',
      detail: options.irrigation
        ? 'I s modelovou závlahou zůstává část vláhového deficitu. Ověřte zdroj vody, vydatnost a povolení odběru.'
        : 'Srážky a index sucha neodpovídají nárokům druhu. Zvažte závlahu, jiný druh nebo jinou lokalitu.',
      severity: results.water.score < 30 ? 'high' : 'medium',
    });
  }
  if (results.climate && results.climate.score < 55) {
    risks.push({
      label: 'Jarní mrazy a klima',
      detail: `Druh je citlivý na mrazy v květu (${profile.requirements.frostSensitivity}/5). Zvažte chráněnou polohu, protimrazové opatření nebo odolnější druh.`,
      severity: results.climate.score < 30 ? 'high' : 'medium',
    });
  } else if (
    results.climate &&
    (area.attributes.climate?.frostDays ?? 0) >= 18 &&
    profile.requirements.frostSensitivity >= 3
  ) {
    risks.push({
      label: 'Jarní mrazy v květu',
      detail: `I při dobrém celkovém hodnocení je nutné počítat s mrazíky v době květu (${area.attributes.climate?.frostDays} mrazových dnů, citlivost ${profile.requirements.frostSensitivity}/5).`,
      severity: 'medium',
    });
  }
  if (results.soil && results.soil.score < 60) {
    risks.push({
      label: 'Půdní omezení',
      detail: results.soil.summary,
      severity: 'medium',
    });
  }
  if (results.terrain && results.terrain.score < 60) {
    risks.push({
      label: 'Terén a eroze',
      detail: results.terrain.summary,
      severity: 'medium',
    });
  }
  if (results.access && results.access.score < 60) {
    risks.push({
      label: 'Přístup a tvar plochy',
      detail: results.access.summary,
      severity: 'low',
    });
  }
  if (constraintsCap) {
    for (const constraint of constraints) {
      risks.push({
        label: constraint.label,
        detail: constraint.detail,
        severity: 'high',
      });
    }
  }
  if (criticalCategory && worst && !risks.some((risk) => risk.label.toLowerCase().includes(worst.label.toLowerCase()))) {
    risks.push({
      label: `Kriticky nízké hodnocení: ${worst.label}`,
      detail: `${worst.summary} Kategorie ${worst.label.toLowerCase()} je pod mezní hodnotou 30 bodů, proto je výsledek „Rizikový“.`,
      severity: 'high',
    });
  }
  if (risks.length === 0) {
    risks.push({
      label: 'Provozní rizika zůstávají',
      detail: 'I při dobrém hodnocení je potřeba počítat s počasím v jednotlivých letech, škůdci a vývojem trhu.',
      severity: 'low',
    });
  }

  const positive = [...categories]
    .filter((category) => category.score !== null)
    .sort((a, b) => b.score! - a.score!);
  const negative = [...positive].reverse();
  const reasons: string[] = [];
  const used = new Set<string>();
  const pick = (category: CategoryScore | undefined) => {
    if (category && reasons.length < 3 && !used.has(category.key)) {
      used.add(category.key);
      reasons.push(`${category.label}: ${category.summary}`);
    }
  };
  pick(positive[0]);
  pick(negative[0]);
  for (const category of positive) pick(category);
  while (reasons.length < 3) {
    reasons.push('Hodnocení vychází z dostupných podkladů; chybějící kategorie nejsou nahrazeny nulou.');
  }

  const nextSteps = [
    'Ověřit vlastnické vztahy a výměru v katastru nemovitostí (ČÚZK).',
    'Potvrdit půdní vlastnosti rozborem půdy před výsadbou.',
    'Ověřit územní omezení (záplavy, ochrana přírody) u příslušných úřadů.',
  ];
  if (results.water && results.water.score < 60) {
    nextSteps.push('Prověřit možnost závlahy: zdroj vody, vydatnost, povolení a náklady.');
  }
  if (results.climate && results.climate.score < 60) {
    nextSteps.push('Zvolit odrůdy s pozdějším kvetením nebo polohu méně ohroženou mrazy.');
  }
  if (constraintData?.protectedArea) {
    nextSteps.push('Projednat záměr s orgánem ochrany přírody.');
  }

  return {
    fruit,
    overall,
    verdict,
    verdictClass: verdict === 'Vhodný' ? 'good' : verdict === 'Rizikový' ? 'risk' : 'caution',
    reasons: reasons.slice(0, 3),
    risks,
    nextSteps,
    categories,
    completeness,
    missing,
    assumptions,
    constraints,
  };
}
