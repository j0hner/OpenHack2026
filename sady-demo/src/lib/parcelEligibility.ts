import type { ParcelFeature } from "./openData";
import type { AnalysisArea } from "./types";

/** RÚIAN layer 5 coded domains, checked 2026-11-14. This is a discovery
 * filter, not a legal determination that planting or changing land use is allowed.
 * https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5?f=pjson
 */
export const ELIGIBLE_LAND_USE_CODES = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
] as const;
export const LAND_USE: Record<string, string> = {
  "2": "orná půda",
  "3": "chmelnice",
  "4": "vinice",
  "5": "zahrada",
  "6": "ovocný sad",
  "7": "trvalý travní porost",
  "8": "trvalý travní porost",
  "10": "lesní pozemek",
  "11": "vodní plocha",
  "13": "zastavěná plocha a nádvoří",
  "14": "ostatní plocha",
};
const ROAD_USES: Record<string, string> = {
  "14": "dráha",
  "15": "dálnice",
  "16": "silnice",
  "17": "ostatní komunikace",
  "18": "ostatní dopravní plocha",
};
export interface ParcelEligibility {
  allowed: boolean;
  code: string | null;
  landUse: string;
  reason: string;
}
export function parcelEligibility(
  input: ParcelFeature | AnalysisArea,
): ParcelEligibility {
  const feature = "properties" in input;
  const rawCode = feature ? input.properties?.druhpozemkukod : undefined;
  const rawName = feature
    ? ""
    : input.landUse.trim().toLocaleLowerCase("cs-CZ");
  const code =
    rawCode !== null && rawCode !== undefined && String(rawCode).trim()
      ? String(rawCode).trim()
      : (Object.keys(LAND_USE).find((key) => LAND_USE[key] === rawName) ??
        null);
  const landUse =
    code && LAND_USE[code]
      ? LAND_USE[code]
      : rawName || "neuvedený druh pozemku";
  if (code && (ELIGIBLE_LAND_USE_CODES as readonly string[]).includes(code)) {
    return {
      allowed: true,
      code,
      landUse,
      reason:
        "Zemědělský druh pozemku. Před výsadbou je nutné ověřit místní podmínky, omezení a případnou změnu využití.",
    };
  }
  const wayOfUse = feature
    ? ROAD_USES[String(input.properties?.zpusobyvyuzitipozemku)]
    : undefined;
  let reason: string;
  if (code === "10") reason = "Lesní pozemky do výběru pro sad nenabízíme.";
  else if (code === "11") reason = "Vodní plochy do výběru pro sad nenabízíme.";
  else if (code === "13")
    reason = "Zastavěné plochy a nádvoří do výběru pro sad nenabízíme.";
  else if (code === "14")
    reason = wayOfUse
      ? `Dopravní využití (${wayOfUse}) není plochou pro založení sadu.`
      : "Ostatní plochy mohou zahrnovat silnice a další nezemědělské využití. Nabízíme pouze parcely s evidovaným zemědělským druhem.";
  else
    reason =
      "Druh pozemku není spolehlivě určený jako zemědělský. Parcelu proto k založení sadu nenabízíme.";
  return { allowed: false, code, landUse, reason };
}
export class ParcelEligibilityError extends Error {
  constructor(readonly eligibility: ParcelEligibility) {
    super(eligibility.reason);
    this.name = "ParcelEligibilityError";
  }
}

/** Apply the same conservative rule to cached and live discoveries. */
export function eligibleParcels(features: ParcelFeature[]): ParcelFeature[] {
  const allowed = features.filter(
    (feature) => parcelEligibility(feature).allowed,
  );
  if (!allowed.length && features.length)
    throw new ParcelEligibilityError(parcelEligibility(features[0]));
  return allowed;
}
