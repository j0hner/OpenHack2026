# Moje Sady

Statická React / TypeScript aplikace pro plánování ovocného sadu. Zdrojový projekt zůstává v `sady-demo/`, připravený pro GitHub Pages bez serveru a tajných klíčů. Moje Sady používají tmavě zelenou boční navigaci, světlý seznam pozemků a skutečnou interaktivní mapu. Logo i favicon jsou transparentní PNG exportované z dodaného zdrojového PSD.

## Spuštění

```sh
cd sady-demo
npm ci
npm run dev
npm run build
npm run preview
npm run data:verify
npm run test:localities
```

Node.js 20.19+; pro stahovací skripty doporučen Node.js 22+. Produkční výstup je `sady-demo/dist/`, relativní `base: './'` funguje i v podadresáři GitHub Pages. Build ani prohlížení připravených dat nevyžaduje spuštění stahovacích skriptů.

## Mapy a skutečné parcely

- Dva podklady: OpenStreetMap a letecké Ortofoto ČÚZK. Katastrální mapa je samostatný průhledný překryv.
- Přepínač katastrální mapy ČÚZK. Přibližte alespoň na úroveň 14 a klikněte na parcelu: uloží se do seznamu a otevře plovoucí kartu s označením, lokalitou, výměrou, ovocným druhem a výsledkem. Odkaz do oficiálního katastru je dostupný v detailu; není nutný další krok „Přidat parcelu“.
- Horní našeptávač hledá ve všech 6 254 skutečných obcích a městech ČR. Podporuje vyhledávání bez diakritiky, rozlišení okresy, šipky, Enter, Escape, vymazání a stavy načítání / chyby. Vybraná obec přiblíží mapu na své území. Při psaní se nevolá Nominatim ani jiný externí geokodér. Samostatné filtry kraje a obce jsou odstraněné.
- Výběr položky v seznamu a výběr v mapě jsou propojené. Detail se otevře až po výběru v zavíratelné plovoucí kartě; na mobilu jako spodní panel. Označený dropdown **Ovocný druh** ovládá hodnocení, výsadbu a související ekonomický scénář. Jednotlivé uživatelské části mohou mít vlastní druh.
- Skutečné geometrie zachovávají otvory a multipolygony. Výběr parcel, názvy, uživatelské části, zvolené ovoce a ekonomické vstupy se ukládají do localStorage. Kreslení nové vlastní parcely je odstraněné; kreslí se pouze dělicí čára vybraného pozemku.

## Připravená otevřená data

Výřezy kolem pěti ukázkových lokalit obsahují 6 538 skutečných parcel, BPEJ, dvacetileté klimatické agregace a vybrané kategorie ochrany přírody. Parcely a analytika mají přibližně 5,8 MB; celý adresář otevřených dat včetně seznamu obcí a metadat přibližně 6,35 MB. Analytické soubory bez parcel mají dohromady přibližně 200 kB. Geometrie parcel se načítají pouze při výběru v dané lokalitě, nikoli při otevření stránky. Mimo výřezy se parcela i analytické podklady dohledávají živě podle souřadnic a geometrie.

V režimu **Skutečná data** otevřete detailní analýzu a záložku **Data**. Zobrazí skutečné prostorové průniky BPEJ a AOPK, klima lokality a statistiky ČSÚ pro zvolený ovocný druh. Referenční cenu ČSÚ lze výslovně použít v ekonomice. Samostatný seznam obcí má přibližně 565 kB a načítá se až při použití vyhledávání.

Úplný [seznam zdrojů, API, licencí a obnovovací postup](docs/OPEN_DATA.md) doplňuje strojový manifest `sady-demo/public/data/manifest.json` s velikostmi a kontrolními součty souborů.

## Samostatné pracovní plochy

U uloženého pozemku lze změnit název nebo jej smazat. Odznačení je oddělené od smazání. Ukázky lze skrýt a obnovit resetem. Názvy, pracovní geometrie, volby ovoce a skryté ukázky přežijí obnovení stránky.

