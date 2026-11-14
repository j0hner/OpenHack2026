# Ověření filtrované mapy a automatické dostupnosti

Ověřeno 14. 11. 2026, větev `codex/parcel-map-filtering` z aktuálního `origin/master` (`7746d01`). Produkční Vite build, desktop 1440 × 900 a mobil 390 × 844. Výsledek: PASS.

## Funkční změny

- Rastrový překryv KN je nahrazen skutečnými vektorovými parcelami RÚIAN s povolenými zemědělskými druhy 2–8. Nevhodné druhy se nekreslí. Původní uživatelská data se nemažou; dříve uložené nevhodné katastrální parcely jsou v mapě skryté.
- Všechny výměry mají stejný minimální zoom 14 a stejné podmínky výřezu. Viditelnost neurčuje výměra. Zůstává bezpečnostní limit 200 parcel a 8 km úhlopříčky pohledu, přiznaný u přepínače.
- „Skrýt zahrady“ filtruje kód 5 před omezením počtu výsledků, v lokálních i živých datech. Volba se zachová po obnovení. V ověřeném pohledu Hustopečí se počet vykreslených parcel změnil ze 164 na 4; uložený seznam zůstal na jedné parcele.
- Uživatel upřesnil, že shodný zoom má platit pro nabízené katastrální parcely. Budoucí filtr „Pouze k pronájmu“ je viditelný a neaktivní s vysvětlením, že skutečný zdroj nabídek není připojený. Katastr se nevydává za nabídku pronájmu.
- Čtyři již používané kategorie AOPK jsou trvale v celostátním WMS překryvu. Přepínač je odstraněný. Ověřena nejen odpověď služby, ale i neprůhledné pixely pro ČR a Krkonoše. Mobilní zoom 6 používá obrázky 512 px; bližší pohled 256 px. V prohlížeči se v mobilním celostátním pohledu skutečně načítaly 512px obrázky.
- OSM i ortofoto mají masku okolních států ze stávajícího generalizovaného Natural Earth obrysu ČR a omezený posun. Návrat na ČR používá jeden řídicí pohyb, takže se mobilní přiblížení nepřepisuje konkurenční animací.
- Spojit lze jen výběr, jehož skutečné sjednocení je jeden Polygon. Řetěz sousedů a překryvy fungují; bodový dotyk, mezera a odpojený ostrov se odmítnou. Neplatná akce má zakázané tlačítko a viditelné vysvětlení. Testy skutečných parcel: 1641 + 1638 lze spojit, 1641 + 1647 nelze, k. ú. 649864.
- Zavírací ikony mají mírně výraznější pozadí, obrys a kontrast ve světlém i tmavém režimu. Mobilní filtr nezakrývá úvodní nápověda ani detail; po zavření filtru se detail vrátí. Bez horizontálního přetečení.
- Plovoucí legenda je odstraněná. Vysvětlení barev, průběh, počty, chyby a limity jsou v klávesnicí a dotykem ovladatelném rozbalení přímo u přepínače vrstvy.

## Automatická data a výkon

Ověření zobrazených parcel nevyžaduje jejich přidání. V připravených oblastech využívá skutečné výřezy, jinde společný BPEJ dotaz a sdílené buňky ERA5. Nejvýše dva klimatické požadavky současně, žádné hromadné parcelní AOPK požadavky. Přesun ruší zastaralou práci; dosavadní ověřené geometrie si zachovají vlastní barvu. Chyba poskytovatele není potvrzený nedostatek dat. Přesné ověřené vstupy může převzít pozdější detailní analýza, která doplní AOPK.

Živá kontrola ve Velkých Bílovicích automaticky obarvila 195 nepřidaných parcel. Uložený seznam zůstal na jedné parcele, mapa měla 195 vektorových polygonů, žádný KN raster ani plovoucí legendu. Rozhraní během kontroly reagovalo, konečná konzole byla bez chyb a varování.

První verze při živé kontrole odhalila zpomalení: BPEJ vracelo celé jednotky s 21 679 vrcholy a jejich vzdálené části se protínaly opakovaně. Jednorázový přesný ořez na úplný společný rozsah parcel zkrátil měření na stejných 176 parcelách z 43,5 s na 2,65 s a konečný heap z 224 MB na 54 MB. Stavy i procenta pokrytí zůstaly shodné, maximální rozdíl 0. Nejde o zjednodušení geometrie. Práce uvolňuje hlavní vlákno po časovém rozpočtu a průběžné publikování je omezené přibližně na 100 ms. Časy jsou jedno konkrétní měření, nikoli garance odezvy poskytovatelů.

## Kontroly

PASS: TypeScript, produkční build bez varování o nadměrném chunku, `test:automatic-coverage`, `test:coverage` (46 skutečných geometrií), `test:geometry`, `test:regional-lifecycle`, `test:regional-status`, `test:map-preferences`, migrace a kontrola otevřených dat. Nová regrese ověřuje přesný lokální průnik i otvor půdního polygonu s více než 10 000 vrcholy, bez nestabilního časového limitu.

Použity stejné otevřené zdroje; datový balík zůstává 6 346 094 B. Nové jsou efektivnější dotazy a trvalé mapové zobrazení již používaných kategorií AOPK. Maska ČR je generalizovaná a neurčuje právní státní hranici.

- [Živá dostupnost a vysvětlení ve filtru](automatic-coverage-live.jpg)
- [Mobilní filtr](parcel-filters-mobile.jpg)
- [OpenStreetMap omezená na ČR](czechia-osm-filtered.jpg)
