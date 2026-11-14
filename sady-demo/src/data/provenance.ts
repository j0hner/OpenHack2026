import type { ProvenanceRow, DataQuality } from "../lib/types";

const spatial = (
  indicator: string,
  source: string,
  resolution: string,
  note: string,
): ProvenanceRow => ({
  indicator,
  source,
  period: "stav při stažení; živé dotazy průběžně",
  resolution,
  note,
  quality: "real",
  connected: "Připravené prostorové výřezy a živé dotazy podle geometrie",
});
export const PROVENANCE: ProvenanceRow[] = [
  {
    indicator: "Vyhledání lokality",
    source: "ČÚZK / RÚIAN – obce a okresy",
    period: "stav při stažení",
    resolution: "6 254 obcí a měst",
    quality: "real",
    connected: "Přibalený seznam, načítaný až při použití hledání",
    note: "Našeptávání bez externího geokodéru. Poloha a obálka území slouží k přiblížení mapy, nikoli k hodnocení parcely.",
  },
  spatial(
    "Katastrální parcely",
    "ČÚZK / RÚIAN REST – filtrované vektorové parcely",
    "parcela",
    "Kliknutí ukáže náhled skutečné parcely; uloží ji až Přidat pozemek. Katastrální druh slouží k vyloučení nezemědělských ploch. Druh pozemku nepotvrzuje povolení výsadby.",
  ),
  spatial(
    "Skutečné jednotky BPEJ",
    "ČÚZK / RÚIAN BPEJ, agendový zdroj SPÚ",
    "polygon BPEJ",
    "Plošné podíly průnikem s konkrétní geometrií. Kód BPEJ nenahrazuje půdní rozbor; pH, humus a skutečná hloubka jsou neověřené.",
  ),
  {
    ...spatial(
      "Historické klimatické agregace",
      "Copernicus / ECMWF ERA5-Land a ERA5 přes Open-Meteo",
      "teplota ~9 km; srážky / ET0 ~25 km",
      "Reanalýza 2005–2024 pro regionální grid. Nejde o mikroklima parcely ani předpověď škod. Při výpadku či neúplné řadě je podklad neznámý.",
    ),
    period: "2005–2024",
  },
  spatial(
    "Průniky s ochranou přírody",
    "AOPK ČR – otevřené vrstvy 0, 2, 6, 7",
    "ZCHÚ, EVL a ptačí oblasti",
    "Plošný průnik skutečných hranic. Nejde o úplné posouzení všech právních omezení ani ochranných pásem.",
  ),
  {
    indicator: "Sklizeň a referenční ceny ovoce",
    source: "ČSÚ ZEM03D / CEN0203B",
    period: "2021–2025",
    resolution: "ČR, pět ovocných druhů",
    quality: "real",
    connected: "Přibalené roční statistiky ČR",
    note: "Skutečná sklizeň a cena, Kč/t převedeno na Kč/kg. Chybějící údaje jsou null. Cenu lze výslovně použít v ekonomice; nejde o výnos konkrétní parcely.",
  },
  {
    indicator: "Mapové podklady",
    source: "OpenStreetMap, ČÚZK Ortofoto, AOPK WMS",
    period: "dle poskytovatele",
    resolution: "mapové dlaždice / WMS",
    quality: "real",
    connected: "Online mapové podklady",
    note: "Dva podklady s maskou ČR a trvalá ochrana přírody. Parcelní hranice tvoří filtrovaný RÚIAN GeoJSON. Výpadek podkladu není nedostatkem agronomických dat.",
  },
  {
    indicator: "Hranice České republiky",
    source: "Natural Earth 1:50m (public domain)",
    period: "2023",
    resolution: "generalizováno, 1 : 50 000 000",
    quality: "real",
    connected: "Lokálně přibalený GeoJSON",
    note: "Orientační celostátní náhled a záložní geometrie při výpadku mapových dlaždic.",
  },
  {
    indicator: "Pěstitelské nároky a bodovací pravidla",
    source: "Orientační profily ovocných druhů a pravidla Moje Sady",
    period: "verze modelu v aplikaci",
    resolution: "ovocný druh",
    quality: "assumption",
    connected: "Vstupy orientačního regionálního indexu",
    note: "Váhy půda 35 / klima 40 / vláha 25 a převod podmínek na body nejsou odborně validovanou pravděpodobností. Výsadba, spon a péče vyžadují místní odborné ověření.",
  },
  {
    indicator: "Ekonomické vstupy a případná podpora",
    source: "Uživatelské vstupy, předvyplněné modelové předpoklady",
    period: "zvolený horizont",
    resolution: "pozemek a ovocný druh",
    quality: "assumption",
    connected: "Nastavitelný ekonomický scénář",
    note: "Sazenice, provozní náklady, cena pachtu, budoucí výnos a podpora jsou předpoklady; nejde o garantované ceny, sklizeň nebo schválenou dotaci.",
  },
  {
    indicator: "Záplavy Q100, mikroklima a provozní podmínky",
    source: "Úplný ověřený podklad není připojený",
    period: "neověřeno",
    resolution: "neověřeno",
    quality: "unavailable",
    connected: "Neověřeno",
    note: "Q100, půdní rozbor, zdroj závlahy a právně zajištěný příjezd je nutné doplnit. Absence záznamu neznamená nízké riziko.",
  },
];
export const QUALITY_LABELS: Record<
  DataQuality,
  { label: string; className: string; hint: string }
> = {
  real: {
    label: "Skutečná data",
    className: "q-real",
    hint: "Napojený nebo lokálně přibalený skutečný otevřený zdroj.",
  },
  precomputed: {
    label: "Předpočítaná data",
    className: "q-precomputed",
    hint: "Data připravená předem z veřejného zdroje, bez online dotazu.",
  },
  assumption: {
    label: "Modelový předpoklad",
    className: "q-assumption",
    hint: "Pravidlo nebo nastavitelný vstup modelu; není to měření konkrétní plochy.",
  },
  unavailable: {
    label: "Neověřeno",
    className: "q-unavailable",
    hint: "Podklad není připojený nebo jeho dostupnost pro tuto geometrii nebyla ověřena.",
  },
};
export const DATA_PRINCIPLES = [
  "Chybějící údaj není nula ani nízké riziko. Bez zásadních podkladů se skóre nepočítá.",
  "Skóre 0–100 vyjadřuje soulad podmínek s nároky druhu, nikoli pravděpodobnost úspěchu.",
  "Dostatek dat pro regionální index není potvrzením vhodnosti ani právní možnosti výsadby.",
  "Druh pozemku sám o sobě neznamená, že je výsadba povolená.",
  "Regionální statistika výnosu není měřením konkrétní parcely.",
  "Podpora je potenciální modelový příjem vyžadující ověření podmínek, nikoli jistota.",
];
