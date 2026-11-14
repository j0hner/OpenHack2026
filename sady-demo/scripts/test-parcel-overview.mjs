import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const overview = await server.ssrLoadModule('/src/lib/parcelOverview.ts');
  const { parcelArea } = await server.ssrLoadModule('/src/lib/openData.ts');
  const { default: ParcelOverview } = await server.ssrLoadModule('/src/components/ParcelOverview.tsx');
  const fixture = JSON.parse(await readFile(new URL('../public/data/locations/demo-d-parcels.json', import.meta.url), 'utf8'));
  const ids = ['1245682735', '1245678735', '1245689735', '1245684735'];
  const areas = ids.map(id => parcelArea(fixture.features.find(feature => String(feature.properties.id) === id)));
  areas[0] = { ...areas[0], name: 'Sad 10', location: { ...areas[0].location, obec: 'Žďár', okres: 'Kroměříž' } };
  areas[1] = { ...areas[1], name: 'Sad 2' };
  areas[2] = { ...areas[2], name: 'Jižní výsadba' };
  areas[3] = { ...areas[3], name: 'Sad 2' };
  const fruitById = { [areas[0].id]: 'apple', [areas[1].id]: 'pear', [areas[2].id]: 'plum', [areas[3].id]: 'cherry' };
  const values = [0, 81, 40, null];
  const scoreById = Object.fromEntries(areas.map((area, index) => [area.id, {
    overall: values[index], verdict: values[index] === null ? 'Načítám podklady' : values[index] >= 75 ? 'Vhodný' : 'Rizikový', verdictClass: values[index] === null ? 'nodata' : values[index] >= 75 ? 'good' : 'risk',
  }]));
  const rows = overview.createParcelOverviewRows(areas, area => fruitById[area.id], area => scoreById[area.id]);
  assert(rows.every(row => row.areaHa > 0));
  assert.equal(rows[0].suitability, 0, 'An actual zero score must remain a rated result.');
  assert.equal(rows[3].suitability, null);
  assert.match(rows[0].locality, /Žďár.*Kroměříž/);
  assert(!rows[1].locality.includes('neurčeno'));
  const measured = rows.map((row, index) => ({ ...row, areaHa: [2, 10, .5, 1][index] }));
  const byId = result => result.map(row => row.area.id);
  const identity = areas.map(area => area.id);
  assert.deepEqual(byId(overview.sortParcelOverviewRows(measured, 'area', 'asc')), [identity[2], identity[3], identity[0], identity[1]], 'Area sorting must be numeric rather than lexicographic.');
  assert.deepEqual(byId(overview.sortParcelOverviewRows(measured, 'area', 'desc')), [identity[1], identity[0], identity[3], identity[2]]);
  assert.deepEqual(byId(overview.sortParcelOverviewRows(measured, 'suitability', 'asc')), [identity[0], identity[2], identity[1], identity[3]]);
  assert.deepEqual(byId(overview.sortParcelOverviewRows(measured, 'suitability', 'desc')), [identity[1], identity[2], identity[0], identity[3]], 'Missing score stays last even in descending order.');
  assert.deepEqual(byId(overview.sortParcelOverviewRows(measured, 'fruit', 'asc')), [identity[1], identity[0], identity[2], identity[3]], 'Fruit sorting follows Czech display labels.');
  assert.deepEqual(byId(overview.sortParcelOverviewRows(measured, 'fruit', 'desc')), [identity[3], identity[2], identity[0], identity[1]]);
  const nameOrder = byId(overview.sortParcelOverviewRows(measured, 'name', 'asc'));
  assert(nameOrder.indexOf(identity[1]) < nameOrder.indexOf(identity[0]), 'Natural numeric parcel names must put 2 before 10.');
  assert(nameOrder.indexOf(identity[1]) < nameOrder.indexOf(identity[3]), 'Equal keys retain source order.');
  assert.deepEqual(byId(measured), identity, 'Sorting must not mutate the source list.');
  const filter = patch => overview.filterParcelOverviewRows(measured, { ...overview.EMPTY_PARCEL_FILTERS, ...patch });
  assert.deepEqual(byId(filter({ fruit: 'pear' })), [identity[1]]);
  assert.deepEqual(byId(filter({ areaMin: '1', areaMax: '2' })), [identity[0], identity[3]], 'Range endpoints are inclusive.');
  assert.deepEqual(byId(filter({ areaMax: '0,5' })), [identity[2]], 'Czech decimal commas are accepted.');
  assert.deepEqual(byId(filter({ suitabilityMin: '0', suitabilityMax: '40' })), [identity[0], identity[2]], 'A zero-bound range cannot turn missing scores into zero.');
  assert.deepEqual(byId(filter({ rating: 'unrated' })), [identity[3]]);
  assert.deepEqual(byId(filter({ rating: 'rated' })), [identity[0], identity[1], identity[2]]);
  assert.deepEqual(byId(filter({ query: 'zdar' })), [identity[0]], 'Locality search must ignore accents.');
  assert.deepEqual(byId(filter({ query: '1641' })), [identity[0]], 'Renamed parcels remain findable by official number.');
  assert.equal(filter({ query: 'není zde', fruit: 'pear' }).length, 0);
  for (const patch of [{ areaMin: '-1' }, { areaMin: '3', areaMax: '2' }, { suitabilityMax: '101' }, { suitabilityMin: 'forty' }, { suitabilityMin: '50', suitabilityMax: '40' }]) {
    assert(overview.parseParcelOverviewRanges({ ...overview.EMPTY_PARCEL_FILTERS, ...patch }).error);
    assert.equal(filter(patch).length, 0, 'An invalid range must be visible as an error rather than ignored.');
  }
  assert.equal(filter({}).length, 4, 'Resetting filters restores the full list.');
  const invalidScore = overview.createParcelOverviewRows([areas[0]], () => 'apple', () => ({ ...scoreById[areas[0].id], overall: NaN }));
  assert.equal(invalidScore[0].suitability, null);
  const html = renderToStaticMarkup(createElement(ParcelOverview, { areas, fruitForArea: area => fruitById[area.id], scoreForArea: area => scoreById[area.id], onSelect() {} }));
  assert(html.includes('Bez hodnocení')); assert(html.includes('Načítám podklady')); assert(html.includes('0/100'));
  assert(html.includes('aria-sort="ascending"')); assert(html.includes('Výměra od (ha)')); assert(html.includes('Zrušit filtry')); assert(html.includes('parc. 1641'));
  const empty = renderToStaticMarkup(createElement(ParcelOverview, { areas: [], fruitForArea: () => 'apple', scoreForArea: () => scoreById[areas[0].id], onSelect() {} }));
  assert(empty.includes('Zatím nemáte uložené pozemky'));
  console.log(JSON.stringify({ checks: 'OK', numericAreaSort: true, czechFruitSort: true, bothDirections: true, stableTies: true, nullScoreDistinctFromZero: true, inclusiveRanges: true, decimalComma: true, invalidRangeErrors: true, renamedParcelSearch: true, emptyState: true }));
} finally { await server.close(); }
