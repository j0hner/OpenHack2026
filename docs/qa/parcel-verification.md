# Oprava opakovaného ověřování parcel

Ověřeno 14. 11. 2026 na větvi `codex/fix-parcel-verification`. Výsledek: PASS pro opravu cyklu a práci s chybou poskytovatele; dostupnost nového živého klimatu mimo připravené/cacheované buňky je stále omezená externí kvótou.

## Příčina a změna

- Skutečný požadavek na používaný Open-Meteo archive endpoint vrátil HTTP 429 a `Daily API request limit exceeded. Please try again tomorrow.` Chyba zdroje nebyla důkazem, že pro parcelu neexistují data.
- Mapa nulovala výřez při každém `movestart`; ResizeObserver navíc bez kontroly rozměrů znovu centroval mapu. Hook používal přesný desetinný bbox, zatímco cache šest desetinných míst. Chybové výsledky se necachovaly. Opětovné načtení tak zbytečně vracelo parcely do načítání.
- Poslední ustálený výřez zůstává během pohybu; nový požadavek vyvolá skutečná změna společného zaokrouhleného klíče. Refit nastává jen při změně klientských pixelových rozměrů. Chybové ověření má krátkou 30sekundovou cache.
- Mapa a detail mají společného klienta klimatu: sdílené rozpracované požadavky, nejvýše dva současné, úspěšné výsledky až 48 buněk uložené na sedm dní. Odpojení pohledu neruší jiného odběratele; nepotřebné čekající požadavky se neodesílají.
- HTTP 429 zastaví další živé klimatické požadavky globálně i po obnově stránky. Respektuje `Retry-After`; bez něj používá konzervativní prodlevu podle typu limitu. Ruční obnovení kvótu neobchází. Běžné chyby mají krátkou ochranu konkrétní buňky.
- Již stažené skutečné hybridní klima lze použít mimo malý půdní výřez pouze při shodě obou buněk: ERA5-Land 0,1° pro teplotu a ERA5 0,25° pro srážky/ET0. Zachovává model, skutečné souřadnice a období; nikdy se nevydává za čistou ERA5 buňku. BPEJ se stále protíná se skutečnou geometrií každé parcely.
- Konkrétní chybu zdroje a čas dalšího pokusu ukazuje náhled i vysvětlení datové vrstvy. Výpadek se nepřevádí na příznivé skóre ani na potvrzený nedostatek dat. Modelové váhy a prahy zůstávají stejné.

## Ověření

- TypeScript, produkční Vite build a `git diff --check`: PASS. Hlavní JS přibližně 388 kB před gzip; nepřidána knihovna ani nový dataset.
- `test-regional-climate.mjs`: shodné hybridní buňky mimo půdní bbox, odmítnutí jiné teplotní buňky, sdílení a odpojení, globální souběh 2, zrušení čekajícího požadavku, uložená cache a její expirace, HTTP 429 mezi buňkami a po reloadu, respektování `Retry-After`, obnova po prodlevě, HTTP 503 a odmítnutí cizího gridu.
- `test-map-viewport.mjs`: drobné desetinné změny bboxu a duplicitní počáteční resize nespouštějí nové ověřování; skutečný posun i změna velikosti jsou rozpoznané.
- `test-automatic-coverage.mjs`: 200 parcel sdílí půdní a klimatické požadavky; opakované otevření chybového výřezu nepublikuje nový loading ani nevolá selhávající zdroj. Ověřeno rušení a předání přesné geometrie do detailu.
- Další PASS: regional, regional-status, regional-lifecycle, parcel-coverage, manual-inputs, verify-open-data (5 oblastí, 6 538 parcel, 100 klimatických let, 6 340 092 bajtů).
- Prohlížeč, uživatelský origin :5181, okolí parcely 1641 / k. ú. 649864: před opravou 87 ověřených a 14 chyb; po opravě **101 ověřených, 0 načítání, 0 chyb**. Detail jabloně zůstává 79/100. Uživatelské parcely ani scénáře nebyly smazány nebo přepsány.
- Oddělený testovací origin :5182 bez uložených parcel: živý výřez u vyhledané lokality Kyjov zůstal po dokončení ve stabilní chybě s konkrétním HTTP 429 a termínem dalšího pokusu. Chyba se nezměnila na nedostatek podkladů. Opětovné načtení používá uloženou ochranu poskytovatele.

Snímky: `verification-quota.png`, `verification-stable.png`.
