import type { Doc, Env, Store, Tx } from '../../../lib/server/store.ts';

export class Ts { ms: number; constructor(ms: number) { this.ms = ms; } toMillis() { return this.ms; } }

/** In-memory store mimicking Firestore transaction rules: reads before writes, create() fails if present. */
export class FakeStore implements Store {
  docs = new Map<string, Doc>();
  async runTransaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const writes: (() => void)[] = [];
    let wrote = false;
    const shadow = new Map(this.docs);
    const requireNoWrite = () => { if (wrote) throw new Error('Firestore transactions require all reads before writes'); };
    const tx: Tx = {
      get: async (p) => { requireNoWrite(); const d = this.docs.get(p); return d ? { ...d } : null; },
      query: async (c, f, v) => {
        requireNoWrite();
        return [...this.docs].filter(([p, d]) => p.startsWith(c + '/') && !p.slice(c.length + 1).includes('/') && d[f] === v)
          .map(([p, d]) => ({ id: p.slice(c.length + 1), data: { ...d } }));
      },
      create: (p, d) => { wrote = true; writes.push(() => { if (shadow.has(p)) throw new Error('ALREADY_EXISTS ' + p); shadow.set(p, d); }); },
      set: (p, d) => { wrote = true; writes.push(() => { shadow.set(p, d); }); },
      update: (p, d) => { wrote = true; writes.push(() => { const cur = shadow.get(p); if (!cur) throw new Error('NOT_FOUND ' + p); shadow.set(p, { ...cur, ...d }); }); },
    };
    const result = await fn(tx);
    for (const w of writes) w(); // throws before commit => nothing applied
    this.docs = shadow;
    return result;
  }
}

export function makeEnv(start: number) {
  const store = new FakeStore();
  let now = start; let n = 0;
  const env: Env = { store, nowMs: () => now, ts: (ms) => new Ts(ms), newId: () => `id${++n}` };
  return { env, store, advance: (ms: number) => { now += ms; }, setNow: (ms: number) => { now = ms; } };
}
