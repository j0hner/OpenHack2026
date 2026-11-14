import type { ParcelFeature } from "./openData";
/** Veřejné dotazy s timeoutem; chyba se nikdy nenahrazuje smyšlenou parcelou. */

export interface PlaceResult {
  label: string;
  lat: number;
  lon: number;
  type: string;
  source: string;
}

export class AdapterError extends Error {
  readonly detail: string;

  constructor(message: string, detail: string) {
    super(message);
    this.name = "AdapterError";
    this.detail = detail;
  }
}

const withTimeout = async (
  input: RequestInfo,
  init: RequestInit = {},
  ms = 9000,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    throw new AdapterError(
      "Zadejte alespoň 3 znaky",
      "Vyhledávání místa je dostupné od tří znaků.",
    );
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cz&limit=5&accept-language=cs&q=${encodeURIComponent(trimmed)}`;
  let response: Response;
  try {
    response = await withTimeout(url, {
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    throw new AdapterError(
      "Vyhledávání místa je nedostupné",
      `Nominatim neodpověděl (${error instanceof Error ? error.message : "neznámá chyba"}). Zkontrolujte připojení; mapu lze dál ovládat ručně.`,
    );
  }
  if (!response.ok) {
    throw new AdapterError(
      "Vyhledávání místa vrátilo chybu",
      `Nominatim odpověděl HTTP ${response.status}. Zkuste to později nebo vyberte oblast v mapě.`,
    );
  }
  const data = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    type: string;
  }>;
  return data.map((item) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
    type: item.type,
    source: "Nominatim / OpenStreetMap",
  }));
}

const CUZK_REST =
  "https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer";

export async function lookupCadastralParcel(
  parcelNumber: string,
  katastr: string,
): Promise<ParcelFeature> {
  const number = parcelNumber.trim(),
    territory = katastr.trim();
  if (
    !/^(?:st\.\s*)?\d+(?:\/\d+)?$/i.test(number) ||
    !territory ||
    territory.length > 100
  )
    throw new AdapterError(
      "Zkontrolujte vstup",
      "Zadejte číslo parcely (např. 1123) a přesný název nebo šestimístný kód katastrálního území.",
    );
  const query = async (layer: number, params: Record<string, string>) => {
    const r = await withTimeout(
      CUZK_REST +
        "/" +
        layer +
        "/query?" +
        new URLSearchParams({ f: "json", ...params }),
      {},
      12000,
    );
    if (!r.ok) throw new AdapterError("ČÚZK je nedostupný", "HTTP " + r.status);
    const d = await r.json();
    if (d.error || d.exceededTransferLimit)
      throw new AdapterError(
        "Neúplná odpověď ČÚZK",
        "Zkuste upřesnit vstup nebo vyberte parcelu v mapě.",
      );
    return d;
  };
  let code = territory;
  if (!/^\d{6}$/.test(code)) {
    const escaped = territory.replaceAll("'", "''").toLocaleUpperCase("cs-CZ");
    const d = await query(7, {
      where: "UPPER(nazev) = '" + escaped + "'",
      outFields: "kod,nazev",
      returnGeometry: "false",
      resultRecordCount: "10",
    });
    if (d.features?.length !== 1)
      throw new AdapterError(
        "Katastrální území není jednoznačné",
        "Použijte jeho přesný název nebo šestimístný kód ČÚZK.",
      );
    code = String(d.features[0].attributes.kod);
  }
  const d = await query(5, {
    where:
      "katastralniuzemi = " + code + " AND cisloparcely = '" + number + "'",
    outFields:
      "id,cisloparcely,vymeraparcely,druhpozemkukod,zpusobyvyuzitipozemku,katastralniuzemi",
    outSR: "4326",
    f: "geojson",
    resultRecordCount: "10",
  });
  if (d.features?.length !== 1)
    throw new AdapterError(
      "Parcela nebyla jednoznačně nalezena",
      "Ověřte parcelní číslo nebo použijte výběr v katastrální mapě.",
    );
  const f = d.features[0];
  if (
    !["Polygon", "MultiPolygon"].includes(f.geometry?.type) ||
    !/^\d+$/.test(String(f.properties?.id))
  )
    throw new AdapterError(
      "Geometrie parcely není dostupná",
      "Zkuste výběr v mapě.",
    );
  return f;
}
export const ADAPTER_SUMMARY = [
  {
    name: "ČÚZK / RÚIAN – obce a města",
    status: "Napojeno",
    note: "Lokální našeptávání z úplného přibaleného seznamu obcí ČR; při psaní se nevolá externí geokodér.",
  },
  {
    name: "ČÚZK RÚIAN REST + katastrální WMS",
    status: "Napojeno",
    note: "Výběr parcely v celé ČR; lokální výřezy pěti lokalit, jinde online dotaz s timeoutem.",
  },
  {
    name: "BPEJ, ERA5-Land / ERA5, AOPK",
    status: "Napojeno",
    note: "Pět připravených výřezů + živé prostorové dotazy podle polygonu a souřadnic. Chybějící údaje zůstávají neznámé.",
  },
  {
    name: "ČSÚ ZEM03D / CEN0203B",
    status: "Napojeno",
    note: "Skutečné roční statistiky 2021–2025, pět druhů. Použití ceny v ekonomice je výslovná volba.",
  },
];
