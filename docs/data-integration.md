# Data integration plan

## Architectural decision

Use plain TypeScript and Vite, with the official SQLite WASM package in a dedicated worker, and `opfs-sahpool` for local persistence. This fits a static frontend and keeps SQL off the UI thread. The [SQLite persistence guide](https://sqlite.org/wasm/doc/trunk/persistence.md#vfs-opfs-sahpool) documents SAHPool's lack of COOP/COEP requirements and its single-context limitation. A lifetime Web Lock prevents a second SADY worker from entering the same pool. `preserveOnInitFailure: true` prevents the upstream initialization-failure cleanup from wiping the pool. Unsupported storage fails explicitly instead of silently saving to memory.

Keep the data layer independent of React/Vue/map libraries until the actual UI needs them. Keep SQL private to repositories. Version the schema with transactional, append-only migrations (`PRAGMA user_version`); reject databases newer than this app. Bind external values and enable foreign keys on every connection. The current schema separates:

- User-owned orchard locations and notes.
- Imported feature snapshots with source-qualified external IDs, RFC 7946 geometry, coarse bounding boxes and original properties.
- Climate snapshots and daily observations with explicit model, grid location, timezone and nullable values.
- Import receipts with provenance, scope, revision, attribution, license and import time.

Imported snapshots are disposable/re-fetchable; user-owned data is separate. Deleting an orchard cascades its climate snapshots, but does not remove unrelated feature imports. Replacing an exact source/scope snapshot is atomic. Different areas and providers remain separate. There is no automatic refresh or background network work at startup.

## How provider integration should work

1. Build a bounded query (area or date range); fetch via a cancellable simple CORS GET without credentials.
2. Check HTTP status **and** provider-level error objects. ArcGIS often sends errors with HTTP 200.
3. Validate the response, handle all pages/transfer-limit flags, then normalize it to a typed snapshot. Do not commit a partial page as a complete area.
4. Transform projected geometries to EPSG:4326, preserving source CRS and revision in the adapter's provenance. Never pass EPSG:5514 values into GeoJSON longitude/latitude fields.
5. Map stable IDs explicitly (`feature.id` or `idProperty`), units, dates, missing values and attribution. Query parameters determining data content belong in the stable scope key.
6. Persist through the public API in one transaction. Do not hold a transaction open during network requests.
7. Use the receipt's import time as freshness evidence, not as the observation date or provider revision. Keep previous data on error and expose stale/missing status in the future UI.

`OpenMeteoArchive` implements this route end to end. Its API documentation is [here](https://open-meteo.com/en/docs/historical-weather-api). It requests ERA5-Land minimum daily temperature and precipitation in Europe/Prague, validates returned units and complete date alignment, and preserves null precipitation observed in the project's sample. Data represent a reanalysis grid, not measured orchard conditions. No frost score, irrigation need or financial estimate is inferred by the base layer.

The [Open-Meteo free API terms](https://open-meteo.com/en/terms) limit that endpoint to noncommercial use. This adapter is suitable for the prototype under those terms. Before commercial deployment, choose a permitted data delivery route that still fits the frontend-only design; do not embed a private subscription key in the bundle. The data license and permission to use a hosted API are separate concerns.

The generic file importer accepts normalized GeoJSON. It does not claim to parse GML, station JSON, JSON-stat or raster assets. Provider-specific file parsers should produce the same snapshot contracts as their network counterparts. Backup export is standard SQLite; backup restore is a separate future feature requiring integrity/schema validation and a safe replacement strategy.

## Evidence and rollout

The existing `research/cors-*.json` files describe bounded server GET probes with `Origin: https://sady-demo.github.io`, recorded on **2026-11-13**. They are not browser tests, licensing audits, guaranteed service contracts, or proof that every endpoint on a host works. Check CORS again from the actual deployment origin when implementing each adapter. The machine-readable catalog is `src/data/sources/catalog.ts`; only Open-Meteo is currently implemented. All other entries are plans.

| Order | Source | Evidence and implementation path |
| --- | --- | --- |
| 1 | ČÚZK RÚIAN parcels, layer 5 | Sample GeoJSON query returned HTTP 200 and an origin CORS header. Request `outSR=4326`; map `properties.id`. Use small areas and explicit paging. Geometry is not ownership information. |
| 1 | RÚIAN BPEJ, layer 28 | Point query was empty; an EPSG:5514 envelope query returned EPSG:4326 polygons. Implement bounded area queries, decode BPEJ codes and document what each code means before suitability logic. |
| 1 | Open-Meteo archive | Sample returned JSON and `*` CORS. Adapter available. Preserve requested orchard coordinates in scope, returned grid coordinates in series, daily local dates, units, model and nulls. Review provider usage terms for deployment. |
| 1 | ČÚZK DMR 5G | A bare `sr=4326` request returned NoData; putting `spatialReference.wkid=4326` inside the geometry returned elevation 170.096. Validate numeric/NoData values. Several spatial samples are needed for slope and aspect. |
| 1 | AOPK protected areas | Bounded GeoJSON query returned data and origin CORS. Confirm layer semantics, map stable IDs, page results, and use precise polygon intersection before showing restrictions. |
| 1 | VÚV Q100 flood areas | Saved service metadata labels layer 13 `ZaplavUzemi_Q100`; a point query returned HTTP 200 and origin CORS. Confirm the current layer metadata and completeness before showing flood exposure. |
| 2 | MZe LPIS DPB | GML response in EPSG:5514 and `*` CORS. Add a namespace-aware GML parser and tested CRS conversion. An LPIS agricultural block is not a cadastral parcel; store source identity separately. |
| 2 | ČÚZK INSPIRE CP WFS | GML and `*` CORS in sample. Useful alternative cadastral source once WFS paging, axis order and CRS conversion are tested. Prefer the simpler RÚIAN GeoJSON route first. |
| 2 | ČSÚ ZEM03D fruit statistics | Metadata and JSON distribution returned `*` CORS. Add a separate statistical observation schema with region, period, fruit/product and units; aggregates are not parcel yield observations. |
| 2 | Eurostat crop prices | JSON-stat returned `*` CORS. Decode dimensions, sparse indices and status flags, retaining currency/unit, product, geography and period. Do not flatten prices into a generic number. |
| 2 | ČHMÚ historical stations | Sample metadata/daily JSON lacked CORS headers. Plan explicit local-file import or bounded same-origin preprocessed bundles. Preserve station ID, quality flags, units and observation dates. |
| 3 | Copernicus STAC | Collection discovery returned `*` CORS; assets, auth, CORS and browser raster processing are unverified. Keep imagery as bounded external/OPFS/Cache storage assets with SQLite metadata, rather than giant DB blobs. |
| 3 | OSM / Overpass | Sample returned HTTP 406 without a usable CORS header. Investigate endpoint policy and origin access. Nearby roads do not establish legal access. |
| 3 | SoilGrids | Probe timed out. Prioritize BPEJ; verify availability, depth/unit handling and uncertainty before adding SoilGrids. |
| 3 | EU Agri-food prices | Documentation had an empty CORS header; actual data request failed. Prefer verified ČSÚ/Eurostat routes while investigating. |
| 3 | SPÚ services | Discovery page returned HTTP 500. Find and probe the actual machine service before planning an adapter. |

No browser-only app can work around a source's missing CORS with `mode: 'no-cors'`: the response is unreadable. Do not introduce a public proxy or put secret keys into this frontend. A user-selected file or preprocessed static bundle is the appropriate fallback under the frontend-only constraint.

## Next implementation steps

1. Add ArcGIS GeoJSON adapters for RÚIAN parcels/BPEJ, with response error validation, stable pagination, bounded areas, complete snapshot commits and saved representative fixtures. Start with the existing Czech sample region; do not bulk-download a national layer.
2. Add exact geospatial operations and tests when the map/analysis flow is defined. Current feature queries are **bounding-box overlap only**, not precise polygon intersection, topology validation or indexed SpatiaLite queries. Do not interpret a bbox match as proof of a legal restriction.
3. Add terrain/constraint snapshots with the domain-specific fields they need. Add migrations rather than cramming unrelated raster/statistical data into feature properties.
4. Add LPIS/GML conversion and ČHMÚ file import, then dimensional economics tables. Keep unavailable, stale, estimated and observed data distinct.
5. Add a versioned app-shell cache for offline cold starts, a validated database restore flow, explicit freshness/refresh controls, and a quota-aware downloaded-area manager. Browser storage may be evicted; backups remain necessary.

The base intentionally contains no universal orchard suitability score. That requires agreed domain rules, crop/cultivar requirements, quality/uncertainty treatment and validation against real orchards.
