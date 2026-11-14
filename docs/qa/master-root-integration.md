# Sloučení větví a přesun aplikace do kořene

Připraveno 14. 11. 2026. Integrační větev vychází z aktuálního `origin/master`
(`d71dd4c`) a zachovává i jeho změny README a odkaz na společnou tabuli.

## Začlenění větví

Merge zachovává historii obou samostatných linií:

- `codex/fix-parcel-verification` (`31a1685`) obsahuje také větve
  `codex/orchard-planting`, `codex/categories-data-cleanup`,
  `codex/parcel-map-filtering`, `codex/real-parcels-data-coverage`,
  `codex/moje-sady-redesign` a `codex/open-data-map-layers`.
- `codex/sqlite-data-layer` (`a3a423c`) přidává samostatné SQLite API,
  transakční importy, OPFS Worker, export a testy.
- `adamovoDemo` je již předkem původního masteru.

Po spojení `git branch -r --no-merged HEAD` nevrací žádnou původní vzdálenou
větev. Starší vstupní SQLite prototyp je archivovaný v
`research/sqlite-prototype/`; hlavní aplikací zůstává React `src/main.tsx`.

## Struktura

132 sledovaných souborů aplikace je přesunuto ze `sady-demo/` do kořene.
`src/`, `public/`, `scripts/`, `index.html`, Vite a TypeScript konfigurace i
workflow jsou dostupné přímo z kořene. Zachována jediná npm instalace a
společný `package-lock.json`. Z Git indexu bylo vyřazeno 5 966 starých
souborů `node_modules`; závislosti jsou nadále instalované lokálně a ignorované.
Zdrojová open data se přesunula beze změny obsahu.

SQLite nepřepisuje React localStorage: jeho starší bodové schéma nemá plné
parcely, kategorie a plány výsadby. Nepoužité AOPK/Copernicus položky se
nevracejí do aktuálního katalogu ani mapy. Původní klimatický klient s cache
a neutrálním čekáním při HTTP 429 zůstává součástí aktivního modelu.

## Ověření

- Čistá instalace `npm ci` ze společného lockfilu: PASS.
- Oba TypeScript projekty (aplikace a přísnější SQLite/testy): PASS.
- `npm test`: **22/22 aplikačních sad PASS**, včetně klimatické kvóty,
  zachování ověření, kategorií, migrace, dělení/spojování a rozmístění stromů.
- `data:verify`: **5 oblastí, 6 538 parcel, 100 klimatických let,
  6 340 092 bajtů**, PASS.
- Produkční Vite build: PASS, hlavní JS přibližně **387 kB**, bez SQLite/WASM
  a testovacích obrazovek v hlavním balíčku.
- Samostatný `build:sqlite-qa`: PASS, včetně skutečného SQLite Workeru a WASM.
- Browserové testy jsou připojené k CI: sedm původních API/React průchodů a
  osmý průchod přes viditelné tlačítko s devíti SQLite kontrolami a úklidem.
  Běží nad společným produkčním buildem v odděleném `dist-browser-tests/`,
  aby je neukončilo automatické obnovení Vite dev serveru při nalezení nové závislosti.
  Výsledek konkrétního běhu je v GitHub Actions kontrolách integračního PR.
- Lokální náhled je obnovený na `http://127.0.0.1:5181/` z kořenového `dist/`.

Lokální vizuální kontrola nebyla dokončena: Computer Use nedokázal bezpečně
ověřit adresu otevřeného okna a zastavil ovládání. Do tohoto okna se dále
nezasahovalo. Tento bod se nevydává za provedené vizuální ověření.

## Nasazení

Workflow je nově v kořenovém `.github/workflows/deploy.yml`, reaguje na
`master`, používá Node.js 24 a publikuje pouze `dist/`. PR spouští stejné
kontroly bez nasazení. Existující GitHub Pages nastavení bylo ověřeno přes API:
`build_type: workflow`, větev `master`, cesta `/`. Nevyžaduje změnu oprávnění
ani nastavení hostingu.
