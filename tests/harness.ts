import { openSady, SadyError } from '../src/data';
import type { Sady } from '../src/data';
import { normalizeArchive, archiveUrl } from '../src/data/sources/open-meteo';

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
window.reopen = async () => {
  try { window.app = await openSady(); return 'ready'; }
  catch (error) { return error instanceof SadyError ? error.code : String(error); }
};
window.boot = window.reopen();
