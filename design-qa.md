# Moje Sady – ověření skutečných parcel a dostupnosti dat

final result: passed

Ověřeno 14. 11. 2026. Větev `codex/real-parcels-data-coverage` vychází z `origin/master` (`c5e934f`, sloučený redesign Moje Sady). Produkční build je otevřený v integrovaném prohlížeči na http://127.0.0.1:5181/. Nasazení dál používá statický Vite výstup s relativním base pro GitHub Pages.

## Výsledek

- Kliknutí na novou parcelu zobrazí dočasný náhled. Uloží ji až **Přidat pozemek**; zrušení a Escape nic neukládají. Ruční hledání používá stejný potvrzovací krok.
- Nabízejí se zemědělské druhy RÚIAN 2–8. Lesní, vodní, zastavěné, ostatní a neurčené druhy jsou z nových výběrů vyloučené. Stará skutečná uživatelská data se samovolně nemažou. Katastrální WMS může nadále ukazovat oficiální hranice všech parcel.
- Aplikace začíná bez syntetických ploch; demo režim, ilustrativní mapové vrstvy a starý syntetický skórovací modul jsou odstraněné. Migrační logika vyřadí staré vzorové plochy a odvozené části, zachová skutečné uživatelské geometrie, názvy a ovoce.
- Vrstva Dostupnost dat barví skutečné parcely podle dostatku podkladů pro regionální index. Stav není vhodnost pro sad. Zelená vyžaduje nejméně 80 % hodnotitelné BPEJ a 15 úplných let klimatických veličin. Šedá je dosud neověřeno, ne potvrzená absence dat.

## Prohlížečové ověření

Kontrola proběhla na vývojovém i finálním produkčním výstupu, desktop 1440 × 900 a mobil 390 × 844 CSS px.

1. Starý stav s demonstračními plochami po načtení otevřel prázdný seznam; skutečné nové přidání přežilo reload.
2. Skutečná zastavěná parcela 2262/81, k. ú. 649864, byla odmítnutá viditelným vysvětlením. Počet uložených pozemků zůstal nulový.
3. Skutečná zahrada 1641, k. ú. 649864, ID 1245682735, se po ručním nalezení otevřela jen v náhledu. Přidání nastalo až po stisku tlačítka. Následovalo skutečné regionální hodnocení z připraveného BPEJ a klimatu.
4. Kliknutí na sousední zahradu 1647, ID 1245689735, v barevné mapě otevřelo dočasný náhled, zatímco seznam stále obsahoval jen jednu parcelu. Zrušení ji nepřidalo. Náhled ukazuje oficiální odkaz, evidovanou i geometrickou výměru a dostupnost podkladů.
5. Změna ovoce jabloň → hrušeň přepočítala vhodnost skutečné parcely 79 → 75. Dostupnost podkladů zůstala nezávislá na zvoleném ovoci.
6. Po reloadu zůstala parcela, hrušeň i zapnutá vrstva. Detail se otevírá až volbou pozemku; nepřidává další kopii.
7. Vrstva zobrazila 164 skutečných zemědělských parcel (152 s minimálními podklady, 12 neověřených). Po oddálení správně omezila výřez na 200 parcel (151 s minimálními podklady, 49 neověřených) a viditelně uvedla omezení výřezu.
8. V celostátním pohledu vrstva požaduje přiblížení; během pohybu čeká na ustálení a přerušuje staré požadavky. Výběr nového náhledu ani přesun mapy nevytváří automatické uložené pozemky.
9. Mobilní legenda se s detailem sbalí na přibližně 60 px a jde tlačítkem rozbalit. Náhled má stále viditelná tlačítka Přidat / Zrušit; roluje jen obsah. Bez horizontálního přetečení.
10. Finální produkční konzole byla bez chyb a varování. Geometrické operace a vyhledávání obcí dále prošly svými regresními testy.

## Uzavřené problémy nalezené při kontrole

- Mobilní legenda původně zabírala 165 px nad spodním panelem a zakrývala mapu. Nyní má sbalitelný přehled s počty a plný obsah na vyžádání.
- Dlouhý mobilní náhled s podklady původně odsouval potvrzení pod navigaci. Nyní jde o flex panel s pevnou hlavičkou a patičkou; tlačítka leží přibližně v y=709–763, nad spodní navigací od y=780.
- Dlouhé hover tooltipy přesahovaly mapu. Desktop má zalomení a limit šířky; mobil používá údaje v dotykově ovladatelném náhledu.
- Přerušení mapového pohybu se již krátce nevydává za nedostatečné přiblížení; legenda uvádí čekání na ustálení.
- Výpadek připraveného souboru má živý geometrický fallback; chyby API nejsou označené za potvrzenou absenci podkladů.

## Důkazy

- [Desktop – barevná dostupnost, skutečná parcela a limit 200](docs/qa/coverage-desktop.jpg)
- [Mobil – sbalená legenda a skutečný detail](docs/qa/coverage-mobile.jpg)
- [Mobil – dočasný náhled a viditelné potvrzení](docs/qa/preview-mobile.jpg)
- [Desktop – dočasný náhled před přidáním](docs/qa/parcel-preview.jpg)

Starší snímky `desktop-wide`, `desktop-927`, `comparison`, `card-comparison` a `mobile-390` dokumentují předchozí redesign a neprokazují aktuální funkční stav.

## Automatické kontroly

- TypeScript a produkční Vite build: PASS. Hlavní JS přibližně 320 kB, mapa 150 kB, geometrie 49 kB; bez upozornění na nadměrný chunk.
- `test:parcels`: PASS – povolené kódy 2–8, blokované lesy/voda/budovy/ostatní včetně silnic, neznámý druh, stejný filtr cache i živých odpovědí a přerušení.
- `test:coverage`: PASS – 46 skutečných parcel proti regionálnímu skórování, prahy 80 % / 15 let, chybné/staré geometrické klíče, unknown vs API error, nepodporovaná geometrie, lokální výpadek a živý fallback, přerušení, maximálně 200 polygonů, žádné hromadné ERA5/BPEJ/AOPK volání.
- `test:migration`: PASS – staré syntetické kořeny, rekurzivní i chybějící předci, smíšené vazby, zachování skutečných parcel, uživatelských kreseb, názvů, ovoce a historie; opakování migrace nemění výsledek.
- `test:regional`: PASS – skutečné parcely v pěti geografických výřezech, nezávislé přiřazení podle geometrie, skutečný půdní průnik, chybějící data, klima a výpadky zdrojů. Syntetické demonstrační plochy už test neimportuje.
- `test:geometry`, `test:localities`, `data:verify`: PASS. Distribuovaná data mají 6 346 094 B a nepřekračují limit 6,5 MB; 6 538 skutečných parcel a 6 254 obcí.
- `git diff --check`: PASS.

## Konkrétní omezení

Vrstva pracuje od zoomu 14, do 8 km úhlopříčky pohledu a s nejvýše 200 parcelami. Zelená znamená minimum pro základní regionální index, nikoli úplné agronomické a právní podklady. Mimo připravené skutečné výřezy zůstává dostupnost šedá, než se daná přidaná parcela analyzuje. Ostatní plochy jsou vyřazené konzervativně i tehdy, kdy by konkrétní část po právním prověření mohla být využitelná. Skutečné open-data soubory s historickými interními ID demo-* jsou zachované; jejich obsah není demonstrační. Ekonomické předpoklady jsou stále výslovně označené plánovací scénáře.
