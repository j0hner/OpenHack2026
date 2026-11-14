/// <reference lib="webworker" />
import initSqlite from '@sqlite.org/sqlite-wasm';
import type { Database, SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import { SadyError } from '../errors';
import type { Request, Response, StorageInfo } from '../types';
import { migrate } from './migrations';
import { Store } from './store';

const worker = self as unknown as DedicatedWorkerGlobalScope;
// Stable for this application. Changing this directory would hide existing data.
const DIRECTORY = '/sady-sqlite';
const FILENAME = '/sady.sqlite3';
let db: Database | undefined;
let pool: SAHPoolUtil | undefined;
let store: Store | undefined;
let info: StorageInfo | undefined;
let releaseLock: (() => void) | undefined;
let lockTask: Promise<void> | undefined;

async function acquireLock(): Promise<void> {
  if (!worker.navigator.locks) throw new SadyError('STORAGE_UNAVAILABLE', 'Web Locks are unavailable. Use a supported browser over HTTPS or localhost.');
  await new Promise<void>((resolve, reject) => {
    lockTask = worker.navigator.locks.request('sady:sqlite:owner', { ifAvailable: true }, async lock => {
      if (!lock) { reject(new SadyError('DATABASE_BUSY', 'SADY is already open in another tab. Close it and retry.')); return; }
      await new Promise<void>(release => { releaseLock = release; resolve(); });
    }).then(() => undefined);
    void lockTask.catch(reject);
  });
}

async function close(): Promise<void> {
  db?.close();
  db = undefined;
  store = undefined;
  info = undefined;
  pool?.pauseVfs(); // Release file handles without deleting the database.
  pool = undefined;
  releaseLock?.();
  releaseLock = undefined;
  await lockTask;
  lockTask = undefined;
}

async function initialize(): Promise<StorageInfo> {
  if (info) return info;
  if (!worker.isSecureContext || !worker.navigator.storage?.getDirectory) {
    throw new SadyError('STORAGE_UNAVAILABLE', 'Persistent SQLite requires OPFS in a secure context (HTTPS or localhost).');
  }
  await acquireLock();
  try {
    const sqlite = await initSqlite();
    try {
      pool = await sqlite.installOpfsSAHPoolVfs({
        directory: DIRECTORY,
        initialCapacity: 6,
        // Upstream defaults can remove storage after initialization failure.
        preserveOnInitFailure: true,
      });
    } catch (cause) {
      throw new SadyError('STORAGE_UNAVAILABLE', 'Could not open persistent browser storage. Check browser storage permissions and retry.', { cause });
    }
    db = new pool.OpfsSAHPoolDb(FILENAME);
    info = { mode: 'opfs', schemaVersion: migrate(db), sqliteVersion: sqlite.version.libVersion };
    store = new Store(db);
    return info;
  } catch (error) {
    await close();
    throw error;
  }
}

async function dispatch(request: Request): Promise<unknown> {
  if (request.method === 'init') return initialize();
  if (request.method === 'close') return close();
  if (!store || !db || !pool) throw new SadyError('CLOSED', 'Database is not open.');
  switch (request.method) {
    case 'orchards.list': return store.listOrchards();
    case 'orchards.get': return store.getOrchard(request.input);
    case 'orchards.save': return store.saveOrchard(request.input);
    case 'orchards.delete': return store.deleteOrchard(request.input);
    case 'features.import': return store.importFeatures(request.input);
    case 'features.query': return store.queryFeatures(request.input);
    case 'imports.list': return store.listImports();
    case 'imports.delete': return store.deleteImport(request.input);
    case 'climate.import': return store.importClimate(request.input);
    case 'climate.list': return store.listClimate(request.input);
    case 'export': return pool.exportFile(FILENAME);
  }
}

// Includes async initialization/close: no requests can interleave with a transaction.
let queue = Promise.resolve();
worker.onmessage = (event: MessageEvent<Request>) => {
  queue = queue.then(async () => {
    let response: Response;
    try {
      response = { id: event.data.id, ok: true, value: await dispatch(event.data) };
    } catch (cause) {
      const error = cause instanceof SadyError ? cause
        : new SadyError('DATABASE_ERROR', cause instanceof Error ? cause.message : 'Database operation failed.');
      response = { id: event.data.id, ok: false, error: { code: error.code, message: error.message } };
    }
    worker.postMessage(response);
  });
};
