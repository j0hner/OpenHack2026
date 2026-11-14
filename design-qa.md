# Moje Sady – ověření rozhraní

final result: passed

Ověřeno 14. 11. 2026 v integrovaném prohlížeči Codexu. Finální produkční build: http://127.0.0.1:5181/; vývojový náhled: http://127.0.0.1:5180/. Větev `codex/moje-sady-redesign`, základ `origin/master` (`72a7080`).

## Vizuální podklady a srovnání

Zdroj: uživatelem přiložený `codex-clipboard-17487eff-4308-46c1-b2bb-5a7cbc51cf30.png`. Skutečný soubor má 925 × 520 px. Pro srovnání byl normalizován na 927 × 523 px; implementace je zachycena ve viewportu 927 × 523 CSS px při hustotě přibližně 1×. Rozdíl několika pixelů zdrojového ořezu není hodnocen jako odchylka.

Zdroj a implementace byly posouzeny SPOLEČNĚ v [celkovém srovnání](docs/qa/comparison.jpg) a ve [zvětšeném srovnání karty](docs/qa/card-comparison.jpg). Další finální důkazy: [desktop 1440 × 900](docs/qa/desktop-wide.jpg), [menší desktop](docs/qa/desktop-927.jpg), [mobil 390 × 844](docs/qa/mobile-390.jpg).

Záměrné rozdíly podle zadání: skutečné logo z PSD a nový název; skutečná mapa jiné uložené lokality; skutečný index 79/100 namísto ukázkových 81; žádný filtr kraje/obce; ovocný dropdown a důležité riziko místo fiktivních procent jednotlivých druhů. Pořadí druhů je ve Výsadbě. Širší karta a seznam umožňují čitelné skutečné podklady a práci s uživatelskými částmi. Nejde o pixelovou kopii ukázkových hodnot a ovladačů.

## Iterace a uzavřené nálezy

- P2: na menším desktopu byla část vybrané plochy pod kartou. Oprava: kamera počítá odsazení ze skutečné šířky karty. Finální snímek 927 × 523 ukazuje celou vybranou geometrii vedle karty.
- P2: v základním přehledu se při výšce 523 px a na mobilu poslední řádky rizika schovávaly pod patičkou. Oprava: kompaktnější mezery a dvě vedlejší akce v patičce; obě akce mají nejméně 40 px. Opakované snímky potvrzují celé hlavní riziko nad patičkou.
- P2: zavřený mobilní seznam zůstal v navigaci klávesnice a přístupnostním stromu. Oprava: `visibility: hidden` v zavřeném stavu; po otevření je opět dostupný.
- P2: mobilní mapa a zoom měly odsazení podle pevného odhadu. Oprava: kamera využívá skutečnou výšku spodního panelu, zoom je nad panelem. Finální mobilní snímek ukazuje celý vybraný polygon i oba zoom ovladače.

Po opravách byly pořízeny nové snímky a znovu porovnány. Žádné otevřené P0/P1/P2 v ověřovaných průchodech.

## Pět vizuálních oblastí

- Typografie: lokálně hostovaný Inter, stejné váhy a hierarchie v mapě i ostatních sekcích. Čitelný výrazný index, nadpis, ovoce a hlavní akce.
- Rozložení: tmavá navigace, světlý seznam, horní vyhledávání a skutečná dominantní mapa; zavíratelná karta na desktopu a spodní panel na mobilu. Bez horizontálního přetečení v ověřovaných rozměrech.
- Barvy: tmavě zelená navigace, bílé karty, světlé pozadí, zelené aktivní akce a obrys, rozlišené varovné a chybějící údaje.
- Obrazy: skutečné transparentní PNG logo exportované z dodaného PSD, bez překreslení. Mapa používá skutečné dlaždice a skutečné geometrie; reference není pozadím aplikace.
- Obsah: skutečná / demo data a modelové scénáře mají odlišné označení. Chybějící pokrytí nemá příznivé skóre. Index není nazýván pravděpodobností úspěchu.

## Funkční ověření

- Název a favicon v titulku i hlavním rozhraní; logo se neopakuje dalším totožným textem.
- RÚIAN našeptávání: Nová Ves s okresy, výběr šipkou a Enterem, posun mapy, vymazání, neexistující obec, načítání. V produkčním náhledu dočasně chybějící soubor vyvolal viditelnou chybu; po jeho obnovení tlačítko Zkusit znovu načetlo skutečné výsledky. Distribuovaný soubor byl obnoven.
- Seznam → mapa → karta; výběr skutečné parcely 2262/81 kliknutím do katastru; oficiální odkaz ČÚZK; přejmenování a smazání této testovací položky.
- Ovocný druh: jabloň 79 → hrušeň 74 u stejné ukázkové geometrie; související analýza i ekonomika používají zvolený druh.
- Dělení: neplatná krátká čára má chybu a zakázané potvrzení; Zrušit nezmění počet ploch. Platná čára vytvořila náhled 8,53 + 9,27 ha z 17,8 ha. Potvrzení vytvořilo samostatné části; jedna měla slivoň, druhá třešeň. Po reloadu zůstaly obě geometrie i různé druhy. Vrácení po reloadu odstranilo části a vybralo originál.
- Chybějící data: plocha A má Nedostatek dat / bez skóre, nikoli zelené příznivé číslo.
- Vizuálně zkontrolovány mapa, detail, detailní analýza, ekonomické scénáře, Data a Nastavení. Mobilní seznam se otevírá a po výběru zavírá; mapa zůstává použitelná.
- Samostatné filtry Kraj/Obec a režim kreslení nové vlastní parcely jsou odstraněné. Plus otevírá vyhledání existující katastrální parcely.

## Automatické kontroly

- TypeScript: prošel.
- Produkční Vite build: prošel; hlavní JS přibližně 333 kB, mapa 150 kB a geometrie 49 kB, bez upozornění na nadměrný chunk.
- `test:regional`: prošel prostorový model, nezávislost na názvech, chybějící data a rozdílné podmínky.
- `test:geometry`: prošla zachovaná plocha, neexistující překryv, otvory, multipolygony, skutečná parcela 1245719735, konečný segment, kořenové vazby po opakovaném dělení a spojení.
- `test:localities`: 6 254 záznamů, duplicity, diakritika, schéma, hash, HTTP/síť/JSON chyby, opakování a sdílená cache.
- `data:verify`: 6 538 parcel, pět výřezů, 100 ročních klimatických záznamů; přibalená data 6 346 094 B, v limitu 6,5 MB.
- Finální produkční náhled byl otevřen v prohlížeči; konzole bez chyb a varování po čistém načtení.

## Konkrétní omezení

Dělicí čára je přímý segment určený dvěma kliknutími mimo hranice; body lze přesouvat. Historie vrácení uchovává posledních deset rozdělení v tomto prohlížeči. Dělení a spojování jsou pouze plánovací geometrie. Živé API a mapy vyžadují připojení. Regionální index nenahrazuje půdní rozbor ani posouzení mikroklimatu. Ekonomika je modelový scénář. Nebylo provedeno nasazení ani sloučení do masteru; připravená je samostatná větev.
