import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

async function open(page: Page): Promise<void> {
  await page.goto('/tests/harness.html');
  expect(await page.evaluate(() => window.boot)).toBe('ready');
}

test('real OPFS SQLite survives reload, accepts concurrent requests and exports a database', async ({ page }, testInfo) => {
  await open(page);
  const created = await page.evaluate(async () => {
    const orchards = await Promise.all(Array.from({ length: 12 }, (_, index) => window.app.orchards.create({
      name: `Orchard ${index}'); DROP TABLE orchards; --`, longitude: 16.6, latitude: 48.9,
    })));
    return { orchards, storage: window.app.storage };
  });
  expect(created.storage).toMatchObject({ mode: 'opfs', schemaVersion: 1 });
  await page.reload();
  expect(await page.evaluate(() => window.boot)).toBe('ready');
  const persisted = await page.evaluate(async () => ({
    orchards: await window.app.orchards.list(),
    header: new TextDecoder().decode((await window.app.exportDatabase()).slice(0, 16)),
  }));
  expect(persisted.orchards).toHaveLength(12);
  expect(persisted.orchards.map(o => o.id).sort()).toEqual(created.orchards.map(o => o.id).sort());
  expect(persisted.header).toBe('SQLite format 3\0');
  const bytes = await page.evaluate(async () => Array.from(await window.app.exportDatabase()));
  const backupPath = testInfo.outputPath('backup.sqlite3');
  await writeFile(backupPath, new Uint8Array(bytes));
  const backup = new DatabaseSync(backupPath, { readOnly: true });
  try {
    expect(backup.prepare('SELECT count(*) AS count FROM orchards').get()?.count).toBe(12);
    expect(backup.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
  } finally { backup.close(); }
});

test('second tab is rejected, close releases ownership and calls after close reject', async ({ page, context }) => {
  await open(page);
  await page.evaluate(() => window.app.orchards.create({ name: 'Shared orchard', longitude: 16.6, latitude: 48.9 }));
  const other = await context.newPage();
  await other.goto('/tests/harness.html');
  expect(await other.evaluate(() => window.boot)).toBe('DATABASE_BUSY');
  const afterClose = await page.evaluate(async () => {
    await window.app.close();
    try { await window.app.orchards.list(); return 'unexpected'; }
    catch (error) { return (error as { code: string }).code; }
  });
  expect(afterClose).toBe('CLOSED');
  await other.reload();
  expect(await other.evaluate(() => window.boot)).toBe('ready');
  expect(await other.evaluate(() => window.app.orchards.list())).toHaveLength(1);
});

test('snapshot replacement is atomic, source IDs do not collide and bbox queries are bounded', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const metadata = { sourceId: 'ruian-parcels', scopeKey: 'area-1', sourceUrl: 'fixture.geojson',
      license: 'Test fixture', attribution: 'SADY test' };
    const feature = { type: 'Feature' as const, id: '42', properties: { parcel: '12/4' },
      geometry: { type: 'Point' as const, coordinates: [16.6, 48.9] } };
    const collection = { type: 'FeatureCollection' as const, features: [feature] };
    await window.app.features.import({ ...metadata, collection });
    await window.app.features.import({ ...metadata, collection });
    let failed = '';
    try { await window.app.features.import({ ...metadata, collection: { ...collection, features: [feature, feature] } }); }
    catch (error) { failed = (error as { code: string }).code; }
    await window.app.features.import({ ...metadata, sourceId: 'ruian-bpej', collection });
    return {
      failed, imports: await window.app.imports.list(),
      features: await window.app.features.query(),
      nearby: await window.app.features.query({ sourceId: 'ruian-parcels', bbox: [16, 48, 17, 49] }),
      far: await window.app.features.query({ bbox: [10, 40, 11, 41] }),
      page2: await window.app.features.query({ limit: 1, offset: 1 }),
    };
  });
  expect(result.failed).toBe('VALIDATION');
  expect(result.imports).toHaveLength(2);
  expect(result.features).toHaveLength(2);
  expect(result.nearby).toHaveLength(1);
  expect(result.far).toHaveLength(0);
  expect(result.page2).toHaveLength(1);
});

