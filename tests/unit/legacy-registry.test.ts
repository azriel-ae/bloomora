import test from 'node:test';
import assert from 'node:assert/strict';
import { templates as legacy } from '../../lib/templates.ts';
import { listCatalog } from '../../lib/engine/registry.ts';

// lib/templates.ts still feeds the current catalog/editor pages until they move to the engine.
// This keeps the two from drifting in the meantime; delete this test with lib/templates.ts.
test('every legacy template exists in the engine with the same slug', () => {
  const ids = new Set(listCatalog().map((t) => t.id));
  for (const t of legacy) assert.ok(ids.has(t.slug), `${t.slug} missing from engine`);
});
