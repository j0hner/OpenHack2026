import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const path = String(input);
  assert.match(path, /^\.?\/data\//, 'This test must use prepared factual data only.');
  return Response.json(JSON.parse(await readFile(new URL('../public/' + path.replace(/^\.?\//, ''), import.meta.url), 'utf8')));
};
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const { loadRegionalData, geometryKey } = await server.ssrLoadModule('/src/lib/regionalData.ts');
  const { scoreRegionalArea } = await server.ssrLoadModule('/src/lib/regionalScoring.ts');
  const { parcelArea } = await server.ssrLoadModule('/src/lib/openData.ts');
  const { FRUIT_ORDER, DEFAULT_ECONOMICS } = await server.ssrLoadModule('/src/data/fruitProfiles.ts');
  const { default: ParcelCard } = await server.ssrLoadModule('/src/components/ParcelCard.tsx');
  const { default: AreaDetail } = await server.ssrLoadModule('/src/components/AreaDetail.tsx');
  const parcels = JSON.parse(await readFile(new URL('../public/data/locations/demo-d-parcels.json', import.meta.url), 'utf8'));
  const area = parcelArea(parcels.features.find(f => String(f.properties.id) === '1245682735'));
  const actual = await loadRegionalData(area.geometry, new AbortController().signal);
  const noop = () => {};
  const render = (regional, fruit = 'apple') => {
    const evaluated = { ...area, regional };
    const ranking = Object.fromEntries(FRUIT_ORDER.map(key => [key, scoreRegionalArea(evaluated, key)]));
    const score = ranking[fruit];
    const props = { area: evaluated, score, fruit, ranking, economicsInputs: DEFAULT_ECONOMICS, onFruitChange: noop, onClose: noop, onSplit: noop, onAnalysis: noop, onRetryData: noop, onEconomicsChange: noop };
    return {
      score,
      card: renderToStaticMarkup(createElement(ParcelCard, props)),
      detail: renderToStaticMarkup(createElement(AreaDetail, { ...props, irrigation: false, onIrrigationChange: noop, onResetEconomics: noop, selectedCount: 1, tab: 'prehled', onTabChange: noop, onOpenProvenance: noop, onOpenCompare: noop })),
    };
  };
  for (const [regional, status, label] of [
    [undefined, 'idle', 'Dosud neověřeno'],
    [{ status: 'idle', data: null }, 'idle', 'Dosud neověřeno'],
    [{ status: 'loading', data: null }, 'loading', 'Načítám podklady'],
    [{ status: 'error', data: null, message: 'HTTP 503' }, 'error', 'Chyba načítání'],
  ]) {
    const result = render(regional);
    assert.equal(result.score.overall, null);
    assert.equal(result.score.dataStatus, status);
    for (const html of [result.card, result.detail]) {
      assert(html.includes(label), 'The short card and full analysis must show the same lifecycle state.');
      assert(!html.includes('Nedostatek dat'), 'Pending and failed requests must not masquerade as confirmed missing data.');
      assert(!html.includes('Chybí podklady:</strong>'));
      assert(!html.includes('Zásadní podklady chybí'));
    }
  }
  const ready = render({ status: 'ready', data: actual });
  assert.equal(ready.score.overall, 79);
  assert.equal(ready.score.dataStatus, 'ready');
  assert.equal(ready.score.completeness, 60, 'Conservative quality and sufficient core inputs are distinct.');
  for (const html of [ready.card, ready.detail]) assert(html.includes('Dostatek podkladů pro výpočet.'));
  const pear = render({ status: 'ready', data: actual }, 'pear');
  assert.equal(pear.score.overall, 75);
  assert.equal(pear.score.dataStatus, 'ready');

  const noSoil = { ...actual, soil: { ...actual.soil, coveragePct: 79 }, errors: [] };
  const shortClimate = { ...actual, climate: { ...actual.climate, years: actual.climate.years.slice(0, 14) }, errors: [] };
  for (const data of [noSoil, shortClimate]) {
    const result = render({ status: 'ready', data });
    assert.equal(result.score.overall, null);
    assert.equal(result.score.dataStatus, 'insufficient');
    assert(result.card.includes('Nedostatek dat'));
    assert(result.detail.includes('Nedostatek dat'));
  }
  const failed = render({ status: 'ready', data: { ...actual, soil: null, errors: ['BPEJ: HTTP 503'] } });
  assert.equal(failed.score.dataStatus, 'error');
  assert.equal(failed.score.overall, null);
  const wrongGeometry = structuredClone(actual);
  wrongGeometry.key = geometryKey({ type: 'Polygon', coordinates: [[[14, 50], [14.001, 50], [14.001, 50.001], [14, 50.001], [14, 50]]] });
  const mismatched = render({ status: 'ready', data: wrongGeometry });
  assert.equal(mismatched.score.overall, null);
  assert.equal(mismatched.score.dataStatus, 'error');
  assert(mismatched.score.categories.every(category => category.score === null));
  console.log(JSON.stringify({ checks: 'OK', sharedCardAndDetailStates: true, noFalseInsufficiency: true, actualApple: ready.score.overall, actualPear: pear.score.overall, coreOnlyAnalysis: true, trueInsufficiency: true, geometryGuard: true }));
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
