import { randomUUID } from 'node:crypto';
import { DEFAULT_PACKAGES } from '../packages';
import type { Doc, Env, Store, Tx } from './store';

/** Explicit, process-memory editor sandbox. It is impossible to enable under NODE_ENV=production. */
export const DEV_EDITOR_UID = 'bloomora-local-editor';

export function isEditorDevMode(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.BLOOMORA_DEV_EDITOR === 'true';
}

class DevTimestamp {
  constructor(private readonly ms: number) {}
  toMillis() { return this.ms; }
}

class DevMemoryStore implements Store {
  private docs = new Map<string, Doc>();
  private tail: Promise<void> = Promise.resolve();

  seed(path: string, data: Doc) { this.docs.set(path, data); }

  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const shadow = new Map(this.docs);
      const writes: (() => void)[] = [];
      let wrote = false;
      const requireReadPhase = () => { if (wrote) throw new Error('Dev editor transactions require reads before writes'); };
      const tx: Tx = {
        get: async (path) => { requireReadPhase(); const doc = this.docs.get(path); return doc ? { ...doc } : null; },
        query: async (collection, field, value) => {
          requireReadPhase();
          return [...this.docs].filter(([path, doc]) => path.startsWith(`${collection}/`) && !path.slice(collection.length + 1).includes('/') && doc[field] === value)
            .map(([path, data]) => ({ id: path.slice(collection.length + 1), data: { ...data } }));
        },
        create: (path, data) => { wrote = true; writes.push(() => { if (shadow.has(path)) throw new Error(`ALREADY_EXISTS ${path}`); shadow.set(path, data); }); },
        set: (path, data) => { wrote = true; writes.push(() => { shadow.set(path, data); }); },
        update: (path, data) => { wrote = true; writes.push(() => { const current = shadow.get(path); if (!current) throw new Error(`NOT_FOUND ${path}`); shadow.set(path, { ...current, ...data }); }); },
      };
      const result = await fn(tx);
      for (const write of writes) write();
      this.docs = shadow;
      return result;
    } finally {
      release();
    }
  }
}

type DevEditorState = { env: Env };
type GlobalWithDevEditor = typeof globalThis & { __bloomoraDevEditorState?: DevEditorState };

function createDevEnv(): Env {
  const store = new DevMemoryStore();
  const packageSeed = DEFAULT_PACKAGES.find((item) => item.id === 'basic')!;
  const packageSnapshot = {
    packageId: packageSeed.id,
    name: packageSeed.name,
    priceIdr: packageSeed.priceIdr,
    durationDays: packageSeed.durationDays,
    limits: packageSeed.limits,
  };
  const start = Date.now();
  store.seed('subscriptions/local-editor-basic', {
    userId: DEV_EDITOR_UID,
    packageId: 'basic',
    orderId: 'local-editor-order',
    status: 'active',
    startedAt: new DevTimestamp(start),
    expiresAt: new DevTimestamp(start + 30 * 86_400_000),
    packageSnapshot,
    createdAt: new DevTimestamp(start),
    updatedAt: new DevTimestamp(start),
    schemaVersion: 2,
  });
  return {
    store,
    nowMs: () => Date.now(),
    ts: (ms) => new DevTimestamp(ms),
    newId: () => randomUUID().replaceAll('-', ''),
  };
}

/** Returns the volatile local sandbox env; callers must first check isEditorDevMode(). */
export function getDevEditorEnv(): Env {
  if (!isEditorDevMode()) throw new Error('The in-memory editor is available only in explicit development mode.');
  const processState = globalThis as GlobalWithDevEditor;
  processState.__bloomoraDevEditorState ??= { env: createDevEnv() };
  return processState.__bloomoraDevEditorState.env;
}
