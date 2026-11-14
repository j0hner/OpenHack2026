# Moje Sady

Tabule: https://excalidraw.com/#room=1e201f6f911c13cabd8d,-7MJLrhy6w7bKVjpEsktng

Statická React / TypeScript aplikace pro plánování ovocného sadu z otevřených dat. Zdrojový projekt je v kořeni repozitáře, připravený pro GitHub Pages bez serveru a tajných klíčů. Interaktivní mapa používá OpenStreetMap, letecké Ortofoto ČÚZK a filtrované vektorové parcely RÚIAN. Oba podklady jsou omezené na ČR. Logo a favicon jsou transparentní PNG exportované z dodaného PSD.

## Spuštění

```sh
npm ci
npm run dev
npm run build
npm run preview
npm run data:verify
npm test
npm run test:sqlite
npm run test:regional
npm run test:regional-status
npm run test:regional-lifecycle
npm run test:theme
npm run test:automatic-coverage
npm run test:map-preferences
npm run test:categories
npm run test:geometry
npm run test:localities
```

Použijte Node.js 24+. Produkční výstup je `dist/`, relativní `base: './'` funguje i v podadresáři GitHub Pages. Běžný build nepotřebuje obnovovat zdrojová data. Jediný instalační lockfile je `package-lock.json`; `node_modules` se neverzuje.

`npm test` spustí všechny aplikační testy v Node.js. `npm run test:sqlite` ověřuje SQLite i hlavní rozhraní přes Playwright; před prvním spuštěním nainstalujte prohlížeč příkazem `npx playwright install chromium`.

## Struktura a nasazení

- `src/`, `public/`, `scripts/` a `index.html` jsou přímo v kořeni. Hlavní vstup aplikace je `src/main.tsx`.
- `.github/workflows/deploy.yml` při změně `master` ověří testy, data a build a nasadí pouze `dist/` na GitHub Pages. Nastavení Pages používá zdroj **GitHub Actions**. Pull requesty procházejí kontrolami bez nasazení.
- Nezávislá SQLite datová vrstva je v `src/data/`, její rozhraní v `src/data/index.ts`. Zachovává OPFS úložiště, importy a export databáze. Současné parcely, kategorie, ruční vstupy a výsadbové plány nadále používají původní localStorage; nepřepisují se do staršího bodového schématu. [Rozsah vrstvy a omezení](docs/data-integration.md).
- `npm run build:sqlite-qa` vytvoří oddělený `dist-sqlite-qa/` pro ověření SQLite Workeru a WASM. Stránka `/tests/harness.html` obsahuje ovládání testů. Tento výstup se na veřejný web nenasazuje a SQLite nezvětšuje hlavní mapový bundle.
- Starý samostatný SQLite prototyp je archivovaný v `research/sqlite-prototype/`; není hlavním vstupem ani součástí produkčního výstupu.

## Výběr a přidání pozemku

1. Vyhledejte obec horním našeptávačem. Pracuje lokálně se skutečnými 6 254 obcemi a městy RÚIAN, rozlišuje okresy a podporuje klávesnici.
2. Přibližte mapu alespoň na úroveň 14 a klikněte na katastrální parcelu. Zobrazí se pouze dočasný náhled s číslem, druhem, výměrou a oficiálním odkazem.
3. Teprve tlačítko **Přidat pozemek** uloží parcelu do vašeho seznamu. Zavření nebo jiný výběr nic neukládá. Vyhledání přes parcelní číslo také nejprve nabídne náhled.
4. V uloženém detailu zvolte ovoce; hodnocení a ekonomika používají stejnou volbu. Pozemky lze pojmenovat, odstranit, rozdělit čárou a spojovat.

Nově lze přidávat zemědělské druhy podle číselníku ČÚZK: orná půda, chmelnice, vinice, zahrada, ovocný sad a trvalý travní porost (kódy 2–8). Lesy, vodní a zastavěné plochy se nenabízejí. Ostatní plochy (14, včetně komunikací) a neurčené druhy aplikace konzervativně odmítá. Přípustný druh není potvrzením povolení výsadby ani dobrou půdní vlastností. Dříve uložené skutečné uživatelské parcely se při aktualizaci samovolně nemažou.

Aplikace začíná prázdným seznamem. Syntetické plochy, ilustrační vrstvy a přepínání do demo režimu jsou odstraněné; migrace vyřadí i staré pracovní části odvozené ze syntetických ploch. Skutečné uživatelské parcely, jejich názvy, ovoce a pracovní geometrie zůstávají zachované. Není přítomný režim kreslení nové vlastní parcely ani samostatné filtry kraje/obce.

## Dostupnost dat v mapě

**Dostupnost dat** je ve výchozím nastavení zapnutá. Po přiblížení se viditelné parcely ověřují automaticky bez přidávání do seznamu. Barvy vyjadřují dostatek podkladů pro regionální index, nikoli vhodnost pro výsadbu. Minimem je 80 % platného hodnotitelného pokrytí BPEJ a 15 úplných let teplot, mrazů, srážek a ET0. Vysvětlení barev, průběh a počty jsou u přepínače ve **Vrstvách**; samostatná plovoucí legenda mapu nezakrývá.

