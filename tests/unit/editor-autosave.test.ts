import test from 'node:test';
import assert from 'node:assert/strict';
import type { GiftContent } from '../../lib/model/types.ts';
import { DraftAutosaver, type AutosaveStatus } from '../../lib/editor/autosave.ts';

const content = (title: string): GiftContent => ({ fields: { title }, sections: ['opening'], data: {}, media: [] });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('autosave coalesces quick edits and advances expectedVersion only after success', async () => {
  const writes: { title: string; version: number }[] = [];
  const statuses: AutosaveStatus[] = [];
  const saver = new DraftAutosaver({
    initialVersion: 4,
    delayMs: 20,
    save: async (draft, expectedVersion) => {
      writes.push({ title: draft.fields.title, version: expectedVersion });
      return { ok: true, version: expectedVersion + 1 };
    },
    onStatus: (status) => statuses.push(status),
  });
  saver.update(content('one'));
  saver.update(content('two'));
  await wait(50);
  assert.deepEqual(writes, [{ title: 'two', version: 4 }]);
  assert.equal(saver.currentVersion, 5);
  assert.equal(statuses.at(-1), 'saved');
  saver.dispose();
});

test('autosave serializes edits made during a request and blocks a conflict until server reconciliation', async () => {
  const writes: { title: string; version: number }[] = [];
  const statuses: { status: AutosaveStatus; code?: string }[] = [];
  let releaseFirst!: () => void;
  const firstPending = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const saver = new DraftAutosaver({
    initialVersion: 1,
    delayMs: 5,
    save: async (draft, expectedVersion) => {
      writes.push({ title: draft.fields.title, version: expectedVersion });
      if (draft.fields.title === 'one') {
        await firstPending;
        return { ok: true, version: 2 };
      }
      return { ok: false, code: 'version_conflict' };
    },
    onStatus: (status, code) => statuses.push({ status, code }),
  });
  saver.update(content('one'));
  await wait(10);
  saver.update(content('two'));
  await wait(10);
  releaseFirst();
  await wait(20);
  assert.deepEqual(writes, [{ title: 'one', version: 1 }, { title: 'two', version: 2 }]);
  assert.equal(statuses.at(-1)?.status, 'conflict');
  await saver.retry();
  assert.equal(writes.length, 2, 'a conflict is not retried using a guessed version');
  saver.reset(7);
  assert.equal(saver.currentVersion, 7);
  assert.equal(statuses.at(-1)?.status, 'saved');
  saver.dispose();
});
