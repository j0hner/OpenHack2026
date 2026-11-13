# Použitá otevřená data

Připraveno 13. 11. 2026. Data jsou v `sady-demo/public/data/`. Aplikace nepotřebuje backend; předzpracování běží lokálně v Node.js a výsledné JSON / GeoJSON soubory hostuje GitHub Pages. Souřadnice geometrií jsou WGS84 / EPSG:4326, mapové dlaždice EPSG:3857.

## Hlavní analytické zdroje

| Zdroj a licence | Co aplikace skutečně používá | Stažení a spojení |
| --- | --- | --- |
| [ČÚZK RÚIAN – parcely](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5), CC BY 4.0 | ID, parcelní číslo, kód k. ú., druh pozemku, evidovaná výměra, plná geometrie | REST `/5/query`, `f=geojson`, `inSR=4326`, `outSR=4326`, prostorový bbox. Stránkování po 500. Lokální výběr bodem v polygonu; jinde živý dotaz `esriSpatialRelIntersects`. Hledání katastru vrstvou `/7/query`. |
| [ČÚZK RÚIAN – BPEJ](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28), CC BY 4.0; agendový zdroj SPÚ | Skutečné kódy a hranice jednotek BPEJ | REST `/28/query`, GeoJSON, bbox. Podíl průnikem s polygonem parcely. Kódy se uchovávají jako řetězce; bez domýšlení pH nebo humusu. |
| [Copernicus / ECMWF ERA5-Land + ERA5 přes Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api), data CC BY 4.0 | 2005–2024: teplota, jarní mrazové dny (březen–květen, Tmin < 0 °C), letní dny (Tmax ≥ 25 °C), srážky a ET0 | `https://archive-api.open-meteo.com/v1/archive`, denní JSON agregovaný po letech. Teploty ERA5-Land ~9 km; srážky / ET0 ERA5 ~25 km. Souřadnice středu lokality, nikoli parcelní měření. Bezplatné API pouze nekomerčně; licence dat a podmínky API jsou odlišné. |
| [ČÚZK DMR 5G](https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer), CC BY 4.0 | Výška a orientační sklon lokality z pěti bodů; terénní podklad | REST `/identify`; `geometry` musí obsahovat `spatialReference: {wkid:4326}`. Výškové vzorky uprostřed a ±0,0007° délky / ±0,0005° šířky. Sklon z konečných diferencí, společný pro lokalitu. |
| [AOPK otevřená data](https://gis.nature.cz/arcgis/rest/services/Aplikace/Opendata/MapServer), CC BY 4.0 | Velkoplošná ZCHÚ (0), maloplošná ZCHÚ (2), EVL (6), ptačí oblasti (7) | REST `/{vrstva}/query`, GeoJSON a bbox. Průniky s parcelou. Nejde o úplné posouzení všech právních omezení ani všech ochranných pásem. |
| [ČSÚ ZEM03D – sklizeň ovoce](https://data.csu.gov.cz/opendata/sady/ZEM03D/distribuce/json), otevřená data ČSÚ dle metadat | Skutečná sklizeň v ČR 2021–2025 pro jablka, hrušky, švestky, třešně a meruňky | Stažení JSON-stat; indexování podle pojmenovaných dimenzí, nikoli pevných pozic. Ve výsledku jen pět druhů × pět let. V použitých buňkách chybí hektary, proto t/ha zůstává null. |
| [ČSÚ CEN0203B – ceny zemědělských výrobků](https://data.csu.gov.cz/opendata/sady/CEN0203B/distribuce/json), otevřená data ČSÚ dle metadat | Roční ceny výrobců 2021–2025, stejné druhy; u jablek konzumní jablka | JSON-stat, celá ČR, roční období. Kč/t děleno 1 000 na Kč/kg. Chybějící ceny nejsou nuly ani interpolace. Použití v ekonomice tlačítkem uživatele. |

ČÚZK uvádí otevřené produkty a licenci na [stránce otevřených dat](https://ags.cuzk.gov.cz/opendata/). AOPK uvádí CC BY 4.0 přímo v popisu služby. ČSÚ poskytuje [otevřené datové sady a metadata](https://data.csu.gov.cz/); licence konkrétního vydání je součástí podmínek / metadat poskytovatele. Data se distribuují s atribucí původního poskytovatele.

## Podklady a zachované zdroje

| Zdroj | Rozhraní / použití |
| --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL 1.0 | `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; Nominatim `/search` pro vyhledání na vyžádání. Dlaždice se nestahují hromadně. Dodržujte [pravidla dlaždic](https://operations.osmfoundation.org/policies/tiles/) a [Nominatim](https://operations.osmfoundation.org/policies/nominatim/). |
| [ČÚZK Ortofoto ČR](https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer), CC BY 4.0 | Letecké XYZ: `https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}`. OSM nemá vlastní letecký podklad. |
| [ESA WorldCover 2021 annual composite](https://esa-worldcover.org/en/data-access), CC BY 4.0 | RGB mozaika Sentinel-2, 10 m, rok 2021. `https://titiler.terrascope.be/wms`, WMS **1.3.0**, vrstva `esa-worldcover-s2rgbnir-10m-2021-v2_tcc`, povinné `TIME=2021-01-01`, `CRS=EPSG:3857`. Stejná rodina produktu dostupná v Copernicus Browseru; nejde o jeho soukromé instance ani živé snímky. Atribuce: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. |
| [ČÚZK DMR 5G](https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer), CC BY 4.0 | `https://ags.cuzk.gov.cz/arcgis2/services/dmr5g/ImageServer/WMSServer`, WMS 1.1.1, vrstva `dmr5g:GrayscaleHillshade`, styl `default`. |
| [ČÚZK katastrální mapa](https://wms.cuzk.gov.cz/), otevřená prostorová data ČÚZK | `https://services.cuzk.gov.cz/wms/local-km-wms.asp`, WMS 1.1.1, vrstva `KN`, transparentní PNG. Od přiblížení 14. Popup z RÚIAN REST; WMS samo nevrací analytickou geometrii. |
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain | Zachovaná lokální generalizovaná hranice ČR, měřítko 1:50m, záložní náhled při výpadku dlaždic. |
| [Eurostat GISCO NUTS 2021](https://ec.europa.eu/eurostat/web/gisco/geodata/statistical-units/territorial-units-statistics), podmínky GISCO / Eurostat | Zachované lokální hranice 14 krajů; zachována původní atribuce. Pouze výběr oblasti. |

## Co se nestahuje

- VÚV Q100: veřejná dostupnost REST sama nepotvrzuje otevřenou licenci. [Podmínky HEIS](https://heis.vuv.cz/data/spusteni/popisy/isvs_zapluz.asp) uvádějí souhlas s dalším šířením; Q100 se nedistribuuje a v aplikaci je neověřené.
- LPIS, měření ČHMÚ, InterSucho, aktuální dotační pravidla a síť právně zajištěných příjezdů nejsou napojené. Původní ilustrační vrstvy jsou označené jako demo. Úplná republika, celá historie denního počasí, velké rastry ani satelitní snímky se do repozitáře nekopírují.
- Pěstitelské profily, pH / humus pro demo, náklady, budoucí výnos t/ha a dotace jsou předpoklady, nikoli nově získaná otevřená data.

## Rozsah a výkon

Výřezy kolem středu pěti ukázkových lokalit: Bílany / Kroměříž, Staňkovice, Horní Maršov, Hustopeče a Třebíč. Každý bbox: ±0,006° délky a ±0,004° šířky; přesné souřadnice v `locations-index.json`. Bbox nemusí odpovídat hranici stejnojmenného katastru.

- 6 538 parcel; plné geometrie po lokalitách v `locations/*-parcels.json`.
- Analytické podklady v `locations/*.json`, přibližně 200 kB dohromady. Parcely + analytika přibližně 5,8 MB před gzip.
- BPEJ / AOPK jsou oříznuté na bbox. AOPK zjednodušena při získání o 0,00002°, parcelní geometrie nezjednodušená. Prostorová analýza se spustí jen pokud **celá plocha** leží ve výřezu, jinak se vrátí nedostatek podkladů.
- Analytické vrstvy se načítají až při zapnutí nebo otevření detailu. Parcelní soubor až při kliknutí v dané lokalitě. Výsledky fetchů se v rámci relace sdílejí.
- `manifest.json`: zdroje, licence, rozsah, velikosti a SHA-256 připravených souborů. `downloads.json` je pouze částečný protokol posledního obnoveného běhu původního stažení, nikoli kompletní audit všech odpovědí.

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

Stahování zapisuje mezivýsledky do ignorované `.data-cache/`, aby nebyly velké národní tabulky součástí webu. Již dokončené lokality při opakovaném spuštění přeskočí. Pro úplné nové stažení vyprázdněte cache nebo upravte seznam `areas` ve stahovacím skriptu. Limity API se neobcházejí: při HTTP 429 počkejte podle pravidel poskytovatele a pokračujte později. Příprava nemá být spouštěná při každém buildu / otevření stránky.

`data:package` parsuje JSON-stat, ořezává analytické geometrie, rozděluje parcely a generuje manifest. `data:rainfall` doplní srážky a ET0 z ERA5 (samotná ERA5-Land je v použitém API neposkytla) a aktualizuje také surovou cache. `data:verify` odmítne neúplné klima, vadné geometrie, duplicitní ID, neodpovídající hash nebo překročení datového rozpočtu.

## Prohlížeč, CORS a výpadky

Živé ČÚZK REST dotazy podle bodu i parcelního čísla / názvu katastru byly ověřené z Chrome přímo z originu aplikace; nejsou závislé na WFS ani proxy. Timeout a přerušení předchozího požadavku chrání před opožděnými výsledky. Nominatim funguje na explicitní hledání, bez automatického doplňování. Mapové WMS / XYZ se načítají jako obrázky a nečtou se z canvasu, takže nevyžadují CORS pro čtení pixelů. Úspěšný GetCapabilities ještě není důkazem funkčního GetMap; otestované byly i skutečné obrázky všech podkladů.

Analytické JSON jsou ze stejného originu jako aplikace, proto při prezentaci nevolají externí analytická API. Nejde o service worker offline cache: první načtení potřebuje dostupný hosting. V režimu bez připojení fungují pouze již dostupné soubory / cache prohlížeče, nikoli živé mapy a nové parcely mimo výřezy.
