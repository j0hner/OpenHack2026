# Použitá otevřená data

Připraveno 13. 11. 2026. Data jsou v `sady-demo/public/data/`. Aplikace nepotřebuje backend; předzpracování běží lokálně v Node.js a výsledné JSON / GeoJSON soubory hostuje GitHub Pages. Souřadnice geometrií jsou WGS84 / EPSG:4326, mapové dlaždice EPSG:3857.

Rozhraní Moje Sady navíc používá aktuální přibalený seznam **6 254 obcí a měst ČR** pro horní našeptávač. Jde o RÚIAN ČÚZK (vrstva 12, bez vojenských újezdů), s názvy okresů z vrstvy 15. Soubor `municipalities.json` má 564 869 B; při psaní se prohledává lokálně a nevolá externí geokodér. Podrobnosti, schéma, dotazy, datum stažení a SHA-256 jsou v `municipalities-metadata.json`. Souřadnice pro navigaci jsou středem bboxu generalizovaného polygonu obce, nikoli definicí parcely. Výběr použije bbox celého území obce.

## Hlavní analytické zdroje

| Zdroj a licence | Co aplikace skutečně používá | Stažení a spojení |
| --- | --- | --- |
| [ČÚZK RÚIAN – parcely](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5), CC BY 4.0 | ID, parcelní číslo, kód k. ú., druh pozemku, evidovaná výměra, plná geometrie | REST `/5/query`, `f=geojson`, `inSR=4326`, `outSR=4326`, prostorový bbox. Stránkování po 500. Lokální výběr bodem v polygonu; jinde živý dotaz `esriSpatialRelIntersects`. Hledání katastru vrstvou `/7/query`. |
| [ČÚZK RÚIAN – BPEJ](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/28), CC BY 4.0; agendový zdroj SPÚ | Skutečné kódy a hranice jednotek BPEJ | REST `/28/query`, GeoJSON, bbox. Podíl průnikem s polygonem parcely. Kódy se uchovávají jako řetězce; bez domýšlení pH nebo humusu. |
| [Copernicus / ECMWF ERA5-Land + ERA5 přes Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api), data CC BY 4.0 | 2005–2024: teplota, jarní mrazové dny (březen–květen, Tmin < 0 °C), letní dny (Tmax ≥ 25 °C), srážky a ET0 | `https://archive-api.open-meteo.com/v1/archive`, denní JSON agregovaný po letech. Teploty ERA5-Land ~9 km; srážky / ET0 ERA5 ~25 km. Souřadnice středu lokality, nikoli parcelní měření. Bezplatné API pouze nekomerčně; licence dat a podmínky API jsou odlišné. |
| [ČSÚ ZEM03D – sklizeň ovoce](https://data.csu.gov.cz/opendata/sady/ZEM03D/distribuce/json), otevřená data ČSÚ dle metadat | Skutečná sklizeň v ČR 2021–2025 pro jablka, hrušky, švestky, třešně a meruňky | Stažení JSON-stat; indexování podle pojmenovaných dimenzí, nikoli pevných pozic. Ve výsledku jen pět druhů × pět let. V použitých buňkách chybí hektary, proto t/ha zůstává null. |
| [ČSÚ CEN0203B – ceny zemědělských výrobků](https://data.csu.gov.cz/opendata/sady/CEN0203B/distribuce/json), otevřená data ČSÚ dle metadat | Roční ceny výrobců 2021–2025, stejné druhy; u jablek konzumní jablka | JSON-stat, celá ČR, roční období. Kč/t děleno 1 000 na Kč/kg. Chybějící ceny nejsou nuly ani interpolace. Použití v ekonomice tlačítkem uživatele. |

ČÚZK uvádí otevřené produkty a licenci na [stránce otevřených dat](https://ags.cuzk.gov.cz/opendata/). ČSÚ poskytuje [otevřené datové sady a metadata](https://data.csu.gov.cz/); licence konkrétního vydání je součástí podmínek / metadat poskytovatele. Data se distribuují s atribucí původního poskytovatele.

## Podklady a zachované zdroje

| Zdroj | Rozhraní / použití |
| --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL 1.0 | `https://tile.openstreetmap.org/{z}/{x}/{y}.png`; online podklad. Dlaždice se nestahují hromadně. Dodržujte [pravidla dlaždic](https://operations.osmfoundation.org/policies/tiles/). Vyhledávání obcí zajišťuje přibalený RÚIAN. |
| [ČÚZK RÚIAN – obce a města](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/12), CC BY 4.0 | Našeptávání celého seznamu obcí a měst; okresy z [vrstvy 15](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/15). REST JSON po 500 záznamech, stabilní řazení dle kódu, ověření počtu a jedinečnosti. Do webu se ukládají pouze názvy, okres, souřadnice, status a bbox, nikoli plné polygony. |
| [ČÚZK Ortofoto ČR](https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer), CC BY 4.0 | Letecké XYZ: `https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}`. OSM nemá vlastní letecký podklad. |
| [ČÚZK RÚIAN – vektorové parcely](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5), CC BY 4.0 | Filtrovaný REST GeoJSON od zoomu 14, nejvýše 200 parcel v pohledu do 8 km. Druhy 2–8, volitelně bez zahrad (5). Rastrový překryv KN se nepoužívá, protože v něm nelze skrýt nevhodné druhy parcel. |
| [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain | Zachovaná lokální generalizovaná hranice ČR, měřítko 1:50m: obrys, ikona návratu a maska okolních zemí pro oba podklady. Maska neslouží k právnímu určení státní hranice. |

## Co se nestahuje

- VÚV Q100: veřejná dostupnost REST sama nepotvrzuje otevřenou licenci. [Podmínky HEIS](https://heis.vuv.cz/data/spusteni/popisy/isvs_zapluz.asp) uvádějí souhlas s dalším šířením; Q100 se nedistribuuje a v aplikaci je neověřené.
- LPIS, měření ČHMÚ, InterSucho, aktuální dotační pravidla a síť právně zajištěných příjezdů nejsou napojené. Ilustrační vrstvy jsou odstraněné. Úplná republika, celá historie denního počasí, velké rastry ani satelitní snímky se do repozitáře nekopírují.
- Pěstitelské požadavky, náklady, budoucí výnos t/ha a dotace jsou upravitelné předpoklady, nikoli měřená otevřená data. pH a humus zůstávají neznámé.

## Rozsah a výkon

Skutečné regionální výřezy kolem pěti lokalit: Bílany / Kroměříž, Staňkovice, Horní Maršov, Hustopeče a Třebíč. Každý bbox: ±0,006° délky a ±0,004° šířky; přesné souřadnice v `locations-index.json`. Bbox nemusí odpovídat hranici stejnojmenného katastru.

- 6 538 parcel; plné geometrie po lokalitách v `locations/*-parcels.json`.
- Analytické podklady v `locations/*.json`, přibližně 200 kB dohromady. Parcely + analytika přibližně 5,8 MB před gzip.
- Celý adresář distribuovaných otevřených dat včetně seznamu 6 254 obcí a metadat má přibližně 6,35 MB před gzip. Načítání je rozdělené podle účelu a lokality.
- BPEJ je oříznutá na bbox, parcelní geometrie nezjednodušená. Připravený výřez se použije, jen když **celá plocha** leží uvnitř. Jinde se BPEJ dotazuje bboxem a ořízne skutečným polygonem; klima se načítá pro bod uvnitř polygonu. Nikdy se nepřiřazuje profil jiné parcely podle názvu obce.
- Analytické vrstvy se načítají až při zapnutí nebo otevření detailu. Parcelní soubor až při výběru v dané lokalitě nebo zapnutí vrstvy dostupnosti dat. Výsledky fetchů se v rámci relace sdílejí.
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

Živé ČÚZK REST dotazy podle bodu i parcelního čísla / názvu katastru, BPEJ a Open-Meteo ERA5 byly ověřené přímo z originu aplikace; nejsou závislé na WFS ani proxy. Aktuální rozhraní se kontroluje v integrovaném prohlížeči. Timeout a přerušení předchozího požadavku chrání před opožděnými výsledky. Horní našeptávač používá místní seznam RÚIAN. Mapové XYZ se načítají jako obrázky a nečtou se z canvasu, takže nevyžadují CORS pro čtení pixelů.

Analytické JSON jsou ze stejného originu jako aplikace, proto při prezentaci nevolají externí analytická API. Nejde o service worker offline cache: první načtení potřebuje dostupný hosting. V režimu bez připojení fungují pouze již dostupné soubory / cache prohlížeče, nikoli živé mapy a nové parcely mimo výřezy.

## Regionální index zapojený do aplikace

Aplikace používá pouze skutečné geografické podklady a stejný regionální index v detailu, doporučení druhů i porovnání. Syntetické demonstrační plochy, ilustrační vrstvy a přepínač demo režimu jsou odstraněné. Ekonomické a agronomické předpoklady zůstávají výslovně označené. Změna názvu pozemku ani přesun mapy na jinou obec nesmí změnit zdroje ani skóre původní geometrie.

1. BPEJ se řeže polygonem (včetně otvorů / multipolygonů), podíly jsou vážené plochou. HPJ je druhá a třetí číslice pětimístného kódu. Skupiny půd odpovídají [popisu VÚMOP](https://mapy.vumop.cz/vrstvy.php); číselné indexy jsou transparentní heuristika Moje Sady, nikoli oficiální body BPEJ nebo měřená chemie. Hodnoty pro HPJ 01–08 / 09–13 / 14–17 / 18–20 / 21–23 / 24–33 / 34–36 / 37–39 / 40–41 / 42–54 / 55–59 / 60–63 / 64–78 / 79–81 / 82–89 jsou 90 / 85 / 80 / 65 / 50 / 70 / 45 / 20 / 30 / 40 / 65 / 60 / 20 / 60 / 35. Kódy neodvozují pH, humus ani skutečnou hloubku.
2. Klima: průměrná teplota, jarní mrazové dny a letní dny se porovnávají s explicitně modelovými požadavky zvoleného ovocného druhu. Živé dotazy používají ERA5 ~25 km pro období 2005–2024; připravené výřezy mají teploty ERA5-Land ~9 km a srážky / ET0 ERA5 ~25 km. Detail ukazuje skutečné souřadnice gridů a jejich vztah k bodu uvnitř plochy. Nejbližší grid není mikroklima parcely.
3. Vláha: srážky vůči nároku druhu a deficit P−ET0. Nejde o měření půdní vláhy ani výpočet potřebné závlahy. Souhrnné skóre má váhy půda 35 %, klima 40 %, vláha 25 %. Převody na body, požadavky druhů i váhy jsou orientační předpoklady.
4. Minimum: platná BPEJ na alespoň 80 % plochy, bez nejednoznačných překryvů, a nejméně 15 úplných let všech potřebných klimatických veličin. Chybějící dny / hodnoty zneplatní rok. Když minimum chybí, souhrnné skóre je null. Kvalita dostupných regionálních / částečných podkladů se konzervativně započte jako 60 % vah; nejde o statistický interval spolehlivosti.
5. Nové lesní / vodní / zastavěné parcely se nenabízejí k přidání. Konzervativně jsou vyřazené i ostatní plochy (včetně komunikací) a neurčený druh pozemku. Q100, právní podmínky, přístup, pH, humus, škůdci a mikroklima zůstávají neověřené. Ochrana přírody, terénní a satelitní zdroje nejsou součástí aktuálních dat ani dotazů. Vhodnost nepotvrzuje právní možnost výsadby.

Pro živé dotazy je limit plochy 100 ha a úhlopříčka bboxu 3 km; větší nebo rozptýlený výběr potřebuje rozdělení. Omezení chrání výkon i reprezentativnost jednoho regionálního bodu. JSON výsledky se cachují dle celé geometrie a verze modelu (nikoli názvu / obecního filtru), maximálně 30 výsledků na 7 dní v localStorage. Souběžně běží nejvýše dvě analýzy, odpověď zdroje má timeout, neúplné odpovědi a HTTP 429 se neobcházejí. Neúspěšný podklad se zobrazí jako chyba / chybějící data; tlačítkem lze požadavek opakovat.

Rozdělené a spojené pracovní plochy mají nové ID a plnou geometrii. Nekopírují se analytické hodnoty ani právní parcelní identifikace rodiče. Původ se ukládá samostatně a podklady se znovu přiřadí výsledné ploše. Dělení zachovává plochu a otvory; sjednocení odstraňuje překryvy. Vše je pracovní vymezení v aplikaci, nikoli změna katastru.

V novém rozhraní se rozdělení spouští na vybraném pozemku a provádí přímou dělicí čárou se dvěma konci. Před uložením se zobrazí skutečný geometrický náhled a výměry, následuje potvrzení nebo zrušení a dostupné vrácení rozdělení zpět. Uživatelské části mají samostatnou volbu ovocného druhu a trvalé uložení. Kreslení nové vlastní parcely a samostatné filtry kraje / obce jsou odstraněné.

Ověření: `npm run test:regional`, `npm run test:geometry`, `npm run data:verify`, `npm run build`. Prohlížečové testy ověřily živé CORS, reálnou zemědělskou parcelu, volbu druhu, přejmenování / mazání a persistenci; testy geometrií zahrnují otvory, multipolygony a zachování výměry.

## Výběr parcely bez automatického uložení

Kliknutí na existující parcelu otevře dočasný náhled s údaji ČÚZK a odkazem na oficiální katastr. Uložení provede teprve explicitní tlačítko Přidat pozemek. Do té doby se nemění uložené parcely ani localStorage. Stejná kontrola druhu pozemku platí při vyhledání parcelního čísla.

Kódy druhu pozemku se čtou z RÚIAN, nikoli z barvy mapy: povolené zemědělské druhy 2, 3, 4, 5, 6, 7 a 8; vyloučené jsou lesy 10, voda 11, zastavěné plochy 13 a ostatní plochy 14. Kód 8 je rovněž trvalý travní porost v publikované doméně RÚIAN. Neznámá hodnota není automaticky povolená. Vyloučení ostatních ploch je záměrně konzervativní, protože připravené výřezy neobsahují úplné podrobné způsoby využití; živé RÚIAN může dodat doplňující údaj. Povolená kategorie nedokládá právní možnost převodu na sad.

Skutečné připravené soubory s historickými interními ID `demo-a` až `demo-e` zůstávají otevřenými daty jednotlivých oblastí. Neobsahují odstraněné syntetické uživatelské plochy. Migrace starého stavu odstraní syntetické plochy a jejich potomky, zachová skutečné uživatelské parcely a jejich pracovní části.

## Vrstva Dostupnost dat

Vrstva barví skutečné zemědělské parcely v aktuálním pohledu, včetně dosud nepřidaných parcel. Nejde o vrstvu vhodnosti sadu. Tooltip a dočasný náhled ukazují podíl BPEJ, počet úplných klimatických let z 20 a počet povinných kategorií z 3 (půda, klima, vláha). Ochrana přírody a právní omezení se neposuzují touto barvou.

- Zelená: všechny 3 povinné kategorie mají minimální podklady, stejná podmínka jako souhrnný regionální index.
- Okrová: prověřené podklady nestačí nebo geometrie přesahuje limit modelu.
- Šedá s přerušovanou hranicí: dosud neověřeno, nikoli potvrzená absence dat.
- Modrá: probíhá analýza přesné geometrie.
- Růžová: ověření selhalo; výpadek API není prohlášen za chybějící podklad.

Povolené přiblížení je 14+, úhlopříčka pohledu nejvýše 8 km a počet zobrazených parcel nejvýše 200, bez podmínky podle výměry. Dosažení limitu je přiznané u přepínače vrstvy; další přiblížení poskytne úplnější výřez. Po pohybu mapy se čeká 450 ms a starší požadavky se přerušují. Geometrie se čtou ze skutečných připravených parcel nebo omezeného RÚIAN dotazu podle bboxu. Vypnutí barev zastaví ověřování, filtrované parcelní hranice mohou zůstat zapnuté zvlášť. Zahrady se vylučují před omezením počtu výsledků.

Barvy se ověřují automaticky i u nepřidaných parcel. Připravený regionální výřez musí obsahovat celý polygon. Mimo něj se BPEJ stahuje společně pro úplné geometrie viditelných parcel (stránky po 500, limit 2 000 jednotek), potom se počítají skutečné plošné průniky. ERA5 2005–2024 se sdílí podle skutečných buněk 0,25°, nejvýše dva klimatické požadavky současně; úspěšné buňky se cachují a výpadky mají krátkou ochrannou prodlevu. Průběžné výsledky mění barvy a mohou předat přesné vstupy detailní analýze. Ověření nepřidává pozemky do uživatelského seznamu.

## Audit potřebnosti a odstranění ochrany přírody

Ochrana přírody/AOPK je od 14. 11. 2026 odstraněná jako funkce i dataset: mapová služba, analytické dotazy, čtyři ochranné vrstvy v každém z pěti výřezů a zdrojové záznamy. Staré analytické cache geo-1/geo-2 se zruší, nové výsledky používají geo-3; uživatelské parcely se nemažou. Číselný index BPEJ/klima/vláha se nemění. Dřívější opatrnější slovní verdikt vyvolaný pouze ochranou přírody může zmizet.

Ponechané soubory mají konkrétní použití: pět skutečných parcelních kolekcí pro rychlý výběr a mapu, pět výřezů BPEJ/klimatu pro okamžité prostorové výpočty, `municipalities.json` pro hledání, `economics.json` pro referenci ČSÚ, index a metadata pro načítání, původ a kontrolní součty. Obrys Natural Earth slouží masce ČR a ikoně, OSM a ortofoto podkladům. Další nepoužívaná distribuovaná datová sada nebyla nalezena.

Ověřované datové soubory mají nově **6 340 092 B** místo 6 346 094 B. Celý `public/data` včetně upravených metadat/protokolu se zmenšil o **9 662 B**. Odstraněn byl i zastaralý kontrolní skript KN a nepotřebné lokální testovací obrázky.

Nové užitečné zdroje jsou prověřené odděleně v [návrhu doplnění dat](DATA_CANDIDATES.md); nejsou zapojené do současného modelu ani vydávané za dostupné parcelní měření.

## Ruční vstupy a původ hodnot

Uložený pozemek může mít vlastní reprezentativní HPJ, průměr teploty, srážek, ET0, jarních mrazových dnů a letních dnů. Platné zadané pole má přednost, prázdné pole není nula. Původní otevřená data zůstávají dostupná a reset je obnoví jako vstup výpočtu. Scénář uvádí původ `open-data`, `mixed` nebo `manual`; ruční průměry se nepřevádějí na smyšlenou řadu patnácti let. Pro kombinaci s ručními údaji musí mít každý nepřepsaný klimatický indikátor nejméně 15 skutečných ročních hodnot z období 2005–2024.

Tyto údaje jsou uživatelský vstup v localStorage, nikoli nový otevřený dataset. Ručně ovlivněné kategorie mají konzervativní faktor kvality 40 %, ostatní regionální kategorie 60 %. Barva Dostupnosti dat zůstává výhradně podle skutečných otevřených podkladů. Nové části/spojení automaticky nepřebírají ruční hodnoty jiné geometrie. Výpočet zůstává orientační vhodností; pH, humus, hloubka ani předpověď výnosu z něj nevznikají.

Chybějící podklad nyní doprovází přímá výzva k doplnění. Formulář upřednostní neznámé hodnoty, přizná původ každého vstupu a poskytne stručné vysvětlení jednotek. Probíhající načítání se za potvrzenou mezeru nepovažuje.

## Odborný podklad rozmístění stromů

Nový plánovač používá stávající otevřenou geometrii parcel a malý soubor nastavitelných profilů rozestupů podle [MENDELU](https://web2.mendelu.cz/af_291_projekty/files/10/skripta/index.php?I=8&J=0&K=0&N=4). Tento podklad je označený jako odborná reference/modelové nastavení, nikoli jako měřené otevřené údaje. Odborný text se nestahuje do datového balíku, jeho licence se nezaměňuje s CC BY prostorových zdrojů. Rozmístění je odvozený návrh v geometrii, ne nový dataset poloh existujících stromů. Podrobnosti jsou v [PLANTING.md](PLANTING.md).

Barva neoznačuje 60% konzervativní kvalitu regionálního modelu jako procento dostupnosti. Zelené 3/3 nenahrazuje půdní rozbor, pH, humus, mikroklima, záplavy ani právní posouzení. Cache výřezu: nejvýše 12 výsledků na 2 minuty v paměti, průniky nejvýše 1200 geometrií. Barva existující analýzy se použije pouze při shodě klíče celé geometrie.
