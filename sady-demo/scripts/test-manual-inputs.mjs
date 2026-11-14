import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const originalFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const path = String(input);
  assert.match(path, /^\.?\/data\//, 'Manual scenarios must not introduce another external source.');
  return Response.json(JSON.parse(await readFile(new URL('../public/' + path.replace(/^\.?\//, ''), import.meta.url), 'utf8')));
};
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
try {
  const { loadRegionalData } = await server.ssrLoadModule('/src/lib/regionalData.ts');
  const { scoreRegionalArea } = await server.ssrLoadModule('/src/lib/regionalScoring.ts');
  const { parcelArea } = await server.ssrLoadModule('/src/lib/openData.ts');
  const { normalizeManualInputs, parseManualValue, hasManualInputs, regionalClimateValue } = await server.ssrLoadModule('/src/lib/manualInputs.ts');
  const { coverageFromArea } = await server.ssrLoadModule('/src/lib/parcelCoverage.ts');
  const { migrateState } = await server.ssrLoadModule('/src/lib/migration.ts');
  const { default: Panel } = await server.ssrLoadModule('/src/components/ManualInputsPanel.tsx');
  const parcels = JSON.parse(await readFile(new URL('../public/data/locations/demo-d-parcels.json', import.meta.url), 'utf8'));
  const base = parcelArea(parcels.features.find(f => String(f.properties.id) === '1245682735'));
  const data = await loadRegionalData(base.geometry, new AbortController().signal);
  const area = { ...base, regional: { status: 'ready', data } };
  const before = JSON.stringify(data), baseline = scoreRegionalArea(area, 'apple');
  assert.equal(baseline.overall, 79); assert.equal(baseline.inputOrigin, 'open-data');
  assert.deepEqual(baseline.manualFields, []); assert.equal(baseline.completeness, 60);
  assert.equal(normalizeManualInputs({ rainfallMm: '', temperatureMeanC: '10', note: 'no numeric values' }), undefined);
  assert.equal(normalizeManualInputs({ soilHpj: 90, et0Mm: Infinity, springFrostDays: -1 }), undefined);
  assert.equal(hasManualInputs({ note: 'only note' }), false);
  assert.deepEqual(parseManualValue('rainfallMm', ''), {});
  assert.deepEqual(parseManualValue('temperatureMeanC', ' 10,5 '), { value: 10.5 });
  assert.deepEqual(parseManualValue('springFrostDays', '0'), { value: 0 });
  assert(parseManualValue('soilHpj', '1.5').error); assert(parseManualValue('springFrostDays', '93').error);
  assert(parseManualValue('temperatureMeanC', 'NaN').error); assert(parseManualValue('rainfallMm', '1e99').error);
  const normalized = normalizeManualInputs({ soilHpj: 1, springFrostDays: 0, bogus: 1, note: ' x '.repeat(200) });
  assert.equal(normalized.springFrostDays, 0); assert.equal(normalized.note.length, 240); assert(!('bogus' in normalized));

  const dry = scoreRegionalArea({ ...area, manualInputs: { rainfallMm: 250, et0Mm: 900 } }, 'apple');
  assert.equal(dry.inputOrigin, 'mixed');
  assert(dry.overall < baseline.overall);
  assert(dry.categories.find(c => c.key === 'water').score < baseline.categories.find(c => c.key === 'water').score);
  assert.deepEqual(dry.manualFields, ['rainfallMm', 'et0Mm']);
  assert(dry.categories.find(c => c.key === 'water').summary.includes('ručně zadáno'));
  const soil = scoreRegionalArea({ ...area, manualInputs: { soilHpj: 65 } }, 'apple');
  assert.equal(soil.categories.find(c => c.key === 'soil').score, 20);
  assert.equal(soil.verdict, 'Rizikový'); assert(soil.overall < baseline.overall);
  const cold = scoreRegionalArea({ ...area, manualInputs: { temperatureMeanC: 3, springFrostDays: 60, summerDays: 2 } }, 'apple');
  assert(cold.overall < baseline.overall);
  assert.deepEqual(scoreRegionalArea({ ...area, manualInputs: undefined }, 'apple'), baseline, 'Reset must restore the original result exactly.');
  assert.deepEqual(scoreRegionalArea({ ...area, manualInputs: { temperatureMeanC: NaN } }, 'apple'), baseline, 'Invalid persisted inputs must never influence the model.');

  // A manual scenario can be computed without inventing annual observations.
  const manual = { soilHpj: 1, temperatureMeanC: 9, rainfallMm: 650, et0Mm: 600, springFrostDays: 12, summerDays: 40 };
  const manualArea = { ...base, regional: { status: 'idle', data: null }, manualInputs: manual };
  const own = scoreRegionalArea(manualArea, 'apple');
  assert.equal(own.overall, 93); assert.equal(own.inputOrigin, 'manual'); assert.equal(own.dataStatus, 'ready');
  assert.equal(own.completeness, 40); assert(own.dataMessage.includes('uživatelský scénář'));
  assert.equal(manualArea.regional.data, null); assert.equal(coverageFromArea(manualArea).state, 'unknown', 'A user scenario must not turn actual open-data availability green.');
  const incomplete = scoreRegionalArea({ ...manualArea, manualInputs: { soilHpj: 1, rainfallMm: 650 } }, 'apple');
  assert.equal(incomplete.overall, null); assert.equal(incomplete.categories.find(c => c.key === 'water').score, null);

  // Missing rainfall is filled by one explicit manual value; all other means
  // still require fifteen real years of their own indicator, not fake rows.
  const noRain = structuredClone(area);
  noRain.regional.data.climate.years.forEach(year => { year.rainfallMm = null; });
  assert.equal(scoreRegionalArea(noRain, 'apple').overall, null);
  noRain.manualInputs = { rainfallMm: 650 };
  const mixed = scoreRegionalArea(noRain, 'apple');
  assert.notEqual(mixed.overall, null); assert.equal(mixed.inputOrigin, 'mixed');
  assert.equal(coverageFromArea(noRain).state, 'insufficient');
  assert(noRain.regional.data.climate.years.every(year => year.rainfallMm === null));
  const short = structuredClone(noRain);
  short.regional.data.climate.years.forEach((year, i) => { if (i >= 14) year.temperatureMeanC = null; });
  assert.equal(regionalClimateValue(short.regional.data, 'temperatureMeanC'), null);
  assert.equal(scoreRegionalArea(short, 'apple').overall, null);
  short.manualInputs.temperatureMeanC = 10;
  assert.notEqual(scoreRegionalArea(short, 'apple').overall, null);
  const mismatched = { ...area, regional: { status: 'ready', data: { ...data, key: 'wrong-geometry' } }, manualInputs: { rainfallMm: 650 } };
  assert.equal(scoreRegionalArea(mismatched, 'apple').overall, null);

  const migrated = migrateState({ parcels: [base], manualByArea: { [base.id]: { rainfallMm: 300, soilHpj: 100, temperatureMeanC: '' }, orphan: manual }, selectedIds: [base.id] });
  assert.deepEqual(migrated.manualByArea, { [base.id]: { rainfallMm: 300 } }, 'Persistence must validate values and remove orphan assignments.');
  const html = renderToStaticMarkup(createElement(Panel, { area, onChange: () => {} }));
  assert.equal((html.match(/<input\b[^>]*value=""[^>]*>/g) ?? []).length, 6, 'Unspecified inputs stay empty rather than silently becoming zero.');
  assert(html.includes('neověřený uživatelský scénář') && html.includes('Zrušit ruční hodnoty'));
  assert.equal(JSON.stringify(data), before, 'Manual scenarios must not mutate downloaded observations.');
  console.log(JSON.stringify({ checks: 'OK', originalApple: baseline.overall, manualScenario: own.overall, inputValidation: true, emptyIsNotZero: true, overridesChangeModel: true, mixedSources: true, noFakeHistory: true, actualAvailabilityUnchanged: true, resetRestoresBaseline: true, migrationPrunesInvalidAndOrphan: true }));
} finally { globalThis.fetch = originalFetch; await server.close(); }
