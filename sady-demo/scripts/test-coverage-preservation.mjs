import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Actual cadastral shapes on opposite sides of the 15.875° ERA5-cell boundary.
// Only provider responses are mocked; no fake geography is passed off as data.
const fixtures = JSON.parse(await readFile(new URL('../public/data/locations/demo-e-parcels.json', import.meta.url), 'utf8'));
const featureA = fixtures.features.find(feature => String(feature.properties.id) === '1979345710');
const featureB = fixtures.features.find(feature => String(feature.properties.id) === '1979127710');
assert(featureA && featureB, 'Both actual cadastral fixtures must be present.');
const nativeDaily = {
  time: [], temperature_2m_mean: [], temperature_2m_min: [], temperature_2m_max: [],
  precipitation_sum: [], et0_fao_evapotranspiration: [],
};
for (let day = Date.UTC(2005, 0, 1); day < Date.UTC(2025, 0, 1); day += 86400000) {
  nativeDaily.time.push(new Date(day).toISOString().slice(0, 10));
  nativeDaily.temperature_2m_mean.push(10); nativeDaily.temperature_2m_min.push(1);
  nativeDaily.temperature_2m_max.push(26); nativeDaily.precipitation_sum.push(2);
  nativeDaily.et0_fao_evapotranspiration.push(1);
}
const originalFetch = globalThis.fetch;
const originalNow = Date.now;
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
} });
const servers = [];
let currentFeatures = [featureA], soilFailure = false, climateQuota = false;
let quotaRetrySeconds = 120;
let parcelCalls = 0, climateCalls = 0;
const soilRequests = [], climateRequests = [];
globalThis.fetch = async input => {
  const path = String(input);
  // Deliberately use the live-data pathway for these factual shapes. Prepared
  // snapshot climate would conceal the quota behavior this regression tests.
  if (path.endsWith('/data/locations-index.json')) return Response.json([]);
  const url = new URL(path), parameters = url.searchParams;
  if (path.includes('RUIAN/MapServer/5/query')) {
    parcelCalls++;
    return Response.json({ type: 'FeatureCollection', features: currentFeatures });
  }
  if (path.includes('RUIAN/MapServer/28/query')) {
    const bounds = parameters.get('geometry').split(',').map(Number);
    soilRequests.push(bounds);
    assert.equal(parameters.get('outFields'), 'kod,nazev');
    if (soilFailure) return Response.json({ error: { message: 'Unavailable soil provider' } }, { status: 503 });
    const [west, south, east, north] = bounds;
    return Response.json({ type: 'FeatureCollection', features: [{
      type: 'Feature', properties: { kod: 100, nazev: '00100' },
      geometry: { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] },
    }] });
  }
  if (path.startsWith('https://archive-api.open-meteo.com/')) {
    climateCalls++;
    assert.equal(parameters.get('models'), 'era5');
    assert.equal(parameters.get('start_date'), '2005-01-01');
    assert.equal(parameters.get('end_date'), '2024-12-31');
    for (const key of Object.keys(nativeDaily).filter(key => key !== 'time'))
      assert(parameters.get('daily').split(',').includes(key), `Missing native daily field ${key}`);
    const cell = [Number(parameters.get('longitude')), Number(parameters.get('latitude'))];
    climateRequests.push(cell);
    if (climateQuota) return Response.json({ error: true, reason: 'Daily API request limit exceeded. Please try again tomorrow.' }, { status: 429, headers: { 'Retry-After': String(quotaRetrySeconds) } });
    return Response.json({ longitude: cell[0], latitude: cell[1], daily: nativeDaily });
  }
  throw Error('Unexpected source: ' + path);
};
const signal = () => new AbortController().signal;
const fresh = async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  servers.push(server);
  const query = await server.ssrLoadModule('/src/lib/coverageData.ts');
  const regional = await server.ssrLoadModule('/src/lib/regionalData.ts');
  const coverage = await server.ssrLoadModule('/src/lib/parcelCoverage.ts');
  const open = await server.ssrLoadModule('/src/lib/openData.ts');
  const scoring = await server.ssrLoadModule('/src/lib/regionalScoring.ts');
  const verifier = await server.ssrLoadModule('/src/lib/coverageVerification.ts');
  return { ...query, ...regional, ...coverage, ...open, ...scoring, ...verifier };
};
const rowFor = (result, feature) => result.parcels.find(row => String(row.feature.properties.id) === String(feature.properties.id));
const bbox = (client, features, padding = .0001) => {
  const list = features.map(feature => client.geometryBounds(feature.geometry));
  return [Math.min(...list.map(b => b[0])) - padding, Math.min(...list.map(b => b[1])) - padding, Math.max(...list.map(b => b[2])) + padding, Math.max(...list.map(b => b[3])) + padding];
};
const reset = () => { storage.clear(); soilRequests.length = 0; climateRequests.length = 0; parcelCalls = 0; climateCalls = 0; currentFeatures = [featureA]; soilFailure = false; climateQuota = false; quotaRetrySeconds = 120; };
const assertAlwaysPreserved = events => {
  assert(events.length > 0, 'The new viewport must publish verification progress.');
  for (const progress of events) {
    const row = rowFor(progress, featureA);
    assert(row, 'A remains in the newly discovered viewport.');
    assert.equal(row.coverage.state, 'sufficient', 'A must never flash unknown/loading/error after it was actually verified.');
    assert.equal(row.coverage.availableCategories, 3);
  }
};

