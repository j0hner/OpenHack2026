import { createServer } from 'vite';
import assert from 'node:assert/strict';

const originalFetch = globalThis.fetch;
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
const rectangle = (west, south, size = .0001) => ({ type: 'Polygon', coordinates: [[[west, south], [west + size, south], [west + size, south + size], [west, south + size], [west, south]]] });
const feature = (id, geometry, code = 2) => ({ type: 'Feature', properties: { id, cisloparcely: String(id), druhpozemkukod: code, katastralniuzemi: 123456 }, geometry });
const daily = { time: [], temperature_2m_mean: [], temperature_2m_min: [], temperature_2m_max: [], precipitation_sum: [], et0_fao_evapotranspiration: [] };
for (let time = Date.UTC(2005, 0, 1); time < Date.UTC(2025, 0, 1); time += 86400000) {
  daily.time.push(new Date(time).toISOString().slice(0, 10));
  daily.temperature_2m_mean.push(10); daily.temperature_2m_min.push(1); daily.temperature_2m_max.push(26);
  daily.precipitation_sum.push(2); daily.et0_fao_evapotranspiration.push(1);
}
let currentFeatures = [], soilCalls = 0, climateCalls = 0, protectionCalls = 0, parcelCalls = 0;
let failSoil = false, emptySoil = false, paginateSoil = false, failClimate = false;
let activeClimate = 0, maxClimate = 0, waitClimate = null;
const soilOffsets = [], requests = [];
const queryBounds = [14.60, 50.09, 14.62, 50.11];
globalThis.fetch = async (input, init) => {
  const path = String(input); requests.push(path);
  if (path.endsWith('/data/locations-index.json')) return Response.json([]);
  const url = new URL(path), params = url.searchParams;
  if (path.includes('RUIAN/MapServer/5/query')) {
    parcelCalls++;
    assert(!params.get('where').includes('vymeraparcely'), 'Discovery must not hide small parcels using an area threshold.');
    return Response.json({ type: 'FeatureCollection', features: currentFeatures, exceededTransferLimit: currentFeatures.length > 200 });
  }
  if (path.includes('RUIAN/MapServer/28/query')) {
    soilCalls++;
    soilOffsets.push(Number(params.get('resultOffset')));
    assert.equal(params.get('resultRecordCount'), '500');
    if (failSoil) return new Response('{}', { status: 503 });
    const [w, s, e, n] = params.get('geometry').split(',').map(Number);
    return Response.json({ type: 'FeatureCollection', exceededTransferLimit: paginateSoil && params.get('resultOffset') === '0', features: emptySoil ? [] : [{ type: 'Feature', properties: { nazev: '00100' }, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } }] });
  }
  if (path.includes('archive-api.open-meteo.com')) {
    climateCalls++; activeClimate++; maxClimate = Math.max(activeClimate, maxClimate);
    try {
      assert.equal(params.get('models'), 'era5');
      assert.equal(params.get('start_date'), '2005-01-01');
      assert.equal(params.get('end_date'), '2024-12-31');
      if (waitClimate) await waitClimate(init.signal);
      else await new Promise(resolve => setTimeout(resolve, 0));
      if (failClimate) return new Response('{}', { status: 429 });
      return Response.json({ longitude: Number(params.get('longitude')), latitude: Number(params.get('latitude')), daily });
    } finally { activeClimate--; }
  }
  if (path.includes('gis.nature.cz')) {
    protectionCalls++;
    return Response.json({ type: 'FeatureCollection', features: [] });
  }
  throw Error('Unexpected request: ' + path);
};
try {
  const q = await server.ssrLoadModule('/src/lib/coverageData.ts');
  const { verifyVisibleCoverage, clipCoverageSoil, COVERAGE_CLIMATE_CONCURRENCY } = await server.ssrLoadModule('/src/lib/coverageVerification.ts');
  const { geometryKey, loadRegionalData, soilSummary } = await server.ssrLoadModule('/src/lib/regionalData.ts');
  const { unknownCoverage } = await server.ssrLoadModule('/src/lib/parcelCoverage.ts');
  const rows = features => features.map(feature => ({ feature, coverage: unknownCoverage() }));
  // A remote BPEJ unit can have thousands of irrelevant vertices. Exact clipping
  // must retain the same local partial overlap and internal hole, without making
  // every parcel's intersection repeat that remote geometry. No timing assertion.
  const complexRing = [], steps = 2500, edge = 14.61005;
  for (let i = 0; i < steps; i++) complexRing.push([12 + (edge - 12) * i / steps, 48]);
  for (let i = 0; i < steps; i++) complexRing.push([edge + .000002 * Math.sin(i), 48 + 4 * i / steps]);
  for (let i = 0; i < steps; i++) complexRing.push([edge - (edge - 12) * i / steps, 52]);
  for (let i = 0; i < steps; i++) complexRing.push([12, 52 - 4 * i / steps]);
  complexRing.push(complexRing[0]);
  const smallParcel = rectangle(14.61, 50.1);
  const hole = rectangle(14.61001, 50.10002, .00002).coordinates[0];
  const complexSoil = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { nazev: '00100' }, geometry: { type: 'Polygon', coordinates: [complexRing, hole] } }] };
  const clipped = clipCoverageSoil(complexSoil, [14.61, 50.1, 14.6101, 50.1001]);
  const vertexCount = fc => fc.features.reduce((sum, feature) => sum + feature.geometry.coordinates.flat(Infinity).length / 2, 0);
  assert(vertexCount(complexSoil) > 10000);
  assert(vertexCount(clipped) < 30, 'Exact viewport clipping must remove distant complexity once.');
  const originalCoverage = soilSummary(smallParcel, complexSoil), clippedCoverage = soilSummary(smallParcel, clipped);
  assert(originalCoverage.coveragePct > 20 && originalCoverage.coveragePct < 80);
  assert(Math.abs(originalCoverage.coveragePct - clippedCoverage.coveragePct) < .00001, 'Partial overlap and holes must survive exact clipping.');
  assert.equal(clippedCoverage.valid, originalCoverage.valid);
  currentFeatures = Array.from({ length: 205 }, (_, i) => feature(10000 + i, rectangle(14.61 + i * .00001, 50.1), i === 0 ? 10 : i < 4 ? 5 : 2));
  const discovery = await q.queryCoverageParcels(queryBounds, new AbortController().signal, { checkData: false });
  assert.equal(discovery.parcels.length, 200); assert(discovery.truncated);
  assert.equal(soilCalls, 0); assert.equal(climateCalls, 0); assert.equal(protectionCalls, 0);
  const filtered = await q.queryCoverageParcels(queryBounds, new AbortController().signal, { checkData: false, excludeGardens: true });
  assert(filtered.parcels.every(row => String(row.feature.properties.druhpozemkukod) !== '5'));
  const lastParcelRequest = new URL(requests.filter(path => path.includes('MapServer/5/query')).at(-1));
  assert(!lastParcelRequest.searchParams.get('where').match(/\b5\b/));

  const events = [];
  const verified = await q.queryCoverageParcels(queryBounds, new AbortController().signal, { onProgress: value => events.push(value) });
  assert.equal(verified.parcels.length, 200);
  assert(verified.parcels.every(row => row.coverage.state === 'sufficient'));
  assert(events[0].parcels.every(row => row.coverage.state === 'loading'));
  assert(events.at(-1).parcels.every(row => row.coverage.state === 'sufficient'));
  assert.equal(soilCalls, 1, '200 parcels share one viewport BPEJ query.');
  assert.equal(climateCalls, 1, '200 nearby parcels share one actual ERA5 cell.');
  assert.equal(protectionCalls, 0, 'Availability never calls the removed protection source.');
  assert(verified.parcels.every(row => row.coverage.availableCategories === 3));
  assert.equal((await q.queryCoverageParcels(queryBounds, new AbortController().signal)), verified);
  const detailed = await loadRegionalData(verified.parcels[0].feature.geometry, new AbortController().signal);
  assert.equal(detailed.key, geometryKey(verified.parcels[0].feature.geometry));
  assert.equal(detailed.soil.coveragePct, 100); assert.equal(detailed.climate.years.length, 20);
  assert.equal(soilCalls, 1); assert.equal(climateCalls, 1, 'Adding an automatically verified parcel reuses exact core data.');
  assert.equal(protectionCalls, 0, 'Detailed analysis only consumes soil and climate; the removed protection source is never called.');
  await loadRegionalData(verified.parcels[0].feature.geometry, new AbortController().signal, true);
  assert.equal(soilCalls, 2); assert.equal(climateCalls, 2, 'Explicit refresh bypasses remembered core data.');

  // Climate cells are independent and globally bounded within a viewport job.
  const corners = [feature(20001, rectangle(14.6245, 50.1245)), feature(20002, rectangle(14.6255, 50.1245)), feature(20003, rectangle(14.6245, 50.1255)), feature(20004, rectangle(14.6255, 50.1255))];
  const beforeCells = climateCalls;
  const grid = await verifyVisibleCoverage(rows(corners), new AbortController().signal, () => {});
  assert(grid.every(row => row.coverage.state === 'sufficient'));
  assert.equal(climateCalls - beforeCells, 3, 'One of the four unique cells was already cached.');
  assert(maxClimate <= COVERAGE_CLIMATE_CONCURRENCY);

  paginateSoil = true;
  const beforePages = soilCalls;
  const paged = await verifyVisibleCoverage(rows([feature(21001, rectangle(14.615, 50.102))]), new AbortController().signal, () => {});
  paginateSoil = false;
  assert.equal(soilCalls - beforePages, 2); assert.deepEqual(soilOffsets.slice(-2), [0, 500]);
  assert.equal(paged[0].coverage.state, 'sufficient', 'Duplicate paged BPEJ features cannot double-count area.');

  failSoil = true;
  const failed = await verifyVisibleCoverage(rows([feature(22001, rectangle(14.616, 50.103))]), new AbortController().signal, () => {});
  failSoil = false;
  assert.equal(failed[0].coverage.state, 'error', 'HTTP failure is not confirmed insufficient soil.');
  emptySoil = true;
  const empty = await verifyVisibleCoverage(rows([feature(23001, rectangle(14.617, 50.104))]), new AbortController().signal, () => {});
  emptySoil = false;
  assert.equal(empty[0].coverage.state, 'insufficient'); assert.equal(empty[0].coverage.soilCoveragePct, 0);

  failClimate = true;
  const failedClimateFeature = feature(24001, rectangle(15.61, 50.1));
  const weatherFailure = await verifyVisibleCoverage(rows([failedClimateFeature]), new AbortController().signal, () => {});
  const beforeCooldown = climateCalls;
  await verifyVisibleCoverage(rows([failedClimateFeature]), new AbortController().signal, () => {});
  assert.equal(climateCalls, beforeCooldown, 'Repeated pans use a short failure cooldown rather than hammering the weather provider.');
  failClimate = false;
  assert.equal(weatherFailure[0].coverage.state, 'error');

  // An obsolete viewport cannot publish late responses or hand them to analysis.
  let started, release;
  const climateStarted = new Promise(resolve => { started = resolve; });
  waitClimate = async () => { started(); await new Promise(resolve => { release = resolve; }); };
  const abort = new AbortController(), abortedEvents = [];
  const abortFeature = feature(25001, rectangle(15.86, 50.1));
  const obsolete = verifyVisibleCoverage(rows([abortFeature]), abort.signal, value => abortedEvents.push(value));
  await climateStarted; abort.abort(); const eventsAtAbort = abortedEvents.length; release();
  await assert.rejects(obsolete, { name: 'AbortError' });
  assert.equal(abortedEvents.length, eventsAtAbort);
  waitClimate = null;
  const beforeReload = soilCalls;
  await loadRegionalData(abortFeature.geometry, new AbortController().signal);
  assert.equal(soilCalls, beforeReload + 1, 'Aborted core data must not enter the geometry handoff cache.');
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  const beforeAbortRequests = requests.length;
  await assert.rejects(q.queryCoverageParcels(queryBounds, alreadyAborted.signal), { name: 'AbortError' });
  assert.equal(requests.length, beforeAbortRequests);
  assert.equal(globalThis.localStorage, undefined, 'Automatic verification does not require or populate saved user parcels.');
  console.log(JSON.stringify({ checks: 'OK', automaticVisibleParcels: 200, exactSoilClipping: true, viewportSoilBatch: true, climateCellReuse: true, climateConcurrency: maxClimate, noAutomaticAopk: true, gardenFilterBeforeLimit: true, errorVsInsufficient: true, abortAndCoreHandoff: true, parcelCalls }));
} finally { globalThis.fetch = originalFetch; await server.close(); }
