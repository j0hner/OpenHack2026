import { SadyError } from '../src/data';
import type { GeoJsonImport, Orchard, ImportReceipt, Sady } from '../src/data';

export interface SmokeCheck {
  status: 'pass' | 'fail';
  label: string;
  detail: string;
}
export interface StorageSmokeResult { passed: boolean; checks: SmokeCheck[]; runId: string; }

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
const failureMessage = (error: unknown) => error instanceof SadyError
  ? `${error.code}: ${error.message}` : error instanceof Error ? error.message : String(error);
async function expectErrorCode(task: () => Promise<unknown>, code: string): Promise<void> {
  try { await task(); }
  catch (error) {
    ensure(error instanceof SadyError && error.code === code, `Očekáván ${code}, obdrženo ${failureMessage(error)}.`);
    return;
  }
  throw Error(`Operace měla skončit stavem ${code}.`);
}

/** Browser-only QA over the real public API. Only this run's UUID-owned records
 * are removed; no delete-all operation or external fetch is used. */
export async function runStorageSmoke(
  initial: Sady,
  reopen: () => Promise<Sady>,
  report: (check: SmokeCheck) => void,
): Promise<StorageSmokeResult> {
  const runId = `qa-${crypto.randomUUID()}`, sourceId = `qa-storage-${crypto.randomUUID()}`;
  const featureScope = `${runId}:features`, climateScope = `${runId}:climate`;
  const checks: SmokeCheck[] = [], importedIds = new Set<string>();
  let app = initial, closed = false, orchardId: string | undefined, failed = false;
  let beforeOrchards: Orchard[] | undefined, beforeImports: ImportReceipt[] | undefined;
  let currentLabel = 'SQLite a úložiště OPFS';
  const append = (status: SmokeCheck['status'], label: string, detail: string) => {
    const check = { status, label, detail }; checks.push(check); report(check);
  };
  const pass = (detail: string) => append('pass', currentLabel, detail);
  try {
    ensure(app.storage.mode === 'opfs' && app.storage.schemaVersion >= 1, 'Databáze musí skutečně používat OPFS s platným schématem.');
    ensure(app.storage.sqliteVersion.length > 0, 'Chybí verze skutečného SQLite.');
    beforeOrchards = await app.orchards.list(); beforeImports = await app.imports.list();
    pass(`SQLite ${app.storage.sqliteVersion}, schéma ${app.storage.schemaVersion}, úložiště OPFS.`);

    currentLabel = 'Vytvoření, načtení a aktualizace záznamu';
    const created = await app.orchards.create({ name: `Kontrola ${runId}`, longitude: 16.6, latitude: 48.9, notes: `Syntetický test ${runId}` });
    orchardId = created.id;
    const updated = await app.orchards.update(orchardId, { name: `Upravená kontrola ${runId}`, longitude: 16.6, latitude: 48.9, notes: `Ověřeno ${runId}` });
    const read = await app.orchards.get(orchardId);
    ensure(read?.id === orchardId && read.name === updated.name && read.notes === updated.notes, 'Změna záznamu nebyla správně načtena.');
    ensure((await app.orchards.list()).some(row => row.id === orchardId), 'Záznam chybí v seznamu.');
    pass('Vlastní UUID zůstalo stejné, název a poznámka se aktualizovaly.');

    currentLabel = 'Import GeoJSON a omezený prostorový dotaz';
    const feature: GeoJsonImport['collection']['features'][number] = {
      type: 'Feature', id: `${runId}-plot`, properties: { runId, label: 'Syntetická testovací plocha' },
      geometry: { type: 'Polygon', coordinates: [[[16.6, 48.9], [16.601, 48.9], [16.601, 48.901], [16.6, 48.901], [16.6, 48.9]]] },
    };
    const featureInput: GeoJsonImport = { sourceId, scopeKey: featureScope, sourceUrl: 'test-fixture:sqlite-smoke', attribution: 'Moje Sady · syntetická QA fixture', license: 'Pouze syntetická testovací data', collection: { type: 'FeatureCollection', features: [feature] } };
    const featureReceipt = await app.features.import(featureInput); importedIds.add(featureReceipt.id);
    const nearby = await app.features.query({ sourceId, bbox: [16, 48, 17, 49], limit: 10 });
    ensure(nearby.length === 1 && nearby[0]?.externalId === feature.id && nearby[0]?.properties?.runId === runId, 'Prostorový dotaz nevrátil vlastní importovanou plochu.');
    ensure((await app.features.query({ sourceId, bbox: [12, 49, 13, 50], limit: 10 })).length === 0, 'Vzdálený výřez nesmí obsahovat vlastní testovací plochu.');
    pass('Uložený polygon EPSG:4326 nalezen v odpovídajícím bboxu; vzdálený výřez je prázdný.');

    currentLabel = 'Atomické zachování původního importu při chybě';
    await expectErrorCode(() => app.features.import({ ...featureInput, collection: { type: 'FeatureCollection', features: [feature, feature] } }), 'VALIDATION');
    const survived = await app.features.query({ sourceId, limit: 10 });
    ensure(survived.length === 1 && survived[0]?.importId === featureReceipt.id, 'Neplatná náhrada změnila původní import.');
    pass('Dvojí stejné ID bylo odmítnuto; předchozí import zůstal beze změny.');

    currentLabel = 'Klimatická řada zachovává nuly a neznámé hodnoty';
    const climateReceipt = await app.climate.import({ sourceId, scopeKey: climateScope, sourceUrl: 'test-fixture:sqlite-smoke-climate', attribution: 'Moje Sady · syntetická QA fixture', license: 'Pouze syntetická testovací data', orchardId, longitude: 16.6, latitude: 48.9, model: 'synthetic-test-station', timezone: 'Europe/Prague', days: [
      { date: '2025-04-01', minimumTemperatureC: -2.5, precipitationMm: null },
      { date: '2025-04-02', minimumTemperatureC: null, precipitationMm: 0 },
    ] });
    importedIds.add(climateReceipt.id);
    const climate = (await app.climate.list(orchardId))[0];
    ensure(climate?.days.length === 2 && climate.timezone === 'Europe/Prague', 'Klimatická řada nemá očekávané dny a časové pásmo.');
    ensure(climate.days[0]?.precipitationMm === null && climate.days[1]?.precipitationMm === 0 && climate.days[1].minimumTemperatureC === null, 'Neznámé hodnoty se nesmějí změnit na nulu.');
    pass('Dva místní dny; srážky null a 0 zůstaly odlišné, neznámá teplota zůstala null.');

    currentLabel = 'Export skutečného souboru SQLite';
    const bytes = await app.exportDatabase();
    ensure(bytes.byteLength >= 512 && new TextDecoder().decode(bytes.subarray(0, 16)) === 'SQLite format 3\0', 'Export nemá hlavičku standardní databáze SQLite.');
    pass(`${bytes.byteLength.toLocaleString('cs-CZ')} B; platná hlavička SQLite format 3. Soubor se automaticky nestahuje.`);

    currentLabel = 'Uzavření databáze uvolní spojení';
    await app.close(); closed = true;
    await expectErrorCode(() => app.orchards.get(orchardId!), 'CLOSED');
    pass('Uzavřený klient odmítá další operace stavem CLOSED.');

    currentLabel = 'Nové spojení skutečně načte uložená data';
    app = await reopen(); closed = false;
    ensure((await app.orchards.get(orchardId))?.name === updated.name, 'Záznam nepřežil nové otevření databáze.');
    ensure((await app.features.query({ sourceId, limit: 10 })).length === 1, 'GeoJSON nepřežil nové otevření.');
    const restored = (await app.climate.list(orchardId))[0];
    ensure(restored?.days[0]?.precipitationMm === null && restored.days[1]?.precipitationMm === 0, 'Klima nepřežilo nové otevření se zachováním null/0.');
    pass('Záznam, polygon i klimatická řada přežily ukončení a nové spuštění SQLite workeru.');
  } catch (error) {
    failed = true; append('fail', currentLabel, failureMessage(error));
  } finally {
    currentLabel = 'Bezpečný úklid vlastních testovacích záznamů';
    try {
      if (closed) { app = await reopen(); closed = false; }
      if (orchardId) await app.orchards.delete(orchardId);
      for (const id of importedIds) await app.imports.delete(id);
      // Covers a successful commit whose RPC reply failed before its receipt
      // could be tracked. Both source and scopes are unique to this run.
      for (const receipt of await app.imports.list()) if (receipt.sourceId === sourceId && [featureScope, climateScope].includes(receipt.scopeKey)) await app.imports.delete(receipt.id);
      if (orchardId) ensure(await app.orchards.get(orchardId) === null, 'Vlastní testovací záznam nebyl odstraněn.');
      ensure((await app.features.query({ sourceId, limit: 10 })).length === 0, 'Vlastní testovací import nebyl odstraněn.');
      if (beforeOrchards) ensure(JSON.stringify(await app.orchards.list()) === JSON.stringify(beforeOrchards), 'Seznam ostatních záznamů se během kontroly změnil.');
      if (beforeImports) ensure(JSON.stringify(await app.imports.list()) === JSON.stringify(beforeImports), 'Seznam ostatních importů se během kontroly změnil.');
      pass('Vlastní UUID a importy odstraněny. Původní záznamy a importy zůstaly zachované.');
    } catch (error) { failed = true; append('fail', currentLabel, failureMessage(error)); }
  }
  return { passed: !failed, checks, runId };
}
