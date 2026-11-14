export type ErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'STORAGE_UNAVAILABLE' | 'DATABASE_BUSY'
  | 'DATABASE_ERROR' | 'WORKER_ERROR' | 'CLOSED' | 'NETWORK' | 'SOURCE_ERROR';

export class SadyError extends Error {
  constructor(public readonly code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SadyError';
  }
}

export function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new SadyError('VALIDATION', message);
}
