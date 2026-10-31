import type { TimestampLike } from '../model/types.ts';

/**
 * Minimal transactional store the services are written against. The production
 * adapter wraps the Firebase Admin SDK; tests use an in-memory fake that
 * enforces Firestore's "all reads before any write" rule.
 */
// Firestore documents are dynamic; domain/service validators narrow them after reading.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional untyped document boundary
export type Doc = Record<string, any>;
export interface Tx {
  get(path: string): Promise<Doc | null>;
  query(collection: string, field: string, value: unknown): Promise<{ id: string; data: Doc }[]>;
  /** Fails the transaction if the document already exists. */
  create(path: string, data: Doc): void;
  set(path: string, data: Doc): void;
  update(path: string, data: Doc): void;
}
export interface Store { runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>; }

export interface Env {
  store: Store;
  /** Server clock. Never sourced from the client. */
  nowMs(): number;
  ts(ms: number): TimestampLike;
  newId(): string;
}

export class ServiceError extends Error {
  status: number;
  code: string;
  detail?: string;
  constructor(status: number, code: string, detail?: string) { super(code); this.status = status; this.code = code; this.detail = detail; }
}
export type Result<T> = ({ ok: true } & T) | { ok: false; status: number; code: string; detail?: string };

export async function guarded<T>(fn: () => Promise<T>): Promise<Result<T extends object ? T : { value: T }>> {
  try {
    const v = await fn();
    return { ok: true, ...(typeof v === 'object' && v !== null ? v : { value: v }) } as never;
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, status: e.status, code: e.code, detail: e.detail };
    throw e;
  }
}
