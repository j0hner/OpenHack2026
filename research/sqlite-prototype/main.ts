import './style.css';
import { openSady } from '../../src/data';

const form = document.querySelector<HTMLFormElement>('#orchard-form')!;
const fields = document.querySelector<HTMLFieldSetElement>('#fields')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const error = document.querySelector<HTMLParagraphElement>('#error')!;
const list = document.querySelector<HTMLUListElement>('#orchards')!;
const backup = document.querySelector<HTMLButtonElement>('#backup')!;
const persist = document.querySelector<HTMLButtonElement>('#persist')!;

function showError(cause: unknown): void {
  error.textContent = cause instanceof Error ? cause.message : String(cause);
  error.hidden = false;
}

async function start(): Promise<void> {
  const app = await openSady();
  async function refresh(): Promise<void> {
    const orchards = await app.orchards.list();
    list.replaceChildren();
    if (!orchards.length) {
      const empty = document.createElement('li'); empty.textContent = 'No orchards yet. Add your first one above.'; list.append(empty);
    }
    for (const orchard of orchards) {
      const item = document.createElement('li');
      const name = document.createElement('strong'); name.textContent = orchard.name;
      const location = document.createElement('span'); location.textContent = `Latitude ${orchard.latitude}°, longitude ${orchard.longitude}°`;
      const notes = document.createElement('p'); notes.textContent = orchard.notes;
      item.append(name, location, notes); list.append(item);
    }
  }
  await refresh();
  status.textContent = 'Ready. Changes are saved locally.';
  fields.disabled = backup.disabled = persist.disabled = false;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    fields.disabled = true;
    error.hidden = true;
    void app.orchards.create({ name: String(data.get('name')), longitude: Number(data.get('longitude')),
      latitude: Number(data.get('latitude')), notes: String(data.get('notes')) })
      .then(async () => { form.reset(); await refresh(); status.textContent = 'Orchard saved on this device.'; })
      .catch(showError).finally(() => { fields.disabled = false; });
  });
  backup.addEventListener('click', () => {
    backup.disabled = true;
    void app.exportDatabase().then(bytes => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.sqlite3' }));
      const link = document.createElement('a'); link.href = url; link.download = 'sady.sqlite3'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }).catch(showError).finally(() => { backup.disabled = false; });
  });
  persist.addEventListener('click', () => {
    void app.requestPersistentStorage().then(granted => {
      status.textContent = granted ? 'The browser has granted persistent storage. Keep a separate backup too.'
        : 'The browser did not grant persistent storage. Your data is saved; keep a separate backup.';
    }).catch(showError);
  });
  // Terminating the worker on navigation releases its OPFS handles and Web Lock.
  window.addEventListener('pagehide', () => { void app.close(); }, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
  if (import.meta.hot) import.meta.hot.dispose(() => { void app.close(); });
}

void start().catch(cause => { status.textContent = 'Local database could not be opened.'; showError(cause); });
