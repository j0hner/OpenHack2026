import type { ProvenanceRow } from '../lib/types';

/**
 * Panel „Z čeho vycházíme“.
 *
 * Stav u každého zdroje popisuje REALITU dema, ne záměr. Uvedení instituce
 * neznamená, že je zdroj napojený. Demo data nejsou vydávaná za skutečná.
 */

const MODEL_PROVENANCE: ProvenanceRow[] = [
  {
    indicator: 'Hranice České republiky',
    source: 'Natural Earth 1:50m (public domain)',
    period: '2023',
    resolution: 'generalizováno, 1 : 50 000 000',
    quality: 'real',
    connected: 'Ano – lokálně přibalený GeoJSON, funguje i bez internetu',
    note: 'Používá se pro náhled celé ČR a jako záložní podklad při výpadku mapových dlaždic.',
  },
  {
    indicator: 'Hranice krajů (NUTS3)',
    source: 'Eurostat GISCO – NUTS 2021',
    period: '2021',
    resolution: '1 : 20 000 000',
    quality: 'real',
    connected: 'Ano – lokálně přibalený GeoJSON',
    note: 'Slouží k výběru oblasti a přiblížení mapy.',
  },
  {
    indicator: 'Základní mapa (dlaždice)',
    source: 'OpenStreetMap',
    period: 'průběžně',
    resolution: 'vektorová data renderovaná do dlaždic',
    quality: 'real',
    connected: 'Ano – online dlaždice; při výpadku aplikace přepne na lokální hranici ČR',
    note: 'Podkladové dlaždice se nenačítají při offline režimu; analýzy fungují dál.',
  },
  {
    indicator: 'Vyhledání lokality',
    source: 'Nominatim / OpenStreetMap',
    period: 'průběžně',
    resolution: 'bod + administrativní celek',
    quality: 'real',
    connected: 'Ano – online dotaz s ošetřením chyby',
    note: 'Používá se pouze pro orientaci v mapě, nevstupuje do analýzy.',
  },
  {
    indicator: 'Katastrální parcely a RÚIAN',
    source: 'ČÚZK – INSPIRE WFS (katastrální parcely)',
    period: 'průběžně',
    resolution: 'parcela',
    quality: 'unavailable',
    connected:
      'Ne – veřejné WFS neumožňuje přímé volání z prohlížeče (CORS) a demo nesmí mít backend ani klíč',
    note: 'Ukázkové plochy jsou proto označené jako „ukázková plocha“, nikoli jako skutečné parcely.',
  },
  {
    indicator: 'Zemědělské půdní bloky',
    source: 'LPIS (MZe)',
    period: '2024',
    resolution: 'půdní blok / díl',
    quality: 'demo',
    connected: 'Ne – v demu jsou ilustrativní bloky',
    note: 'Vrstva je pouze orientační a do výpočtu nevstupuje.',
  },
  {
    indicator: 'Půda a BPEJ',
    source: 'BPEJ (MZe / VÚMOP)',
    period: '2022',
    resolution: 'půdní jednotka, 1 : 5 000',
    quality: 'demo',
    connected: 'Ne – v demu modelové půdní jednotky pro ukázkové plochy',
    note: 'Hodnoty pH, hloubky a humusu jsou modelové; před výsadbou je nutný půdní rozbor.',
  },
  {
    indicator: 'Teploty, srážky, mrazové dny',
    source: 'ČHMÚ – klimatické normály 1991–2020',
    period: '1991–2020',
    resolution: 'stanice / grid ~1 km',
    quality: 'assumption',
    connected: 'Ne – v demu modelové hodnoty odvozené z typických podmínek oblasti',
    note: 'Regionální charakteristika nenahrazuje měření na konkrétní parcele.',
  },
  {
    indicator: 'Sucho a dostupnost vláhy',
    source: 'ČHMÚ / InterSucho, vodní bilance',
    period: '2015–2024',
    resolution: 'grid ~500 m – 1 km',
    quality: 'demo',
    connected: 'Ne – v demu modelové zóny rizika sucha',
    note: 'Index rizika sucha 0–100 je modelový ukazatel, ne měření obsahu vody v půdě.',
  },
  {
    indicator: 'Terén, sklon, expozice',
    source: 'ČÚZK – DMR 5G',
    period: '2013–2016',
    resolution: '2 × 2 m',
    quality: 'demo',
    connected: 'Ne – v demu orientační odhad sklonu a expozice',
    note: 'Skutečný sklon je nutné ověřit z výškového modelu nebo zaměřením.',
  },
  {
    indicator: 'Záplavová území',
    source: 'VÚV TGM / vodoprávní evidence',
    period: 'průběžně',
    resolution: 'záplavová čára Q5–Q100',
    quality: 'demo',
    connected: 'Ne – v demu ilustrativní polygon u plochy B',
    note: 'Rozsah a podmínky vždy ověřte u vodoprávního úřadu.',
  },
  {
    indicator: 'Chráněná území',
    source: 'AOPK ČR – ústřední seznam ochrany přírody',
    period: 'průběžně',
    resolution: 'hranice ZCHÚ a ochranných pásem',
    quality: 'demo',
    connected: 'Ne – v demu ilustrativní ochranné pásmo u plochy C',
    note: 'Režim ochrany a případné podmínky je nutné projednat s orgánem ochrany přírody.',
  },
  {
    indicator: 'Dostupnost cest',
    source: 'RÚIAN / OpenStreetMap',
    period: 'průběžně',
    resolution: 'liniová síť',
    quality: 'demo',
    connected: 'Ne – v demu ilustrativní příjezdy',
    note: 'Skutečný příjezd a jeho průjezdnost je nutné ověřit v terénu.',
  },
  {
    indicator: 'Vegetační a krajinný kontext',
    source: 'Copernicus / Sentinel-2',
    period: '2015–2024',
    resolution: '10 m',
    quality: 'unavailable',
    connected: 'Ne – v demu nenapojeno',
    note: 'Zamýšlené rozšíření: NDVI trendy a kontrola stavu porostu.',
  },
  {
    indicator: 'Referenční výnosy a ceny ovoce',
    source: 'ČSÚ, Situační a výhledové zprávy MZe, Eurostat',
    period: '2019–2023',
    resolution: 'region / ČR, nikoli parcela',
    quality: 'assumption',
    connected: 'Ne – v demu modelové hodnoty',
    note: 'Regionální statistika výnosu není měřením konkrétní parcely ani slibem ceny.',
  },
  {
    indicator: 'Podpory a dotace',
    source: 'MZe / SZIF',
    period: '2023–2027',
    resolution: 'opatření / dotační titul',
    quality: 'assumption',
    connected: 'Ne – modelová částka podpory',
    note: 'Podpora je potenciální a vyžaduje ověření podmínek a schválení žádosti.',
  },
  {
    indicator: 'Ceny pozemků a pachtu',
    source: 'ČSÚ, cenové mapy, tržní nabídky',
    period: '2023–2024',
    resolution: 'okres / lokalita',
    quality: 'assumption',
    connected: 'Ne – modelové hodnoty',
    note: 'Skutečná cena se odvíjí od konkrétní nabídky a vyjednávání.',
  },
];

