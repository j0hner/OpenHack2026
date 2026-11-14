# Plán výsadby a následné úpravy rozhraní

Ověřeno 14. 11. 2026 na větvi `codex/orchard-planting`. Výsledek: **PASS**. Geometrie i údaje pro browserové testy jsou skutečné; ručně vložené hodnoty jsou výslovně testovací uživatelský scénář. Testovací origin :5182 je oddělený od uživatelského náhledu :5181.

## Výsadba

- Skutečná parcela **1641**, k. ú. **649864**: výchozí jabloň 4 × 1,5 m, odsazení 3 m, rezervy konců řad 4 m. Automatika umístila **100 stromů do 4 úseků řad**, směr **113°**. Ruční směr 0° dal **45 stromů**, návrat k automatice opět 100. Hrušeň 4 × 2,5 m měla **60 stromů**; přepínání druhů obnovilo jejich vlastní plány.
- Prázdný rozestup byl odmítnut, uložený plán zůstal 100. Rezerva na koncích řad 50 m dala platný **prázdný plán** s jasným vysvětlením; ekonomika měla 0 stromů a nulové tržby z ovoce. Po vrácení rezervy se výsledek obnovil.
- Obnovení stránky zachovalo nastavení/souhrn a Worker rekonstruoval body. Export GeoJSON skutečně obsahoval 100 Point prvků, 4 LineString řady, hranici a zdrojová/modelová metadata.
- Rozdělení parcely přímou čárou vytvořilo části přibližně 0,05 a 0,06 ha. Původní body se nezobrazily v novém ID. Samostatný plán první části měl **24 jabloní**, druhá část **26 hrušní**. Sousedící části šly spojit; nová plocha opět nezačala cizím počtem. Pro hrušeň vyšla na 60, pro jabloň na **100 stromů**. Vnitřní dělicí hranice neomezuje spojený plán.
- Počet 100 se promítl do ekonomiky: sazenice a výsadba **27 000 Kč**, celková investice **67 679 Kč** v testovacím scénáři. Výnos t/ha zůstal jasně popsaný samostatný předpoklad. Zvolená kategorie používá stejný počet z geometrického plánu.
- Stromy a řady jsou vykreslené na skutečné interaktivní mapě přes Canvas. Přepínač zobrazení je skryje/obnoví. Texty překrývajících se zdrojových ploch při zobrazené výsadbě nezakrývají body; hranice, hover a výběr zůstávají funkční.

## Doplnění údajů a zjednodušení ovládání

- Skutečná parcela **2039/2**, k. ú. **674834**, ID 1697239708: připravený výřez vrací BPEJ 0 %, 20 úplných klimatických let, bez chyby zdroje. Výsledek byl **Nedostatek dat**, nikoli příznivý odhad. Výrazná výzva otevřela formulář a zaměřila právě HPJ. Pouze tento údaj byl zvýrazněný, dalších pět dostupných vstupů v podrobnostech mělo přiznaný původ.
- Testovací ruční HPJ 6 změnila hodnocení na **81**, výslovně jako smíšený uživatelský scénář. Reset obnovil nedostatek podkladů. Chybějící údaj se nikdy nepřevedl na nulu. Obyčejný odkaz na úpravu dostupných vstupů také otevřel formulář.
- V ekonomice jsou dvě nezávislé sbalené karty: **Scénář vašeho pozemku** se vstupy a **Modelový výsledek pro jabloň** s výsledky. Otevření první nezobrazilo výsledky; otevření druhé nepovolilo viditelné vstupní pole první. Duplicitní nadpis výsledku uvnitř byl odstraněný.
- Kategorie zabírají v seznamu jediný sbalený řádek. Rozbalení zpřístupní filtr, správu i hromadné přiřazení; zavření zachová členství.
- Přehled Pozemky začíná sbaleným **Filtrem**. Zvolená hrušeň dala 1 z 5 pozemků. Po sbalení zůstalo viditelné „Aktivní filtry: 1“ i reset; reset obnovil 5/5.
- Smazání jednotlivé testovací parcely 114/1 proběhlo okamžitě, počet 5 → 4; žádné tlačítko potvrzení nebylo vykreslené. Implementace odstraňuje potvrzování i pro hromadné mazání a kategorie.
- Odstranění kategorie Jižní sad proběhlo přímo bez dalšího potvrzení. Závěrečné hromadné odstranění pěti testovacích ploch dalo okamžitě 0 pozemků, také bez potvrzení. Obnovení stránky zachovalo prázdný stav; nevzkřísilo plány ani pracovní části. Uživatelský náhled :5181 zachoval obě původní parcely a zůstal otevřený v nové Výsadbě bez použití nových plánů na uživatelské údaje.
- Parcelní SVG mají potlačený pouze obdélníkový nativní focus outline. Kliknutí/Enter ponechává zelenou skutečnou hranici; Enter otevřel detail a klávesnicový `:focus-visible` měl tvarové zvýraznění, `outline: none`, roli button a tabindex 0. Fokus mapových tlačítek zůstává.
- Ověřeno na desktopu a mobilu **390 × 844**, v obou tématech. Mobilní dokument měl šířku přesně 390 px bez horizontálního přetečení; body, řady, souhrn i akce zůstaly použitelné.
- Výzva k doplnění byla na mobilu po prvním výběru viditelná bez posunu: tlačítko y 668,68–708,68 při hranicích posuvného obsahu y 448,89–715,33. Kliknutí otevřelo správné pole; text měl správný tvar „1 údaj k doplnění“. Dočasná změna velikosti prohlížeče je vrácená, testovací tab/server zavřený.

## Automatické kontroly

PASS: `test-planting-geometry`, `test-planting-profiles`, `test-planting-economics`, `test-planting-persistence`, `test-manual-inputs`, `test-parcel-categories`, `test-parcel-overview`, `test-regional-status`, `test-geometry-operations`, `test-no-demo`, `test-automatic-coverage`, ověření otevřených dat, TypeScript a produkční build. Preference mapy byly ověřené také po úpravě SVG fokusu.

Geometrické testy samostatně kontrolují vnitřek polygonu, díry, mezery, všechny odstupy a segmenty řad, minimální spon, natočení, determinismus, skutečné rozdělení/spojení i složitostní limity. Při limitu se nevrací zavádějící částečný počet. Persistence odmítla 18 neplatných/zastaralých případů a ukládá malé souhrny bez souřadnic všech stromů. Bez plánu zůstalo původní hodnocení skutečné parcely 79.

Otevřená datová sada se nezměnila: 6 538 parcel a ověřované soubory 6 340 092 B. Finální hlavní JS 385,29 kB (gzip 125,93), Worker 10,44 kB; build bez varování o velkém chunku. Výpočet běží mimo hlavní vlákno a cache drží nejvýše pět plánů. Osm profilů je malá odborná reference MENDELU s označením modelového předpokladu; nedochází k novému masivnímu stahování dat. Podrobnosti a limity jsou v [dokumentaci výsadby](../PLANTING.md).

Snímky: [výsadba desktop](planting-desktop.jpg), [výsadba mobil](planting-mobile-dark.jpg), [samostatná část](planting-split.jpg), [výzva k doplnění](missing-data-callout.jpg), [potřebný vstup](missing-data-guided.jpg), [oddělená ekonomika](scenarios-separated.jpg), [sbalený filtr](filters-collapsed.jpg).