Akce **Rozdělit pozemek** pracuje s již vybranou geometrií. Uživatel zakreslí přímou dělicí čáru přes pozemek, zkontroluje náhled a výměry částí a rozdělení potvrdí nebo zruší. Čára musí polygon skutečně rozdělit; chybný, příliš krátký nebo tečný řez má srozumitelnou chybu. Potvrzené rozdělení lze vrátit zpět. Části si uchovávají vazbu na původní plochu, dostanou vlastní ID a lze je samostatně vybírat, pojmenovat, smazat a přiřadit jim ovocný druh.

Spojením vybraných ploch vznikne jedna pracovní geometrie bez dvojího započtení překryvů; oddělené části tvoří MultiPolygon. Originály zůstávají uložené. Nové plochy se hodnotí podle vlastní geometrie, nikoli zkopírovanými hodnotami rodiče. Katastrální hranice a vlastnictví se nemění. U rozsáhlých / rozptýlených geometrií se regionální index může odmítnout kvůli nedostatečné reprezentativnosti jednoho klimatického bodu.

## Model a omezení

Výchozí režim **Skutečná otevřená data** počítá regionální index i pořadí ovocných druhů z podkladů přiřazených konkrétní geometrii. Půda: plošné podíly BPEJ a orientační pravidla dle skupin HPJ (váha 35 %). Klima: teplota, jarní mrazové a letní dny (40 %). Vláha: srážky a ET0 (25 %). Je potřeba alespoň 80 % platného pokrytí BPEJ a 15 úplných klimatických let. Jinak je celkové skóre **Nedostatek dat**, dostupné kategorie zůstávají viditelné. Index není validovaná pravděpodobnost úspěchu ani předpověď výnosu. Původní označené scénáře lze zvolit v **Nastavení → Režim hodnocení → Označené demo scénáře**.

Klima je reanalýza pro střed lokality, nikoli měření na parcele. Ceny a sklizně ČSÚ jsou celostátní statistiky; chybějící t/ha zůstává neznámé. Dotace, náklady, budoucí výnos a péče jsou nastavitelné předpoklady. Q100 není připojeno, protože nebyla doložena otevřená distribuční licence VÚV. LPIS, suché a mrazové zóny a příjezdy jsou nadále zřetelně označené ilustrace.

Mapové podklady a živé API potřebují internet. Připravené soubory nejsou závislé na externích API, ale nejde o instalovatelnou offline aplikaci: při prvním načtení musí být dostupný hosting. Výpadky map mají viditelný chybový stav a záložní hranici ČR.

## Ověření

TypeScript a produkční build; `test:regional` ověřuje prostorové přiřazení, klima, chybějící podklady a chyby API; `test:geometry` dělení a sjednocení geometrií; `test:localities` úplnost seznamu obcí, vyhledávání, rozlišení shodných názvů a obnovení načítání po chybě; `data:verify` úplnost klimatu, platnost geometrií, unikátní parcely, datový rozpočet, null hodnoty a SHA-256. Vizuální a interakční kontrola aktuálního rozhraní používá integrovaný prohlížeč Codex: mapu, plovoucí detail, výběr ovoce, dělicí čáru a mobilní rozložení.

## Todo

- [X] Pridat datasety
- [ ] Ideální rozložení stromů
- [ ] Základní info o starání
- [ ] Regulace
- [X] Půda/Lokalita
- [ ] Nadmořská výška
- [ ] Kolik bude starání se o stromy cca stát
- [ ] Dotace
- [ ] Kolik bude cca výnos (burza) možnosti nejhůř/nejlíp
- [X] Různé stromy
- [ ]
- [X] Přidávání pozemků do vlastnictví přes katastr
- [ ] Rozdělování pozemků na části
- [x] Propojování pozemků
- [ ] Info o pozemku (základní info, odkaz na katastr)
- [ ] Info o vedlejších pozemcích pro případnou koupy
- [x] Jména pozemků
- [ ] Odstraňování parcel
- [X] Mapa a vrstvy
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