const prepared = (indicator:string,source:string,period:string,resolution:string,note:string):ProvenanceRow => ({indicator,source,period,resolution,note,quality:'real',connected:'Skutečné otevřené podklady v pěti připravených výřezech; samostatně od demo skóre'});
export const PROVENANCE:ProvenanceRow[]=[
 prepared('Katastrální parcely','ČÚZK / RÚIAN REST + katastrální WMS','stav při stažení; živé API průběžně','parcela','Pět lokálních výřezů + živý výběr v celé ČR, popup a odkaz do oficiálního katastru.'),
 prepared('Skutečné jednotky BPEJ','ČÚZK / RÚIAN BPEJ, agendový zdroj SPÚ','stav při stažení','polygon BPEJ','Plošné podíly průnikem; kód BPEJ není půdní rozbor, pH a humus se nedoplňuje.'),
 prepared('Historické klimatické agregace','Copernicus / ECMWF ERA5-Land + ERA5 přes Open-Meteo','2005–2024','teplota ~9 km; srážky / ET0 ~25 km','Reanalýza pro střed lokality, nikoli měření na parcele nebo predikce škod.'),
 prepared('Výškové vzorky','ČÚZK DMR 5G','stav služby při stažení','pět bodů kolem středu lokality','Orientační sklon společný pro lokalitu, nikoli celoplošná analýza každé parcely.'),
 prepared('Skutečné průniky s ochranou přírody','AOPK ČR, otevřené vrstvy 0, 2, 6, 7','stav při stažení','ZCHÚ, EVL a ptačí oblasti','Pět výřezů; zjednodušení 0,00002°. Neobsahuje všechna právní omezení ani ochranná pásma.'),
 {...prepared('Sklizeň a referenční ceny','ČSÚ ZEM03D / CEN0203B','2021–2025','ČR, pět ovocných druhů','Skutečná sklizeň a cena, Kč/t převedeno na Kč/kg; chybějící údaje jsou null. Cenu lze výslovně použít v ekonomice.'),connected:'Statické statistiky ČR; žádný odhad výnosu t/ha parcely'},
 {...prepared('Letecký, satelitní a terénní podklad','ČÚZK Ortofoto, ESA WorldCover / Sentinel-2 přes Terrascope, ČÚZK DMR 5G','satelit 2021; ostatní dle poskytovatele','satelit 10 m','Satelit je roční RGB mozaika 2021, nikoli živý snímek. Bez tajných klíčů.'),connected:'Online mapové podklady'},
 {indicator:'Záplavové riziko Q100',source:'Otevřená distribuční licence neověřena',period:'neověřeno',resolution:'neověřeno',quality:'unavailable',connected:'Nepřipojeno',note:'Data VÚV se nepřibalují. Absence polygonu není nulové riziko.'},
 ...MODEL_PROVENANCE.filter(p=>!['Katastrální parcely a RÚIAN','Záplavová území','Chráněná území','Vegetační a krajinný kontext'].includes(p.indicator)).map(p=>p.quality==='real'?p:{...p,indicator:p.indicator+' (demo model)',note:(p.note??'')+' Tyto předpoklady jsou oddělené od skutečných podkladů.'}),
];

