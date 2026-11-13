/**
 * Datové adaptéry pro režim „Vlastní pozemek“.
 *
 * Skutečné veřejné zdroje se volají tam, kde je to z prohlížeče proveditelné
 * (vyhledání lokality přes Nominatim). Katastrální WFS ČÚZK je z prohlížeče
 * blokované – adaptér to zkusí a výsledek poctivě vrátí jako chybu, nikdy
 * ji nenahradí demo daty.
 */

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
    this.name = 'AdapterError';
    this.detail = detail;
  }
}

const withTimeout = async (input: RequestInfo, init: RequestInit = {}, ms = 9000): Promise<Response> => {
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
    throw new AdapterError('Zadejte alespoň 3 znaky', 'Vyhledávání místa je dostupné od tří znaků.');
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cz&limit=5&accept-language=cs&q=${encodeURIComponent(trimmed)}`;
  let response: Response;
  try {
    response = await withTimeout(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new AdapterError(
      'Vyhledávání místa je nedostupné',
      `Nominatim neodpověděl (${error instanceof Error ? error.message : 'neznámá chyba'}). Zkontrolujte připojení; mapu lze dál ovládat ručně.`,
    );
  }
  if (!response.ok) {
    throw new AdapterError(
      'Vyhledávání místa vrátilo chybu',
      `Nominatim odpověděl HTTP ${response.status}. Zkuste to později nebo vyberte oblast v mapě.`,
    );
  }
  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string; type: string }>;
  return data.map((item) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lon: Number(item.lon),
    type: item.type,
    source: 'Nominatim / OpenStreetMap',
  }));
}

const CUZK_WFS = 'https://services.cuzk.cz/wfs/inspire-cp-wfs.asp';

/**
 * Pokus o dotaz na katastrální parcely ČÚZK.
 * Služba nepovoluje volání z prohlížeče (CORS) – chyba se zobrazí uživateli.
 */
export async function lookupCadastralParcel(parcelNumber: string, katastr: string): Promise<never> {
  if (!parcelNumber.trim() || !katastr.trim()) {
    throw new AdapterError(
      'Chybí vstup',
      'Zadejte parcelní číslo i katastrální území. Teprve pak lze parcelu dohledávat.',
    );
  }
  const url = `${CUZK_WFS}?service=WFS&request=GetCapabilities`;
  let response: Response | null = null;
  let failure = '';
  try {
    response = await withTimeout(url, { headers: { Accept: 'application/xml' } }, 7000);
  } catch (error) {
    failure = error instanceof Error ? `${error.name}: ${error.message}` : 'neznámá chyba';
  }

  if (!response || !response.ok) {
    throw new AdapterError(
      'Parcelu se nepodařilo ověřit',
      `Katastrální WFS ČÚZK není z prohlížeče dostupné${
        response ? ` (HTTP ${response.status})` : failure ? ` (${failure})` : ''
      }. Statické demo bez backendu ho nemůže obejít, proto nic nedoplňujeme demo daty. Řešení: napojit proxy/WFS službu v backendu, nebo použít export z Nahlížení do katastru. Plochu lze zakreslit ručně a pracovat s ní jako s vlastní plochou.`,
    );
  }

  throw new AdapterError(
    'Přímé dotazování parcel není v demu implementováno',
    `Rozhraní ČÚZK odpovědělo, ale filtrování podle parcelního čísla a k. ú. vyžaduje dotaz GetFeature s CQL, který v tomto statickém demu není implementovaný. Zadané údaje (${parcelNumber.trim()}, ${katastr.trim()}) jsme neuložili. Plochu zakreslete ručně.`,
  );
}

export const ADAPTER_SUMMARY = [
  {
    name: 'Nominatim / OpenStreetMap – vyhledání lokality',
    status: 'Napojeno',
    note: 'Online dotaz, ošetřený timeout a chybový stav.',
  },
  {
    name: 'ČÚZK WFS – katastrální parcely',
    status: 'Nedostupné',
    note: 'Veřejné WFS blokuje volání z prohlížeče (CORS); demo bez backendu to neobchází.',
  },
  {
    name: 'LPIS, BPEJ, ČHMÚ, AOPK – analytická data',
    status: 'Nenapojeno',
    note: 'V demu nahrazeno výslovně označenými modelovými daty, nikdy nevydávanými za skutečnost.',
  },
];
