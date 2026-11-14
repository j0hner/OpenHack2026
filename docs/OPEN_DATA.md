# Použitá otevřená data

Připraveno 13. 11. 2026. Data jsou v `sady-demo/public/data/`. Aplikace nepotřebuje backend; předzpracování běží lokálně v Node.js a výsledné JSON / GeoJSON soubory hostuje GitHub Pages. Souřadnice geometrií jsou WGS84 / EPSG:4326, mapové dlaždice EPSG:3857.

Rozhraní Moje Sady navíc používá aktuální přibalený seznam **6 254 obcí a měst ČR** pro horní našeptávač. Jde o RÚIAN ČÚZK (vrstva 12, bez vojenských újezdů), s názvy okresů z vrstvy 15. Soubor `municipalities.json` má 564 869 B; při psaní se prohledává lokálně a nevolá externí geokodér. Podrobnosti, schéma, dotazy, datum stažení a SHA-256 jsou v `municipalities-metadata.json`. Souřadnice pro navigaci jsou středem bboxu generalizovaného polygonu obce, nikoli definicí parcely. Výběr použije bbox celého území obce.

## Hlavní analytické zdroje

| Zdroj a licence | Co aplikace skutečně používá | Stažení a spojení |
| --- | --- | --- |
| [ČÚZK RÚIAN – parcely](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5), CC BY 4.0 | ID, parcelní číslo, kód k. ú., druh pozemku, evidovaná výměra, plná geometrie | REST `/5/query`, `f=geojson`, `inSR=4326`, `outSR=4326`, prostorový bbox. Stránkování po 500. Lokální výběr bodem v polygonu; jinde živý dotaz `esriSpatialRelIntersects`. Hledání katastru vrstvou `/7/query`. |
| [ČÚZK RÚIAN – BPEJ](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28), CC BY 4.0; agendový zdroj SPÚ | Skutečné kódy a hranice jednotek BPEJ | REST `/28/query`, GeoJSON, bbox. Podíl průnikem s polygonem parcely. Kódy se uchovávají jako řetězce; bez domýšlení pH nebo humusu. |
| [Copernicus / ECMWF ERA5-Land + ERA5 přes Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api), data CC BY 4.0 | 2005–2024: teplota, jarní mrazové dny (březen–květen, Tmin < 0 °C), letní dny (Tmax ≥ 25 °C), srážky a ET0 | `https://archive-api.open-meteo.com/v1/archive`, denní JSON agregovaný po letech. Teploty ERA5-Land ~9 km; srážky / ET0 ERA5 ~25 km. Souřadnice středu lokality, nikoli parcelní měření. Bezplatné API pouze nekomerčně; licence dat a podmínky API jsou odlišné. |
| [AOPK otevřená data](https://gis.nature.cz/arcgis/rest/services/Aplikace/Opendata/MapServer), CC BY 4.0 | Velkoplošná ZCHÚ (0), maloplošná ZCHÚ (2), EVL (6), ptačí oblasti (7) | REST `/{vrstva}/query`, GeoJSON a bbox. Průniky s parcelou. Nejde o úplné posouzení všech právních omezení ani všech ochranných pásem. |
| [ČSÚ ZEM03D – sklizeň ovoce](https://data.csu.gov.cz/opendata/sady/ZEM03D/distribuce/json), otevřená data ČSÚ dle metadat | Skutečná sklizeň v ČR 2021–2025 pro jablka, hrušky, švestky, třešně a meruňky | Stažení JSON-stat; indexování podle pojmenovaných dimenzí, nikoli pevných pozic. Ve výsledku jen pět druhů × pět let. V použitých buňkách chybí hektary, proto t/ha zůstává null. |
| [ČSÚ CEN0203B – ceny zemědělských výrobků](https://data.csu.gov.cz/opendata/sady/CEN0203B/distribuce/json), otevřená data ČSÚ dle metadat | Roční ceny výrobců 2021–2025, stejné druhy; u jablek konzumní jablka | JSON-stat, celá ČR, roční období. Kč/t děleno 1 000 na Kč/kg. Chybějící ceny nejsou nuly ani interpolace. Použití v ekonomice tlačítkem uživatele. |

ČÚZK uvádí otevřené produkty a licenci na [stránce otevřených dat](https://ags.cuzk.gov.cz/opendata/). AOPK uvádí CC BY 4.0 přímo v popisu služby. ČSÚ poskytuje [otevřené datové sady a metadata](https://data.csu.gov.cz/); licence konkrétního vydání je součástí podmínek / metadat poskytovatele. Data se distribuují s atribucí původního poskytovatele.

## Podklady a zachované zdroje

| Zdroj | Rozhraní / použití |
| --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL 1.0 | `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; online podklad. Dlaždice se nestahují hromadně. Dodržujte [pravidla dlaždic](https://operations.osmfoundation.org/policies/tiles/). Vyhledávání obcí zajišťuje přibalený RÚIAN. |
| [ČÚZK RÚIAN – obce a města](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/12), CC BY 4.0 | Našeptávání celého seznamu obcí a měst; okresy z [vrstvy 15](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/15). REST JSON po 500 záznamech, stabilní řazení dle kódu, ověření počtu a jedinečnosti. Do webu se ukládají pouze názvy, okres, souřadnice, status a bbox, nikoli plné polygony. |
| [ČÚZK Ortofoto ČR](https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer), CC BY 4.0 | Letecké XYZ: `https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}`. OSM nemá vlastní letecký podklad. |
| [ČÚZK katastrální mapa](https://wms.cuzk.gov.cz/), otevřená prostorová data ČÚZK | `https://services.cuzk.gov.cz/wms/local-km-wms.asp`, WMS 1.1.1, vrstva `KN`, transparentní PNG. Od přiblížení 14. Popup z RÚIAN REST; WMS samo nevrací analytickou geometrii. |
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain | Zachovaná lokální generalizovaná hranice ČR, měřítko 1:50m, záložní náhled při výpadku dlaždic. |
| [Eurostat GISCO NUTS 2021](https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics), podmínky GISCO / Eurostat | Zachované lokální orientační hranice 14 krajů; zachována původní atribuce. Samostatné filtry kraje / obce nejsou součástí nového rozhraní. |

## Co se nestahuje

- VÚV Q100: veřejná dostupnost REST sama nepotvrzuje otevřenou licenci. [Podmínky HEIS](https://heis.vuv.cz/data/spusteni/popisy/isvs_zapluz.asp) uvádějí souhlas s dalším šířením; Q100 se nedistribuuje a v aplikaci je neověřené.
- LPIS, měření ČHMÚ, InterSucho, aktuální dotační pravidla a síť právně zajištěných příjezdů nejsou napojené. Původní ilustrační vrstvy jsou označené jako demo. Úplná republika, celá historie denního počasí, velké rastry ani satelitní snímky se do repozitáře nekopírují.
- Pěstitelské profily, pH / humus pro demo, náklady, budoucí výnos t/ha a dotace jsou předpoklady, nikoli nově získaná otevřená data.

## Rozsah a výkon

Výřezy kolem středu pěti ukázkových lokalit: Bílany / Kroměříž, Staňkovice, Horní Maršov, Hustopeče a Třebíč. Každý bbox: ±0,006° délky a ±0,004° šířky; přesné souřadnice v `locations-index.json`. Bbox nemusí odpovídat hranici stejnojmenného katastru.

- 6 538 parcel; plné geometrie po lokalitách v `locations/*-parcels.json`.
- Analytické podklady v `locations/*.json`, přibližně 200 kB dohromady. Parcely + analytika přibližně 5,8 MB před gzip.
- Celý adresář distribuovaných otevřených dat včetně seznamu 6 254 obcí a metadat má přibližně 6,35 MB před gzip. Načítání je rozdělené podle účelu a lokality.
- BPEJ / AOPK jsou oříznuté na bbox. AOPK zjednodušena při získání o 0,00002°, parcelní geometrie nezjednodušená. Připravený výřez se použije, jen když **celá plocha** leží uvnitř. Jinde se BPEJ / AOPK dotazují bboxem a oříznou skutečným polygonem; klima se načítá pro bod uvnitř polygonu. Nikdy se nepřiřazuje nejbližší demo profil podle názvu obce.
- Analytické vrstvy se načítají až při zapnutí nebo otevření detailu. Parcelní soubor až při kliknutí v dané lokalitě. Výsledky fetchů se v rámci relace sdílejí.
- `manifest.json`: zdroje, licence, rozsah, velikosti a SHA-256 připravených souborů. `downloads.json` je pouze částečný protokol posledního obnoveného běhu původního stažení, nikoli kompletní audit všech odpovědí.
- Seznam obcí má samostatný manifest `municipalities-metadata.json`, načítá se až při použití vyhledávání a nepřidává se ke každému analytickému požadavku. Názvy s diakritikou zůstávají zachované; pro vyhledávání se používá odvozený normalizovaný index.

## Obnovení dat

V `sady-demo/`, Node.js 22+ a nainstalované závislosti:

```sh
npm run data:download
npm run data:package
npm run data:rainfall
npm run data:package
npm run data:verify
npm run build
```

Seznam obcí lze nezávisle obnovit pomocí `node scripts/prepare-municipalities.mjs` a ověřit přes `npm run test:localities`. Obnova není součástí běžného buildu ani psaní do vyhledávacího pole.

Stahování zapisuje mezivýsledky do ignorované `.data-cache/`, aby nebyly velké národní tabulky součástí webu. Již dokončené lokality při opakovaném spuštění přeskočí. Pro úplné nové stažení vyprázdněte cache nebo upravte seznam `areas` ve stahovacím skriptu. Limity API se neobcházejí: při HTTP 429 počkejte podle pravidel poskytovatele a pokračujte později. Příprava nemá být spouštěná při každém buildu / otevření stránky.

`data:package` parsuje JSON-stat, ořezává analytické geometrie, rozděluje parcely a generuje manifest. `data:rainfall` doplní srážky a ET0 z ERA5 (samotná ERA5-Land je v použitém API neposkytla) a aktualizuje také surovou cache. `data:verify` odmítne neúplné klima, vadné geometrie, duplicitní ID, neodpovídající hash nebo překročení datového rozpočtu.

## Prohlížeč, CORS a výpadky

Při původním ověření datových adaptérů byly živé ČÚZK REST dotazy podle bodu i parcelního čísla / názvu katastru, BPEJ, Open-Meteo ERA5 a AOPK ověřené z Chrome přímo z originu aplikace; nejsou závislé na WFS ani proxy. Aktuální rozhraní Moje Sady se vizuálně a interakčně kontroluje v integrovaném prohlížeči Codex. Timeout a přerušení předchozího požadavku chrání před opožděnými výsledky. Horní našeptávač používá místní seznam RÚIAN; Nominatim se pro průběžné hledání nepoužívá. Mapové WMS / XYZ se načítají jako obrázky a nečtou se z canvasu, takže nevyžadují CORS pro čtení pixelů. Úspěšný GetCapabilities ještě není důkazem funkčního GetMap; ověřovaly se i skutečné obrázky podkladů.

Analytické JSON jsou ze stejného originu jako aplikace, proto při prezentaci nevolají externí analytická API. Nejde o service worker offline cache: první načtení potřebuje dostupný hosting. V režimu bez připojení fungují pouze již dostupné soubory / cache prohlížeče, nikoli živé mapy a nové parcely mimo výřezy.

## Regionální index zapojený do aplikace

Výchozí režim Skutečná otevřená data používá stejný index v detailu, doporučení druhů, porovnání i barevném zobrazení ploch. Oddělené ukázkové scénáře se volí v Nastavení v poli Režim hodnocení. Změna názvu pozemku ani přesun mapy na jinou obec nesmí změnit zdroje ani skóre původní geometrie.

1. BPEJ se řeže polygonem (včetně otvorů / multipolygonů), podíly jsou vážené plochou. HPJ je druhá a třetí číslice pětimístného kódu. Skupiny půd odpovídají [popisu VÚMOP](https://mapy.vumop.cz/vrstvy.php); číselné indexy jsou transparentní heuristika Moje Sady, nikoli oficiální body BPEJ nebo měřená chemie. Hodnoty pro HPJ 01–08 / 09–13 / 14–17 / 18–20 / 21–23 / 24–33 / 34–36 / 37–39 / 40–41 / 42–54 / 55–59 / 60–63 / 64–78 / 79–81 / 82–89 jsou 90 / 85 / 80 / 65 / 50 / 70 / 45 / 20 / 30 / 40 / 65 / 60 / 20 / 60 / 35. Kódy neodvozují pH, humus ani skutečnou hloubku.
2. Klima: průměrná teplota, jarní mrazové dny a letní dny se porovnávají s explicitně modelovými požadavky zvoleného ovocného druhu. Živé dotazy používají ERA5 ~25 km pro období 2005–2024; připravené výřezy mají teploty ERA5-Land ~9 km a srážky / ET0 ERA5 ~25 km. Detail ukazuje skutečné souřadnice gridů a jejich vztah k bodu uvnitř plochy. Nejbližší grid není mikroklima parcely.
3. Vláha: srážky vůči nároku druhu a deficit P−ET0. Nejde o měření půdní vláhy ani výpočet potřebné závlahy. Souhrnné skóre má váhy půda 35 %, klima 40 %, vláha 25 %. Převody na body, požadavky druhů i váhy jsou orientační předpoklady.
4. Minimum: platná BPEJ na alespoň 80 % plochy, bez nejednoznačných překryvů, a nejméně 15 úplných let všech potřebných klimatických veličin. Chybějící dny / hodnoty zneplatní rok. Když minimum chybí, souhrnné skóre je null. Kvalita dostupných regionálních / částečných podkladů se konzervativně započte jako 60 % vah; nejde o statistický interval spolehlivosti.
5. AOPK se hodnotí samostatně jako omezení. Nalezená ochrana přírody může snížit slovní verdikt. Lesní / vodní / zastavěný druh pozemku se neoznačí jako běžně vhodný sad. Q100, právní přístup, pH, humus, škůdci a mikroklima zůstávají neověřené. Terénní a satelitní zdroje byly na přání odstraněné z podkladů, dotazů i distribuovaných dat.

Pro živé dotazy je limit plochy 100 ha a úhlopříčka bboxu 3 km; větší nebo rozptýlený výběr potřebuje rozdělení. Omezení chrání výkon i reprezentativnost jednoho regionálního bodu. JSON výsledky se cachují dle celé geometrie a verze modelu (nikoli názvu / obecního filtru), maximálně 30 výsledků na 7 dní v localStorage. Souběžně běží nejvýše dvě analýzy, odpověď zdroje má timeout, neúplné odpovědi a HTTP 429 se neobcházejí. Neúspěšný podklad se zobrazí jako chyba / chybějící data; tlačítkem lze požadavek opakovat.

Rozdělené a spojené pracovní plochy mají nové ID a plnou geometrii. Nekopírují se analytické hodnoty ani právní parcelní identifikace rodiče. Původ se ukládá samostatně a podklady se znovu přiřadí výsledné ploše. Dělení zachovává plochu a otvory; sjednocení odstraňuje překryvy. Vše je pracovní vymezení v aplikaci, nikoli změna katastru.

V novém rozhraní se rozdělení spouští na vybraném pozemku a provádí přímou dělicí čárou se dvěma konci. Před uložením se zobrazí skutečný geometrický náhled a výměry, následuje potvrzení nebo zrušení a dostupné vrácení rozdělení zpět. Uživatelské části mají samostatnou volbu ovocného druhu a trvalé uložení. Kreslení nové vlastní parcely a samostatné filtry kraje / obce jsou odstraněné.

Ověření: `npm run test:regional`, `npm run test:geometry`, `npm run data:verify`, `npm run build`. Prohlížečové testy ověřily živé CORS, reálnou zemědělskou parcelu, volbu druhu, přejmenování / mazání a persistenci; testy geometrií zahrnují otvory, multipolygony a zachování výměry.