test('rejects projected/broken geometry and imports provider IDs from files', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const metadata = { sourceId: 'ruian-parcels', scopeKey: 'file', sourceUrl: 'parcels.geojson',
      license: 'Test fixture', attribution: 'SADY test', idProperty: 'id' };
    const feature = { type: 'Feature' as const, properties: { id: '42' },
      geometry: { type: 'Point' as const, coordinates: [-600000, -1200000] } };
    let projected = '';
    try { await window.app.features.import({ ...metadata, collection: { type: 'FeatureCollection', features: [feature] } }); }
    catch (error) { projected = (error as { code: string }).code; }
    feature.geometry.coordinates = [16.6, 48.9];
    const file = new File([JSON.stringify({ type: 'FeatureCollection', features: [feature] })], 'parcels.geojson');
    await window.app.features.importFile(file, metadata);
    const receipt = (await window.app.imports.list())[0]!;
    const found = await window.app.features.query({ importId: receipt.id });
    await window.app.imports.delete(receipt.id);
    return { projected, found, after: await window.app.features.query() };
  });
  expect(result.projected).toBe('VALIDATION');
  expect(result.found[0]?.externalId).toBe('42');
  expect(result.after).toHaveLength(0);
});

test('Open-Meteo adapter preserves nulls, provenance and local dates; saved data works offline', async ({ page, context }) => {
  await context.route('https://archive-api.open-meteo.com/**', route => route.fulfill({
    json: { latitude: 48.90001, longitude: 16.600006, timezone: 'Europe/Prague',
      daily_units: { time: 'iso8601', temperature_2m_min: '°C', precipitation_sum: 'mm' },
      daily: { time: ['2025-04-01', '2025-04-02'], temperature_2m_min: [-2.5, 6.2], precipitation_sum: [null, 0] } },
  }));
  await open(page);
  const orchard = await page.evaluate(() => window.app.orchards.create({ name: 'Climate orchard', longitude: 16.6, latitude: 48.9 }));
  await page.evaluate(async id => {
    await window.app.climate.fetchArchive(id, '2025-04-01', '2025-04-02');
    await window.app.climate.fetchArchive(id, '2025-04-01', '2025-04-02');
  }, orchard.id);
  await context.setOffline(true);
  const series = await page.evaluate(id => window.app.climate.list(id), orchard.id);
  expect(series).toHaveLength(1);
  expect(series[0]?.days.map(d => d.precipitationMm)).toEqual([null, 0]);
  expect(series[0]?.days[0]?.minimumTemperatureC).toBe(-2.5);
  expect(series[0]?.timezone).toBe('Europe/Prague');
  expect(series[0]?.import).toMatchObject({ sourceId: 'open-meteo-archive', sourceVersion: 'era5_land', recordCount: 2 });
  await page.evaluate(id => window.app.orchards.delete(id), orchard.id);
  expect(await page.evaluate(() => window.app.imports.list())).toHaveLength(0);
});

test('adapter rejects malformed units/columns and failed requests leave existing snapshots intact', async ({ page, context }) => {
  await open(page);
  const code = await page.evaluate(() => {
    try {
      window.normalizeArchive({ timezone: 'Europe/Prague', longitude: 16.6, latitude: 48.9,
        daily_units: { time: 'iso8601', temperature_2m_min: '°F', precipitation_sum: 'mm' } },
      { orchard: { id: 'test', longitude: 16.6, latitude: 48.9 }, startDate: '2025-04-01', endDate: '2025-04-02' });
      return 'unexpected';
    } catch (error) { return (error as { code: string }).code; }
  });
  expect(code).toBe('SOURCE_ERROR');
  await context.route('https://archive-api.open-meteo.com/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  const result = await page.evaluate(async () => {
    const orchard = await window.app.orchards.create({ name: 'Offline orchard', longitude: 16.6, latitude: 48.9 });
    await window.app.climate.import({ sourceId: 'manual-climate', scopeKey: '2025', orchardId: orchard.id,
      sourceUrl: 'climate.json', license: 'Test', attribution: 'Test', model: 'station', timezone: 'Europe/Prague',
      longitude: 16.6, latitude: 48.9, days: [{ date: '2025-04-01', minimumTemperatureC: null, precipitationMm: 2 }] });
    let errorCode = '';
    try { await window.app.climate.fetchArchive(orchard.id, '2025-04-01', '2025-04-02'); }
    catch (error) { errorCode = (error as { code: string }).code; }
    return { errorCode, series: await window.app.climate.list(orchard.id) };
  });
  expect(result.errorCode).toBe('NETWORK');
  expect(result.series).toHaveLength(1);
});

test('app shell saves and reloads an orchard through the public API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Ready. Changes are saved locally.');
  await page.getByLabel('Name', { exact: true }).fill('Test orchard');
  await page.getByLabel('Longitude').fill('16.6');
  await page.getByLabel('Latitude').fill('48.9');
  await page.getByRole('button', { name: 'Save orchard' }).click();
  await expect(page.locator('#orchards')).toContainText('Test orchard');
  await page.reload();
  await expect(page.locator('#orchards')).toContainText('Test orchard');
});
