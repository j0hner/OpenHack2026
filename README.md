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

- Čtyři podklady: OpenStreetMap, letecké Ortofoto ČÚZK, satelitní Sentinel-2 / ESA WorldCover 2021 přes Terrascope a stínovaný terén DMR 5G.
- Přepínač katastrální mapy ČÚZK. Přibližte alespoň na úroveň 14 a klikněte na parcelu: popup ukáže číslo, kód k. ú., druh, evidovanou výměru a odkaz do oficiálního katastru. Tlačítkem ji přidáte do analýzy.
- V režimu Vlastní pozemek lze hledat podle parcelního čísla a přesného názvu / šestimístného kódu katastru. Funguje i kreslení vlastní plochy a výběr více parcel.
- Skutečné geometrie zachovávají otvory a multipolygony. Výběr parcel, vlastní plocha a ekonomické vstupy se ukládají do localStorage; maximum je 50 uložených parcel.

## Připravená otevřená data

Výřezy kolem pěti ukázkových lokalit obsahují 6 538 skutečných parcel, BPEJ, dvacetileté klimatické agregace, výškové vzorky a vybrané kategorie ochrany přírody. Celkem přibližně 5,8 MB; analytické soubory bez parcel mají dohromady přibližně 200 kB. Geometrie parcel se načítají pouze při výběru v dané lokalitě, nikoli při otevření stránky. Mimo výřezy se parcela dohledává živě přes ČÚZK REST.

V detailu rozbalte **Skutečná otevřená data pro plochu**. Zobrazí skutečné prostorové průniky BPEJ a AOPK, klima lokality, orientační výšku a sklon a statistiky ČSÚ pro zvolený ovocný druh. Referenční cenu ČSÚ lze výslovně použít v ekonomice.

Úplný [seznam zdrojů, API, licencí a obnovovací postup](docs/OPEN_DATA.md) doplňuje strojový manifest `sady-demo/public/data/manifest.json` s velikostmi a kontrolními součty souborů.

## Model a omezení

Pět původních ukázkových scénářů používá označená demo data. Jejich skóre, pěstitelské profily a ekonomické předpoklady se nevydávají za výsledek nově stažených měření. Skutečné parcely nedostávají demo profil; bez půdního rozboru a dalších vstupů zobrazí **Nedostatek dat** a skutečné dostupné podklady samostatně.

Klima je reanalýza pro střed lokality, nikoli měření na parcele. Sklon je orientační z pěti výškových vzorků společných pro lokalitu. Ceny a sklizně ČSÚ jsou celostátní statistiky; chybějící t/ha zůstává neznámé. Dotace, náklady, budoucí výnos a péče jsou nastavitelné předpoklady. Q100 není připojeno, protože nebyla doložena otevřená distribuční licence VÚV. LPIS, suché a mrazové zóny a příjezdy jsou nadále zřetelně označené ilustrace.

Mapové podklady a živé API potřebují internet. Připravené soubory nejsou závislé na externích API, ale nejde o instalovatelnou offline aplikaci: při prvním načtení musí být dostupný hosting. Výpadky map mají viditelný chybový stav a záložní hranici ČR.

## Ověření

TypeScript a produkční build; `data:verify` ověřuje úplnost klimatu, platnost geometrií, unikátní parcely, rozpočet souborů, null hodnoty a SHA-256. V Chrome byl ověřen popup, přidání a obnovení parcely, živý REST / CORS, hledání podle názvu katastru, převzetí ceny ČSÚ i všechny mapové podklady.

## Todo

- [ ] Pridat datasety
- [ ] Výpočet sázecí vzdálenost
- [ ] Základní info o starání
- [ ] Regulace
- [ ] Půda/Lokalita
- [ ] Nadmořská výška
- [ ] Kolik bude starání se o stromy cca stát
- [ ] Kolik bude cca výnos (burza) možnosti nejhůř/nejlíp
- [ ] Různé stromy
- [ ]
- [ ] Přidávání pozemků do vlastnictví přes katastr
- [ ] Rozdělování na části
- [ ] Propojování pozemků
- [ ] Info o pozemku (základní info, odkaz na katastr)
- [ ] Info o vedlejších pozemcích pro případnou koupy
- [ ] Mapa a vrstvy
- [ ]
- [ ]
- [ ] Udelat dokumentaci
- [ ] Udelat prezetntaci
------------------------------------------
- [ ] Export
- [ ]