export const QUALITY_LABELS: Record<string, { label: string; className: string; hint: string }> = {
  real: { label: 'Skutečná data', className: 'q-real', hint: 'Napojený nebo lokálně přibalený skutečný zdroj.' },
  precomputed: {
    label: 'Předpočítaná data',
    className: 'q-precomputed',
    hint: 'Data připravená předem z veřejného zdroje, bez online dotazu.',
  },
  assumption: {
    label: 'Modelový předpoklad',
    className: 'q-assumption',
    hint: 'Hodnota pro výpočet, nikoli měření konkrétní plochy.',
  },
  demo: { label: 'Demo data', className: 'q-demo', hint: 'Ilustrativní data vytvořená pro demonstraci.' },
  unavailable: {
    label: 'Nedostupné',
    className: 'q-unavailable',
    hint: 'Zdroj není v tomto demu napojený nebo volání z prohlížeče nefunguje.',
  },
};

export const DATA_PRINCIPLES = [
  'Chybějící údaj není nula ani nízké riziko. Pokud chybí zásadní podklady, skóre se nepočítá.',
  'Skóre 0–100 vyjadřuje soulad podmínek s nároky druhu, nikoli pravděpodobnost úspěchu.',
  'Druh pozemku sám o sobě neznamená, že je výsadba povolená.',
  'Regionální statistika výnosu není měřením konkrétní parcely.',
  'Podpora je potenciální příjem vyžadující ověření podmínek, ne jistota.',
  'Demo výsledky nejsou nikdy vydávané za skutečný výpočet z otevřených dat.',
];
