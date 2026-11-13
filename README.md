# SADY

Statická React / TypeScript aplikace pro plánování ovocného sadu. Zdrojový projekt je v `sady-demo/`, připravený pro GitHub Pages bez serveru a tajných klíčů.

## Spuštění

```sh
cd sady-demo
npm ci
npm run dev
npm run build
npm run preview
npm run data:verify
```

Node.js 20.19+; pro stahovací skripty doporučen Node.js 22+. Produkční výstup je `sady-demo/dist/`, relativní `base: './'` funguje i v podadresáři GitHub Pages. Build ani prohlížení připravených dat nevyžaduje spuštění stahovacích skriptů.

## Mapy a skutečné parcely

- Dva podklady: OpenStreetMap a letecké Ortofoto ČÚZK. Katastrální mapa je samostatný průhledný překryv.
- Přepínač katastrální mapy ČÚZK. Přibližte alespoň na úroveň 14 a klikněte na parcelu: popup ukáže číslo, kód k. ú., druh, evidovanou výměru a odkaz do oficiálního katastru. Tlačítkem ji přidáte do analýzy.
- V režimu Skutečná data lze hledat podle parcelního čísla a přesného názvu / šestimístného kódu katastru. Funguje i kreslení vlastní plochy a výběr více parcel.
- Skutečné geometrie zachovávají otvory a multipolygony. Výběr parcel, vlastní plocha a ekonomické vstupy se ukládají do localStorage; maximum je 50 uložených parcel.

## Připravená otevřená data

Výřezy kolem pěti ukázkových lokalit obsahují 6 538 skutečných parcel, BPEJ, dvacetileté klimatické agregace a vybrané kategorie ochrany přírody. Celkem přibližně 5,8 MB; analytické soubory bez parcel mají dohromady přibližně 200 kB. Geometrie parcel se načítají pouze při výběru v dané lokalitě, nikoli při otevření stránky. Mimo výřezy se parcela i analytické podklady dohledávají živě podle souřadnic a geometrie.

V režimu **Skutečná data** otevřete v detailu **Podklady skutečně použité ve výpočtu**. Zobrazí skutečné prostorové průniky BPEJ a AOPK, klima lokality a statistiky ČSÚ pro zvolený ovocný druh. Referenční cenu ČSÚ lze výslovně použít v ekonomice.

Úplný [seznam zdrojů, API, licencí a obnovovací postup](docs/OPEN_DATA.md) doplňuje strojový manifest `sady-demo/public/data/manifest.json` s velikostmi a kontrolními součty souborů.

## Samostatné pracovní plochy

U každé karty lze změnit název nebo plochu smazat. Křížek ve výběru pouze odznačuje. Smazání uložené parcely nebo kresby se potvrdí v aplikaci; ukázky lze skrýt a obnovit resetem. Názvy, pracovní geometrie a skryté ukázky přežijí obnovení stránky.

V levém panelu **Dělení a spojování ploch** rozdělíte aktivní polygon do 2–8 svislých nebo vodorovných pásů (u dvou částí lze posunout hranici). Spojením 2–20 vybraných ploch vznikne jedna pracovní geometrie bez dvojího započtení překryvů; oddělené části tvoří MultiPolygon. Originály zůstávají uložené, nové plochy se vybírají, přejmenovávají, mažou a hodnotí samostatně podle nové geometrie. Katastrální hranice a vlastnictví se nemění. U rozsáhlých / rozptýlených geometrií se regionální index může odmítnout kvůli nedostatečné reprezentativnosti jednoho klimatického bodu.

## Model a omezení

Výchozí režim **Skutečná data** počítá regionální index i pořadí ovocných druhů z podkladů přiřazených konkrétní geometrii. Půda: plošné podíly BPEJ a orientační pravidla dle skupin HPJ (váha 35 %). Klima: teplota, jarní mrazové a letní dny (40 %). Vláha: srážky a ET0 (25 %). Je potřeba alespoň 80 % platného pokrytí BPEJ a 15 úplných klimatických let. Jinak je celkové skóre **Nedostatek dat**, dostupné kategorie zůstávají viditelné. Index není validovaná pravděpodobnost úspěchu ani předpověď výnosu. Původní označené scénáře jsou odděleně pod tlačítkem **Demo scénáře**.

Klima je reanalýza pro střed lokality, nikoli měření na parcele. Ceny a sklizně ČSÚ jsou celostátní statistiky; chybějící t/ha zůstává neznámé. Dotace, náklady, budoucí výnos a péče jsou nastavitelné předpoklady. Q100 není připojeno, protože nebyla doložena otevřená distribuční licence VÚV. LPIS, suché a mrazové zóny a příjezdy jsou nadále zřetelně označené ilustrace.

Mapové podklady a živé API potřebují internet. Připravené soubory nejsou závislé na externích API, ale nejde o instalovatelnou offline aplikaci: při prvním načtení musí být dostupný hosting. Výpadky map mají viditelný chybový stav a záložní hranici ČR.

## Ověření

TypeScript a produkční build; `test:regional` ověřuje prostorové přiřazení, klima, chybějící podklady a chyby API; `test:geometry` dělení a sjednocení geometrií; `data:verify` ověřuje úplnost klimatu, platnost geometrií, unikátní parcely, rozpočet souborů, null hodnoty a SHA-256. V Chrome byl ověřen popup, přidání a obnovení parcely, živý REST / CORS, hledání podle názvu katastru, převzetí ceny ČSÚ i všechny mapové podklady.

## Todo

- [ ] Pridat datasety
- [ ] Výpočet sázecí vzdálenost
- [ ] Základní info o starání
- [ ] Regulace
- [ ] Půda/Lokalita
- [ ] Nadmořská výška
- [ ] Kolik bude starání se o stromy cca stát
- [ ] Dotace
- [ ] Kolik bude cca výnos (burza) možnosti nejhůř/nejlíp
- [ ] Různé stromy
- [ ]
- [ ] Přidávání pozemků do vlastnictví přes katastr
- [ ] Rozdělování pozemků na části
- [ ] Propojování pozemků
- [ ] Info o pozemku (základní info, odkaz na katastr)
- [ ] Info o vedlejších pozemcích pro případnou koupy
- [ ] Jména pozemků
- [ ] Odstraňování parcel
- [ ] Mapa a vrstvy
- [ ] 
- [ ] Onboarding stránkou
- [ ] Vyndat z dema
- [ ]
- [ ] Local database
- [ ] Udelat dokumentaci
- [ ] Udelat prezetntaci
------------------------------------------
- [ ] Export
- [ ] Mapy sentinel 2
