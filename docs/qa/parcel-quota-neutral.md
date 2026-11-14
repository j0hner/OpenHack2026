# Zachování ověření a neutrální čekání na klima

Ověřeno 14. 11. 2026 na větvi `codex/fix-parcel-verification`. Nahrazuje chování kvóty popsané v předchozím `parcel-verification.md`: samotné HTTP 429 již není červenou chybou parcely. Výsledek: **PASS**.

## Nález

- Výpočet stromů ve Workeru používá geometrii a spon, nevolá klimatické API ani nemění regionální pozorování. Nová reference objektu při uložení plánu nemění klíč geometrie ani závislosti datových hooků. Regrese nebyla nalezena v geometrii stromů.
- Automatické ověření při změně výřezu ignorovalo již ověřený core stejné geometrie. Následná chyba zdroje tak mohla zelenou parcelu přebarvit. Krátká cache celého bboxu z předchozí opravy tento případ neřešila.
- HTTP 429 bylo dál ukládáno jako chyba zdroje v `errors`, čímž se přenášelo do červeného stavu mapy a chybového hodnocení. Navíc splněný příslib s pozastavenými daty mohl zůstat v paměti i po uvolnění kvóty.

## Změna

- Ověřený core se přebírá podle přesného klíče geometrie, včetně platné uložené cache. Ověřená parcela neprojde znovu loadingem ani zbytečným požadavkem na půdu. Shodné parcelní ID s jiným tvarem tuto ochranu nezíská.
- Kvóta je typovaný čekací stav `deferred` s časem dalšího pokusu, oddělený od skutečných chyb. Neověřené parcely mají šedou barvu a popis „Čeká na klimatická data“. Půda a její pokrytí zůstávají dostupné, celkové skóre bez klimatu zůstane prázdné. Karta, náhled i analýza mají stejný význam a neutrální vzhled v obou tématech.
- Obnovení během kvóty zachová platná dřívější data; nevydává je za nové měření. Dosažená kvóta zůstává společná mezi buňkami a uložená po obnově stránky. Po vypršení termínu mohou mapa i aktivní detail pokračovat; příslušná cache už nesmí blokovat obnovu.
- Skutečná chyba půdního zdroje zůstává chybou. Skutečný nedostatek dat a úplný ruční scénář si zachovávají původní význam. Váhy, prahy a matematika vhodnosti ani stromů se nemění. Žádný dataset ani závislost nebyly přidány.

## Limity zdroje

[Oficiální Open-Meteo Pricing](https://open-meteo.com/en/pricing), ověřeno 14. 11. 2026: Free / Open-Access uvádí 600 volání/min, 5 000/h, 10 000/den a 300 000/měsíc. Dokumentace uvádí, že žádosti přes dva týdny nebo více než deset veličin jsou účtované jako více API volání. Dvacetiletou řadu proto nelze počítat jako jedinou jednotku jen podle počtu HTTP požadavků. Zbývající sdílenou kvótu aplikace neodhaduje z lokálního počítadla; respektuje odpověď poskytovatele a `Retry-After`.

## Kontroly

- `test-coverage-preservation.mjs`: skutečné parcely 451/9 a 245/2 na rozhraní dvou ERA5 buněk. Ověřená A zůstává zelená při novém bboxu i HTTP 429/503. Nová B rozlišuje platnou půdu + kvótu od skutečné chyby půdy. Ověřena přesná geometrie, persistentní core po novém modulu, nucené obnovení bez ztráty původních hodnot/času, automaticky obnovitelná paměť a vypršení pozastavené bbox cache před běžným TTL.
- `test-regional-deferred.mjs`: null skóre a neutrální komponenty při kvótě, zachování půdy, nezměněný skutečný nedostatek dat, priorita úplného ručního scénáře, skutečná chyba BPEJ a ochrana proti cizí geometrii.
- Další PASS: regional-climate, regional-lifecycle, automatic-coverage, regional-status, regional, parcel-coverage, manual-inputs, planting-geometry, planting-economics, planting-persistence. TypeScript, produkční build a kontrola diffu prošly.
- Skutečné open datové soubory ověřeny beze změny: 5 oblastí, 6 538 parcel, 100 klimatických let, 6 340 092 bajtů.
- Prohlížeč :5182, skutečná parcela 1641 / k. ú. 649864: návrh **100 stromů, 4 úseky řad, 113°**, jabloň stále **79/100**. Po výpočtu i posunu mapy mělo všech **135** vykreslených parcel zelenou dostupnost; žádná červená.
- Vyhledaný Kyjov / okres Havlíčkův Brod při skutečně vyčerpané kvótě: **187 čekajících, 0 loading, 0 chyb**. Náhled skutečné parcely **3272 / k. ú. 637823**: půda 100 %, klima čeká, 1/3 kategorií; přidaná karta i podrobná analýza měly „Čeká na klimatická data“ a žádné celkové skóre.
- Dočasné testovací parcely i jejich plány byly odstraněny pouze z odděleného originu :5182. Reload potvrdil **0 pozemků**. Uživatelské parcely na :5181 zůstaly zachovány.

Snímky: `quota-planting-preserved.png`, `quota-neutral-map.png`, `quota-neutral-card.png`.
