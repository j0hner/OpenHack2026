import { DatabaseClient } from './client';
import { DATA_SOURCES } from './sources/catalog';
import { openMeteoArchive } from './sources/open-meteo';
import type { ClimateImport, FeatureQuery, GeoJsonImport, OrchardInput } from './types';
import { MAX_IMPORT_BYTES } from './validation';
import { requireValue, SadyError } from './errors';

export type * from './types';
export { DATA_SOURCES } from './sources/catalog';
export { openMeteoArchive } from './sources/open-meteo';
export { SadyError } from './errors';

/** UI/framework-independent application boundary. Call once at app startup. */
export async function openSady() {
  const client = new DatabaseClient();
  let storage;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    storage = await Promise.race([
      client.request('init', undefined),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SadyError('STORAGE_UNAVAILABLE', 'Opening SQLite timed out. Check that app assets and browser storage are available, then reload.')), 30_000);
      }),
    ]);
  }
  catch (error) { client.abort(); throw error; }
  finally { clearTimeout(timer); }
  return {
    storage,
    sources: DATA_SOURCES,
    orchards: {
      list: () => client.request('orchards.list', undefined),
      get: (id: string) => client.request('orchards.get', id),
      create: (orchard: OrchardInput) => client.request('orchards.save', { orchard }),
      update: (id: string, orchard: OrchardInput) => client.request('orchards.save', { id, orchard }),
      delete: (id: string) => client.request('orchards.delete', id),
    },
    features: {
      import: (input: GeoJsonImport) => client.request('features.import', input),
      query: (input: FeatureQuery = {}) => client.request('features.query', input),
      importFile: async (file: File, metadata: Omit<GeoJsonImport, 'collection'>) => {
        requireValue(file.size <= MAX_IMPORT_BYTES, 'File exceeds the 10 MiB import limit.');
        let collection: GeoJsonImport['collection'];
        try { collection = JSON.parse(await file.text()) as GeoJsonImport['collection']; }
        catch (cause) { throw new SadyError('VALIDATION', 'File is not valid JSON.', { cause }); }
        return client.request('features.import', { ...metadata, collection });
      },
    },
    imports: {
      list: () => client.request('imports.list', undefined),
      delete: (id: string) => client.request('imports.delete', id),
    },
    climate: {
      import: (input: ClimateImport) => client.request('climate.import', input),
      list: (orchardId: string) => client.request('climate.list', orchardId),
      fetchArchive: async (orchardId: string, startDate: string, endDate: string, signal?: AbortSignal) => {
        const orchard = await client.request('orchards.get', orchardId);
        if (!orchard) throw new SadyError('NOT_FOUND', 'Orchard does not exist.');
        const snapshot = await openMeteoArchive.load({ orchard, startDate, endDate, ...(signal ? { signal } : {}) });
        return client.request('climate.import', snapshot);
      },
    },
    /** Portable, standard SQLite backup. OPFS files themselves are pool-managed. */
    exportDatabase: () => client.request('export', undefined),
    requestPersistentStorage: async () => navigator.storage?.persist ? navigator.storage.persist() : false,
    storageEstimate: async () => navigator.storage?.estimate ? navigator.storage.estimate() : {},
    close: () => client.close(),
  };
}

export type Sady = Awaited<ReturnType<typeof openSady>>;
