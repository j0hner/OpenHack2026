import { SadyError } from '../errors';
import { MAX_IMPORT_BYTES } from '../validation';

/** Bounded simple CORS GET: no credentials, proxy or custom headers. */
export async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(20_000);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: combined });
    if (!response.ok) throw new SadyError('NETWORK', `Source returned HTTP ${response.status}.`);
    if (!response.body) throw new SadyError('SOURCE_ERROR', 'Source response has no body.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, json = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_IMPORT_BYTES) {
          await reader.cancel();
          throw new SadyError('SOURCE_ERROR', 'Source response exceeds 10 MiB. Request a smaller area or time range.');
        }
        json += decoder.decode(value, { stream: true });
      }
    } finally { reader.releaseLock(); }
    json += decoder.decode();
    try { return JSON.parse(json) as unknown; }
    catch (cause) { throw new SadyError('SOURCE_ERROR', 'Source returned invalid JSON.', { cause }); }
  } catch (cause) {
    if (cause instanceof SadyError) throw cause;
    if (combined.aborted) throw new SadyError('NETWORK', signal?.aborted ? 'Data request cancelled.' : 'Data request timed out.', { cause });
    throw new SadyError('NETWORK', 'Could not fetch source data. Check connectivity and source CORS support; previously imported data remains available.', { cause });
  }
}