Vrstva zpracovává nejvýše 200 zemědělských parcel od zoomu 14 v pohledu do 8 km úhlopříčky, bez prahu podle výměry. V připravených oblastech využije skutečné místní podklady; jinde sdílí dotaz BPEJ pro celý výřez a klimatické požadavky podle buněk ERA5, nejvýše dva současně. Přesun mapy přeruší zastaralé požadavky. Chyba zdroje má vlastní stav a neznamená potvrzený nedostatek dat. Ověřené podklady lze využít i při následném přidání parcely.

Katastrální hranice se kreslí z filtrovaných polygonů, takže lesy, voda, zastavěné a ostatní plochy nevytvářejí katastrální překryv. Ve Vrstvách lze skrýt zahrady; preference se zachová. Volba **Pouze k pronájmu** je neaktivní, dokud nebude připojen skutečný zdroj nabídek; katastrální parcela sama o sobě není nabídkou pronájmu.

## Připravená otevřená data

Pět regionálních výřezů obsahuje 6 538 skutečných parcel, BPEJ a klimatické agregace 2005–2024. Distribuované ověřované datové soubory mají 6 340 092 B. Načítání je dělené podle lokality a účelu. AOPK a ochrana přírody byly na přání odstraněné z rozhraní, analytiky, síťových dotazů i datových výřezů; právní podmínky výsadby aplikace nepotvrzuje.

Geografické podklady zůstávají skutečnými otevřenými daty i po odstranění demonstračních scénářů. Staré interní názvy souborů `locations/demo-*.json` jsou kompatibilní identifikátory výřezů; jejich obsah je stažená geografie a klimatická reanalýza, nikoli ilustrační modely. Zdroj, licence, velikost a SHA-256 jsou v `public/data/manifest.json` a [úplném seznamu zdrojů](docs/OPEN_DATA.md).

Mimo připravené výřezy se při analýze vybrané plochy BPEJ dohledává prostorově a klima podle souřadnic. ČSÚ poskytuje celostátní statistiky ovoce; referenční cenu lze výslovně převzít v ekonomice.

Stručná karta i detailní analýza používají stejný stav a výsledek. Rozlišují dosud neověřeno, načítání, chybu zdroje a potvrzený nedostatek podkladů. Po načtení BPEJ a klimatu se skóre zobrazí automaticky. Dostatek základních podkladů neznamená úplné agronomické a právní ověření ani 100% kvalitu dat.

## Pracovní geometrie a uložení

Rozdělení používá přímý segment určený dvěma body přes vybraný pozemek. Náhled ukáže skutečné části a výměry; změnu lze potvrdit, zrušit a vrátit. Části mají vlastní ovoce a kořenovou vazbu na původní parcelu. Spojit lze pouze sousedící pozemky, které po sjednocení tvoří jeden souvislý Polygon; samotný dotyk v bodě ani mezera nestačí. Řetěz sousedících částí funguje. Originály zůstávají uložené; nejde o právní změnu katastru.

Názvy, parcely, pracovní geometrie, druhy ovoce a posledních deset rozdělení jsou uložené v localStorage tohoto prohlížeče. Výsledky prostorové analýzy se cachují podle geometrie, nejvýše 30 záznamů na 7 dní. Nová geometrie získává vlastní podklady, nikoli zkopírované hodnoty rodiče.

Světlý a tmavý režim se přepíná tlačítkem slunce/měsíce v hlavičce; samostatná obrazovka Nastavení je odstraněná. Volba se ukládá do `moje-sady-theme`. Detailní analýza se zavírá křížkem, klávesou Escape nebo kliknutím na okolní plochu. Posuvný obsah má odsazení od rámu a datové vysvětlivky se otevírají bez posunu štítků.

## Kategorie a společné scénáře

Volitelné kategorie jsou v seznamu schované v jediném rozbalení **Kategorie**. Uvnitř lze vytvářet, přejmenovávat, mazat, filtrovat a hromadně přiřazovat kategorie; jednotlivé přiřazení je také v nabídce pozemku. Filtr kategorií nemění uložené geometrie. Vedle vlastního názvu se nenápadně zachová skutečné parcelní číslo.

Obrazovka **Scénáře** sčítá investice, tržby, náklady, stromy a peněžní toky celé zvolené kategorie podle ovocného druhu a vstupů jednotlivých pozemků. Návratnost se vypočte ze společného toku. Překryv rodiče a jeho částí souhrn zablokuje. Při rozdělení se členství převede na části; vrácení obnoví původní kategorii. Spojení parcel ze stejné kategorie převede členství na novou plochu, původní parcely zůstanou uložené.

**Odstranit vybrané** funguje i pro nesousedící pozemky a maže přímo bez potvrzovacího kroku. Stejně funguje jednotlivé mazání a odstranění kategorie. Odstranění pozemků vyčistí související výběr, přiřazení, plán výsadby a neplatnou historii dělení, aniž smaže samotnou kategorii. Kategorie i členství se ukládají v localStorage.

## Rozmístění stromů

