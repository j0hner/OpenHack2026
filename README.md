# SADY

Frontend-only TypeScript foundation for an orchard application. SQLite runs in a dedicated Web Worker and persists on this device in the browser's Origin Private File System (OPFS). No application server, account, remote database or API key is required.

## Run

Use Node 22.12+ (Node 24 recommended) and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```
Open the localhost URL printed by Vite. The small app shell can save orchards and download a standard SQLite backup. It demonstrates the data API; it is not the final orchard planning UI.

```sh
pnpm typecheck
pnpm build
pnpm preview
pnpm exec playwright install chromium
pnpm test
```

Tests use actual Chromium, Web Workers, SQLite WASM and OPFS, with isolated browser contexts. Open-Meteo responses are mocked so tests do not depend on external datasets. To use an installed browser instead, set `PLAYWRIGHT_CHANNEL=chrome` (PowerShell: `$env:PLAYWRIGHT_CHANNEL = 'chrome'`).

## Application API

UI code imports only `src/data/index.ts`. There is no dependency on a UI framework, and no SQL or worker messages belong in UI components.

```ts
import { openSady } from './data';

const app = await openSady(); // Once per app lifecycle; throws if persistence is unavailable.
const orchard = await app.orchards.create({
  name: 'South orchard', longitude: 16.6, latitude: 48.9,
  notes: 'Inspect spring frost exposure',
});
await app.orchards.update(orchard.id, { ...orchard, notes: 'Visited in April' });
const allOrchards = await app.orchards.list();
const selected = await app.orchards.get(orchard.id); // null when missing

// Optional network request; previously saved records remain available on failure.
await app.climate.fetchArchive(orchard.id, '2025-04-01', '2025-04-30');
const series = await app.climate.list(orchard.id);

const bytes = await app.exportDatabase(); // Portable .sqlite3; not a JSON dump.
await app.close(); // Await before opening another connection.
```

User-selected, already normalized GeoJSON follows the same import boundary as a future network adapter:

```ts
await app.features.importFile(file, {
  sourceId: 'ruian-parcels',
  scopeKey: 'selected-area-v1',
  sourceUrl: file.name,
  attribution: 'Use the attribution supplied with the actual dataset',
  license: 'Use the actual dataset license / license URL',
  idProperty: 'id', // Omit when each Feature already has feature.id.
});
const features = await app.features.query({
  sourceId: 'ruian-parcels', bbox: [16.5, 48.8, 16.7, 49], limit: 100, offset: 0,
});
const receipts = await app.imports.list();
const snapshot = await app.features.query({ importId: receipts[0]!.id });
await app.imports.delete(receipts[0]!.id); // Cascades only this imported snapshot.
```

Feature imports require EPSG:4326 longitude/latitude geometry and stable IDs. All source values are validated again inside the worker. Imports are limited to 10 MiB / 10,000 features; split larger datasets into bounded snapshots. A source/kind/scope replacement commits as one transaction, preserving the old snapshot if any new record fails. Climate scopes additionally belong to an orchard. Sources sharing external IDs do not collide. Overlapping feature scopes remain distinct snapshots and may contain the same source feature; callers should select an appropriate scope strategy before a future unified map layer deduplicates them.

Errors have a typed `SadyError.code`, including `VALIDATION`, `DATABASE_BUSY`, `STORAGE_UNAVAILABLE`, `NETWORK` and `SOURCE_ERROR`. Missing data stays `null`; it is never converted into zero or an inferred safe condition.

## Storage and hosting

- Serve the built `dist/` over HTTPS, or use localhost for development. `file://` is unsupported.
- SQLite's `opfs-sahpool` VFS requires no COOP/COEP headers. Assets are bundled and served from your own origin; there is no runtime CDN dependency. Relative build paths support static subdirectory hosting.
- One SADY tab owns the database. A Web Lock rejects a second connection with a clear error before it touches the pool. This is deliberate; SAHPool is not a multi-tab database. Await `close()` before reopening.
- The database filename `/sady.sqlite3`, pool directory `/sady-sqlite`, and lock name are stable identifiers. Changing them hides the existing data; a future migration must move data explicitly.
- Browser storage belongs to an origin and browser profile. Moving the site to another domain, changing the local port, clearing site data or using a different device creates a separate store. Private browsing and restricted storage modes may be unsupported.
- `requestPersistentStorage()` asks the browser to reduce eviction risk; a grant is not guaranteed. Export backups separately. The app does not yet implement database backup restore, cross-device sync, or encryption.
- Local queries work without network after the app has loaded. This foundation does **not** yet precache the app shell for offline cold starts; add a versioned service worker when the UI/deployment is settled.

## Project structure

```text
src/data/index.ts             Public app API
src/data/client.ts            Typed worker request lifecycle
src/data/db/worker.ts         Single owner, persistence, serialized operations
src/data/db/migrations.ts     Append-only schema versions
src/data/db/store.ts          Bound SQL, transactions, repositories
src/data/types.ts             App/domain and normalized import contracts
src/data/validation.ts        Geometry, coordinates, dates and provenance
src/data/sources/             Catalog, provider adapter contract, bounded fetch
docs/data-integration.md      Dataset rollout based on the project's probes
tests/                       Browser integration tests and test-only harness
research/                    Existing source/CORS evidence, preserved unchanged
```
