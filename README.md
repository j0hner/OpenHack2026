# Moje Sady

Tabule: https://excalidraw.com/#room=1e201f6f911c13cabd8d,-7MJLrhy6w7bKVjpEsktng
Statická React / TypeScript aplikace pro plánování ovocného sadu z otevřených dat. Zdrojový projekt je v `sady-demo/`, připravený pro GitHub Pages bez serveru a tajných klíčů. Interaktivní mapa používá OpenStreetMap, letecké Ortofoto ČÚZK a volitelný katastrální překryv. Logo a favicon jsou transparentní PNG exportované z dodaného PSD.

## Spuštění

```sh
cd sady-demo
npm ci
npm run dev
npm run build
npm run preview
npm run data:verify
npm run test:regional
npm run test:regional-status
npm run test:regional-lifecycle
npm run test:theme
npm run test:geometry
npm run test:localities
```

Node.js 20.19+; pro stahovací skripty Node.js 22+. Produkční výstup je `sady-demo/dist/`, relativní `base: './'` funguje i v podadresáři GitHub Pages. Běžný build nepotřebuje obnovovat zdrojová data.

## Výběr a přidání pozemku

1. Vyhledejte obec horním našeptávačem. Pracuje lokálně se skutečnými 6 254 obcemi a městy RÚIAN, rozlišuje okresy a podporuje klávesnici.
2. Přibližte mapu alespoň na úroveň 14 a klikněte na katastrální parcelu. Zobrazí se pouze dočasný náhled s číslem, druhem, výměrou a oficiálním odkazem.
3. Teprve tlačítko **Přidat pozemek** uloží parcelu do vašeho seznamu. Zavření nebo jiný výběr nic neukládá. Vyhledání přes parcelní číslo také nejprve nabídne náhled.
4. V uloženém detailu zvolte ovoce; hodnocení a ekonomika používají stejnou volbu. Pozemky lze pojmenovat, odstranit, rozdělit čárou a spojovat.

Nově lze přidávat zemědělské druhy podle číselníku ČÚZK: orná půda, chmelnice, vinice, zahrada, ovocný sad a trvalý travní porost (kódy 2–8). Lesy, vodní a zastavěné plochy se nenabízejí. Ostatní plochy (14, včetně komunikací) a neurčené druhy aplikace konzervativně odmítá. Přípustný druh není potvrzením povolení výsadby ani dobrou půdní vlastností. Dříve uložené skutečné uživatelské parcely se při aktualizaci samovolně nemažou.

Aplikace začíná prázdným seznamem. Syntetické plochy, ilustrační vrstvy a přepínání do demo režimu jsou odstraněné; migrace vyřadí i staré pracovní části odvozené ze syntetických ploch. Skutečné uživatelské parcely, jejich názvy, ovoce a pracovní geometrie zůstávají zachované. Není přítomný režim kreslení nové vlastní parcely ani samostatné filtry kraje/obce.

## Dostupnost dat v mapě

Ve **Vrstvách** zapněte **Dostupnost dat**. Barvy vyjadřují dostatek podkladů pro regionální index, nikoli vhodnost pro výsadbu. Základními vstupy jsou půda BPEJ, klimatické teploty/mrazy a vláha (srážky/ET0). Minimem je 80 % platného pokrytí BPEJ a 15 úplných let všech potřebných klimatických veličin. Dosud neprověřená parcela zůstává označená jako neprověřená; není vydávána za parcelu bez dat.

Vrstva zpracovává omezený počet skutečných zemědělských parcel v aktuálním výřezu. V pěti připravených oblastech může použít skutečné lokální podklady, jinde se dostupnost upřesní z výsledku analýzy uloženého pozemku. Neprovádí hromadné dvacetileté klimatické požadavky pro každou parcelu v celé republice. Přesné limity a význam barev jsou uvedené v legendě a [dokumentaci dat](docs/OPEN_DATA.md).

## Připravená otevřená data

Pět regionálních výřezů obsahuje 6 538 skutečných parcel, BPEJ, klimatické agregace 2005–2024 a vybrané kategorie ochrany přírody. Celý distribuovaný balík včetně seznamu obcí a metadat má přibližně 6,35 MB; analytika bez parcel přibližně 200 kB. Načítání je dělené podle lokality a účelu.

Geografické podklady zůstávají skutečnými otevřenými daty i po odstranění demonstračních scénářů. Staré interní názvy souborů `locations/demo-*.json` jsou kompatibilní identifikátory výřezů; jejich obsah je stažená geografie a klimatická reanalýza, nikoli ilustrační modely. Zdroj, licence, velikost a SHA-256 jsou v `public/data/manifest.json` a [úplném seznamu zdrojů](docs/OPEN_DATA.md).

Mimo připravené výřezy se při analýze vybrané plochy BPEJ/AOPK dohledávají prostorově a klima podle souřadnic. ČSÚ poskytuje celostátní statistiky ovoce; referenční cenu lze výslovně převzít v ekonomice.

Stručná karta i detailní analýza používají stejný stav a výsledek. Rozlišují dosud neověřeno, načítání, chybu zdroje a potvrzený nedostatek podkladů. Po načtení BPEJ a klimatu se skóre zobrazí automaticky; pomalejší kontrola územních omezení AOPK se označí jako probíhající a následně výsledek doplní. Dostatek základních podkladů neznamená úplné agronomické a právní ověření ani 100% kvalitu dat.

## Pracovní geometrie a uložení

Rozdělení používá přímý segment určený dvěma body přes vybraný pozemek. Náhled ukáže skutečné části a výměry; změnu lze potvrdit, zrušit a vrátit. Části mají vlastní ovoce a kořenovou vazbu na původní parcelu. Spojení sjednocuje překryvy, oddělené plochy zachovává jako MultiPolygon. Originály zůstávají uložené; nejde o právní změnu katastru.

Názvy, parcely, pracovní geometrie, druhy ovoce a posledních deset rozdělení jsou uložené v localStorage tohoto prohlížeče. Výsledky prostorové analýzy se cachují podle geometrie, nejvýše 30 záznamů na 7 dní. Nová geometrie získává vlastní podklady, nikoli zkopírované hodnoty rodiče.

V Nastavení lze přepnout světlý a tmavý režim. Volba se ukládá samostatně do `moje-sady-theme`, zachovává uživatelské pozemky a při dalším načtení se použije před vykreslením rozhraní. Detailní analýza se zavírá křížkem, klávesou Escape nebo kliknutím na okolní plochu. Mapa nabízí vrstvy a návrat na celou ČR tlačítkem s jejím obrysem; krajské hranice a tlačítko celé obrazovky jsou odstraněné.

## Model a omezení

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