V záložce **Výsadba** lze navrhnout skutečné polohy stromů a řady podle hranic pozemku, sponu a odstupů. Osm profilů pro pět druhů vychází z odborného podkladu MENDELU. Výpočet na pozadí porovná směry/posuny řad, vynechá otvory a provozní rezervy a zobrazí výsledek na mapě; podporuje vlastní spon, ruční orientaci a GeoJSON export. Rozdělené i spojené plochy dostávají vlastní výpočet, bez kopírování bodů rodiče.

Platný počet stromů používá i ekonomika pro sazenice a náklady na strom. Výnos t/ha zůstává uživatelský předpoklad; geometrie jej nepotvrzuje. Nastavení a souhrn se ukládají, body se po obnovení rekonstruují. Podrobnosti, zdroj, výkonnostní limity a omezení jsou v [dokumentaci výsadby](docs/PLANTING.md).

Prověřené návrhy dalšího doplnění dat a způsob jejich napojení jsou v [přehledu DMR 5G, historie ČHMÚ a ALADIN](docs/DATA_CANDIDATES.md); zatím nejsou přidané do modelu.

## Model a omezení

V detailu pozemku na kartě **Data** (v analýze **Data a nejistoty**) lze doplnit nebo přepsat vstupy vhodnosti: reprezentativní HPJ, průměrnou roční teplotu, srážky, ET0, jarní mrazové dny a letní dny. Při potvrzeném nedostatku podkladů nebo chybě zdroje vede výrazné tlačítko rovnou do otevřeného formuláře na první potřebné pole. Chybějící hodnoty jsou nahoře zvýrazněné, dostupné mají přiznaný původ a jsou při doplňování schované v podrobnostech. Prázdné pole používá dostupný otevřený podklad; prázdno nikdy neznamená nulu. Ruční hodnoty vytvářejí označený uživatelský scénář a lze je odstranit pro návrat k otevřeným datům. Nezvyšují dostupnost otevřených dat na mapě a nejsou doplněnou historickou řadou. Platí pro konkrétní uloženou geometrii; nově rozdělené či spojené plochy je automaticky nepřebírají.

Analýzy po otevření navigací čekají na výběr pozemku. Změna pozemku v této obrazovce zachová otevřenou analýzu; výběr jinde otevře mapu. V přehledu Pozemky lze řadit vzestupně i sestupně a kombinovat ovocný druh, výměru, vhodnost a hledání. Ovladače jsou schované pod **Filtr**, aktivní podmínky a reset zůstávají dostupné i po sbalení. Nehodnocené pozemky nemají nulové skóre. **Scénář vašeho pozemku** obsahuje samostatně rozbalitelné vstupy; **Modelový výsledek pro daný ovocný druh** odděleně výsledky a grafy. Vysvětlivka na stránce Scénáře popisuje význam variant.

Skutečná vstupní data se kombinují s explicitními orientačními pěstitelskými pravidly: půda 35 %, klima 40 %, vláha 25 %. Skóre není validovaná pravděpodobnost úspěchu ani předpověď výnosu. Chybějící povinné podklady znamenají **Nedostatek dat**, nikoli příznivý výsledek. Klima patří regionálnímu gridu; pH, humus, mikroklima, Q100 a právní přístup nejsou ověřené.

Ekonomika nadále používá uživatelem upravitelné předpoklady pro náklady, budoucí výnos a potenciální podporu. To jsou plánovací scénáře, nikoli demonstrační parcely nebo měřená otevřená data. Závlaha bez doložených podkladů automaticky nenavyšuje výnos. Živé API a mapy potřebují internet; první načtení vyžaduje dostupný hosting.

## Ověření

TypeScript a produkční build, testy regionálního skórování na skutečných parcelách, geometrie včetně otvorů/multipolygonů a kořenových vazeb, našeptávače a chyb API, dostupnosti dat, klasifikace pozemků a migrace starého stavu. Kontrola dat ověřuje geometrii, úplnost časových řad, SHA-256 a datový rozpočet. Vizuální a funkční výsledky jsou popsané v [ověřovacím protokolu](design-qa.md).

## Todo

- [X] Pridat datasety
- [ ] Ideální rozložení stromů
- [?] Regulace
- [X] Půda/Lokalita
- [X] Nadmořská výška
- [X] Kolik bude starání se o stromy cca stát
- [ ] Dotace
- [X] Kolik bude cca výnos (burza) možnosti nejhůř/nejlíp
- [X] Různé stromy
- [ ]
- [X] Přidávání pozemků do vlastnictví přes katastr
- [X] Rozdělování pozemků na části
- [x] Propojování pozemků
- [X] Info o pozemku (základní info, odkaz na katastr)
- [X] Info o vedlejších pozemcích pro případnou koupy
- [x] Jména pozemků
- [X] Odstraňování parcel
- [X] Mapa a vrstvy
- [ ] 
- [X] Onboarding stránkou
- [X] Vyndat z dema
- [ ]
- [ ] Local database
- [ ] Udelat dokumentaci
- [ ] Udelat prezetntaci
------------------------------------------
- [ ] Export
- [ ] Mapy sentinel 2
