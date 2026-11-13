import { SadyError } from './errors';
import type { Operation, Operations, Response } from './types';

/** Private typed RPC; raw SQL never crosses the worker boundary. */
export class DatabaseClient {
  private readonly worker = new Worker(new URL('./db/worker.ts', import.meta.url), { type: 'module' });
  private sequence = 0;
  private closed = false;
  private closing: Promise<void> | undefined;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: unknown) => void }>();

  constructor() {
    this.worker.onmessage = (event: MessageEvent<Response>) => {
      const response = event.data;
      const request = this.pending.get(response.id);
      if (!request) return;
      this.pending.delete(response.id);
      if (response.ok) request.resolve(response.value);
      else request.reject(new SadyError(response.error.code, response.error.message));
    };
    this.worker.onerror = event => this.stop(new SadyError('WORKER_ERROR', event.message || 'SQLite worker failed.'));
    this.worker.onmessageerror = () => this.stop(new SadyError('WORKER_ERROR', 'Could not decode a SQLite worker response.'));
  }

  request<K extends Operation>(method: K, input: Operations[K]['input']): Promise<Operations[K]['output']> {
    if (this.closed || this.closing) return Promise.reject(new SadyError('CLOSED', 'Database client is closed.'));
    return this.send(method, input);
  }

  private send<K extends Operation>(method: K, input: Operations[K]['input']): Promise<Operations[K]['output']> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: value => resolve(value as Operations[K]['output']), reject });
      try { this.worker.postMessage({ id, method, input }); }
      catch (cause) { this.pending.delete(id); reject(cause); }
    });
  }

  private stop(error: SadyError): void {
    this.closed = true;
    this.worker.terminate();
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    if (this.closed) return Promise.resolve();
    this.closing = this.send('close', undefined).finally(() => this.stop(new SadyError('CLOSED', 'Database client is closed.')));
    return this.closing;
  }

  /** Only for failed initialization: prevent a worker/lock leak. */
  abort(): void { this.stop(new SadyError('CLOSED', 'Database initialization failed.')); }
}