try {
  reset();
  const client = await fresh();
  const first = await client.queryCoverageParcels(bbox(client, [featureA]), signal());
  assert.equal(rowFor(first, featureA).coverage.state, 'sufficient');
  assert.equal(soilRequests.length, 1); assert.equal(climateCalls, 1);
  assert.deepEqual(climateRequests[0], [15.75, 49.25]);
  const keyA = client.geometryKey(featureA.geometry), keyB = client.geometryKey(featureB.geometry);
  assert.notEqual(keyA, keyB);
  assert(client.existingRegionalCore(keyA));
  assert.equal(client.existingRegionalCore(keyB), null, 'A successful neighboring geometry cannot stand in for B.');
  // The app's detailed analysis persists A's previously verified exact core.
  const originalA = await client.loadRegionalData(featureA.geometry, signal());
  assert.equal(originalA.errors.length, 0); assert.equal(originalA.climate.years.length, 20);
  assert.equal(soilRequests.length, 1); assert.equal(climateCalls, 1);

  currentFeatures = [featureA, featureB]; soilFailure = true; climateQuota = true;
  const events = [], beforeSoil = soilRequests.length;
  const failedB = await client.queryCoverageParcels(bbox(client, currentFeatures), signal(), { onProgress: progress => events.push(progress) });
  assertAlwaysPreserved(events);
  assert.equal(rowFor(failedB, featureA).coverage.state, 'sufficient');
  assert.equal(rowFor(failedB, featureB).coverage.state, 'error', 'A real BPEJ failure must remain an error even alongside a climate quota.');
  assert.match(rowFor(failedB, featureB).coverage.reason, /BPEJ|503/);
  assert.equal(soilRequests.length, beforeSoil + 1);
  assert.deepEqual(soilRequests.at(-1), client.geometryBounds(featureB.geometry), 'Only unverified B may enter the new soil batch; A must not be rechecked.');
  assert.equal(climateCalls, 2); assert.deepEqual(climateRequests[1], [16, 49.25]);
  const beforeReuse = { soil: soilRequests.length, climate: climateCalls };
  const aOnly = await client.verifyVisibleCoverage([{ feature: featureA, coverage: client.unknownCoverage() }], signal(), () => {});
  assert.equal(aOnly[0].coverage.state, 'sufficient');
  assert.equal(soilRequests.length, beforeReuse.soil); assert.equal(climateCalls, beforeReuse.climate);
  const sameIdDifferentShape = { ...featureA, geometry: featureB.geometry };
  const changed = await client.verifyVisibleCoverage([{ feature: sameIdDifferentShape, coverage: client.unknownCoverage() }], signal(), () => {});
  assert.equal(changed[0].coverage.state, 'error', 'Reusing a parcel ID with a different actual geometry cannot inherit A’s verification.');
  assert.equal(soilRequests.length, beforeReuse.soil + 1);
  // Fresh module graph, same persistent store: valid exact A still survives a
  // provider outage, without relying on the previous module's in-memory map.
  const reloaded = await fresh(), beforeReload = { soil: soilRequests.length, climate: climateCalls };
  assert(reloaded.existingRegionalCore(keyA));
  const persisted = await reloaded.verifyVisibleCoverage([{ feature: featureA, coverage: reloaded.unknownCoverage() }], signal(), () => {});
  assert.equal(persisted[0].coverage.state, 'sufficient');
  assert.equal(soilRequests.length, beforeReload.soil); assert.equal(climateCalls, beforeReload.climate);
  // Force-refresh with only the exact geometry core in persistent storage. The
  // fresh module has no climate memory and the separate climate store is absent.
  // An already observed 429 must not erase the original verified observation.
  storage.delete('sady-climate-era5-v1');
  const originalScoreA = client.scoreRegionalArea({ ...client.parcelArea(featureA), regional: { status: 'ready', data: originalA } }, 'apple');
  const forceRefreshedA = await reloaded.loadRegionalData(featureA.geometry, signal(), true);
  assert.equal(forceRefreshedA.key, originalA.key);
  assert.equal(forceRefreshedA.fetchedAt, originalA.fetchedAt, 'Serving the previous observation cannot pretend to have fetched new data.');
  assert.deepEqual(forceRefreshedA.climate, originalA.climate);
  assert.deepEqual(forceRefreshedA.soil, originalA.soil);
  assert.equal(forceRefreshedA.errors.length, 0);
  const retainedScoreA = reloaded.scoreRegionalArea({ ...reloaded.parcelArea(featureA), regional: { status: 'ready', data: forceRefreshedA } }, 'apple');
  assert.equal(retainedScoreA.overall, originalScoreA.overall);
  assert.equal(retainedScoreA.dataStatus, 'ready');
  assert.equal(reloaded.coverageFromArea({ ...reloaded.parcelArea(featureA), regional: { status: 'ready', data: forceRefreshedA } }).state, 'sufficient');

  // Independent fresh graph/storage: climate quota alone is a deferred lookup,
  // not a red failure and never a numeric suitability score.
  reset();
  const pausedClient = await fresh();
  await pausedClient.queryCoverageParcels(bbox(pausedClient, [featureA]), signal());
  currentFeatures = [featureA, featureB]; climateQuota = true; quotaRetrySeconds = 30;
  const pauseEvents = [];
  const paused = await pausedClient.queryCoverageParcels(bbox(pausedClient, currentFeatures), signal(), { onProgress: progress => pauseEvents.push(progress) });
  assertAlwaysPreserved(pauseEvents);
  const bCoverage = rowFor(paused, featureB).coverage;
  assert.equal(bCoverage.state, 'deferred');
  assert.equal(bCoverage.soilCoveragePct, 100);
  assert.equal(bCoverage.climateYears, null);
  assert.equal(pausedClient.existingRegionalCore(pausedClient.geometryKey(featureB.geometry)), null, 'A postponed lookup cannot become verified core data.');
  const beforeDetailClimate = climateCalls;
  const bData = await pausedClient.loadRegionalData(featureB.geometry, signal());
  assert.equal(bData.errors.length, 0); assert(bData.deferred); assert.equal(bData.climate, null);
  assert.equal(climateCalls, beforeDetailClimate, 'An active quota must stop detail retries as well as map retries.');
  const evaluatedB = { ...pausedClient.parcelArea(featureB), regional: { status: 'ready', data: bData } };
  const score = pausedClient.scoreRegionalArea(evaluatedB, 'apple');
  assert.equal(score.overall, null); assert.equal(score.dataStatus, 'deferred');
  assert.equal(pausedClient.coverageFromArea(evaluatedB).state, 'deferred');
  // Advance only the logical clock: a short Retry-After expires before the
  // ordinary two-minute viewport cache. Both the resolved detail promise and
  // cached deferred viewport must be retried, without an explicit force flag.
  const resumedAt = bData.deferred.retryAt + 1;
  assert(resumedAt - originalNow() < 120000, 'This must exercise resumeAt, not merely the ordinary viewport cache TTL.');
  Date.now = () => resumedAt;
  climateQuota = false;
  const beforeResumeClimate = climateCalls;
  const resumedB = await pausedClient.loadRegionalData(featureB.geometry, signal());
  assert.notStrictEqual(resumedB, bData, 'The fulfilled deferred detail promise must expire at retryAt.');
  assert.equal(climateCalls, beforeResumeClimate + 1);
  assert.equal(resumedB.errors.length, 0); assert.equal(resumedB.deferred, undefined);
  assert.equal(resumedB.climate.years.length, 20);
  const resumedScore = pausedClient.scoreRegionalArea({ ...pausedClient.parcelArea(featureB), regional: { status: 'ready', data: resumedB } }, 'apple');
  assert.equal(resumedScore.dataStatus, 'ready'); assert.notEqual(resumedScore.overall, null);
  const beforeResumeParcels = parcelCalls;
  const resumedViewport = await pausedClient.queryCoverageParcels(bbox(pausedClient, currentFeatures), signal());
  assert.notStrictEqual(resumedViewport, paused, 'A paused viewport must expire at Retry-After, even before the ordinary cache TTL.');
  assert.equal(parcelCalls, beforeResumeParcels + 1);
  assert.equal(rowFor(resumedViewport, featureA).coverage.state, 'sufficient');
  assert.equal(rowFor(resumedViewport, featureB).coverage.state, 'sufficient');
  assert.equal(climateCalls, beforeResumeClimate + 1, 'Resumed map and detail must share the newly verified climate/core.');
  console.log(JSON.stringify({ checks: 'OK', actualParcelA: featureA.properties.cisloparcely, actualParcelB: featureB.properties.cisloparcely, verifiedAStaysSufficient: true, noARecheckOrLoading: true, realSoilFailureStaysError: true, climateQuotaIsDeferred: true, noNumericScoreOnQuota: true, geometryIdentity: true, persistentExactCoreReuse: true, forceRefreshRetainsVerifiedCore: true, detailResumesAfterQuota: true, viewportResumesBeforeCacheTtl: true }));
} finally {
  Date.now = originalNow;
  globalThis.fetch = originalFetch;
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor); else delete globalThis.localStorage;
  await Promise.all(servers.map(server => server.close()));
}
