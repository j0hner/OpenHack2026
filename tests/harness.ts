import { openSady, SadyError } from '../src/data';
import type { Sady } from '../src/data';
import { normalizeArchive, archiveUrl } from '../src/data/sources/open-meteo';
import { runStorageSmoke } from './storage-smoke';

declare global {
  interface Window {
    app: Sady;
    boot: Promise<string>;
    reopen: () => Promise<string>;
    normalizeArchive: typeof normalizeArchive;
    archiveUrl: typeof archiveUrl;
  }
}
window.normalizeArchive = normalizeArchive;
window.archiveUrl = archiveUrl;
const bootState = document.querySelector<HTMLParagraphElement>('#boot-state')!;
const run = document.querySelector<HTMLButtonElement>('#run-smoke')!;
const retry = document.querySelector<HTMLButtonElement>('#reopen-db')!;
const summary = document.querySelector<HTMLParagraphElement>('#smoke-summary')!;
const results = document.querySelector<HTMLOListElement>('#smoke-results')!;
let busy = false, bootStateValue = 'initializing';
const controls = () => { run.disabled = busy || bootStateValue !== 'ready'; retry.disabled = busy || bootStateValue === 'initializing'; };
window.reopen = async () => {
  bootStateValue = 'initializing'; bootState.textContent = 'Otevírám SQLite…'; bootState.className = ''; controls();
  try {
    window.app = await openSady(); bootStateValue = 'ready';
    bootState.textContent = `Připraveno · SQLite ${window.app.storage.sqliteVersion} · schéma ${window.app.storage.schemaVersion} · OPFS`;
    bootState.className = 'pass'; controls(); return 'ready';
  } catch (error) {
    bootStateValue = error instanceof SadyError ? error.code : String(error);
    bootState.textContent = `Databázi nelze otevřít · ${bootStateValue}${error instanceof Error ? ` · ${error.message}` : ''}`;
    bootState.className = 'fail'; controls(); return bootStateValue;
  }
};
window.boot = window.reopen();
run.addEventListener('click', () => {
  if (busy || bootStateValue !== 'ready') return;
  busy = true; controls(); results.replaceChildren(); summary.className = ''; summary.textContent = 'Kontrola probíhá…';
  void runStorageSmoke(window.app, async () => {
    const status = await window.reopen();
    if (status !== 'ready') throw new Error(`Nové otevření SQLite selhalo: ${status}.`);
    return window.app;
  }, check => {
    const item = document.createElement('li'), label = document.createElement('strong'), detail = document.createElement('span');
    item.className = check.status; item.dataset.status = check.status;
    label.textContent = `${check.status === 'pass' ? 'PASS' : 'FAIL'} · ${check.label}`; detail.textContent = check.detail;
    item.append(label, detail); results.append(item);
  }).then(result => {
    summary.className = result.passed ? 'pass' : 'fail';
    summary.textContent = result.passed ? `PASS · všech ${result.checks.length} kontrol prošlo včetně úklidu.` : 'FAIL · některá kontrola neprošla; podrobnosti jsou níže.';
  }).catch(error => { summary.className = 'fail'; summary.textContent = `FAIL · ${error instanceof Error ? error.message : String(error)}`; })
    .finally(() => { busy = false; controls(); });
});
retry.addEventListener('click', () => {
  if (busy) return;
  busy = true; controls();
  void (async () => {
    if (window.app) await window.app.close();
    window.boot = window.reopen(); await window.boot;
  })().catch(error => { bootState.textContent = `Databázi nelze znovu otevřít · ${String(error)}`; bootState.className = 'fail'; })
    .finally(() => { busy = false; controls(); });
});
window.addEventListener('pagehide', () => { if (window.app) void window.app.close(); }, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
if (import.meta.hot) import.meta.hot.dispose(() => { if (window.app) void window.app.close(); });
