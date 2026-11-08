import type { GiftContent } from '../model/types';

export type AutosaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';
export type AutosaveResult = { ok: true; version: number } | { ok: false; code: string };

/** Debounced, single-flight draft writer. Conflicts are never retried against a guessed version. */
export class DraftAutosaver {
  private version: number;
  private readonly options: {
    initialVersion: number;
    delayMs?: number;
    save: (content: GiftContent, expectedVersion: number) => Promise<AutosaveResult>;
    onStatus: (status: AutosaveStatus, code?: string) => void;
    onVersion?: (version: number) => void;
  };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: GiftContent | null = null;
  private blockedCode: string | null = null;
  private saving = false;
  private disposed = false;

  constructor(options: DraftAutosaver['options']) {
    this.options = options;
    this.version = options.initialVersion;
  }

  get currentVersion() { return this.version; }
  get hasPendingChanges() { return this.pending !== null || this.saving; }

  update(content: GiftContent) {
    if (this.disposed) return;
    this.pending = content;
    if (this.blockedCode && this.blockedCode !== 'version_conflict') this.blockedCode = null;
    this.options.onStatus('dirty');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.options.delayMs ?? 650);
  }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.saving || this.disposed || !this.pending || this.blockedCode === 'version_conflict') return;
    this.saving = true;
    try {
      while (this.pending && !this.disposed) {
        const snapshot = this.pending;
        this.pending = null;
        this.options.onStatus('saving');
        let result: AutosaveResult;
        try {
          result = await this.options.save(snapshot, this.version);
        } catch {
          result = { ok: false, code: 'network_error' };
        }
        if (!result.ok) {
          this.pending = this.pending ?? snapshot;
          this.blockedCode = result.code;
          this.options.onStatus(result.code === 'version_conflict' ? 'conflict' : 'error', result.code);
          return;
        }
        this.version = result.version;
        this.options.onVersion?.(result.version);
      }
      if (!this.disposed) this.options.onStatus('saved');
    } finally {
      this.saving = false;
    }
  }

  /** Retry transient failures only. A 409 must be reconciled with a fresh server read first. */
  retry() {
    if (this.blockedCode === 'version_conflict') return this.flush();
    this.blockedCode = null;
    return this.flush();
  }

  /** Called after an explicit reload/reconciliation from the server. */
  reset(version: number) {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.pending = null;
    this.blockedCode = null;
    this.version = version;
    this.options.onVersion?.(version);
    this.options.onStatus('saved');
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
