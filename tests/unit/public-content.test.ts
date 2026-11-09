import assert from 'node:assert/strict';
import test from 'node:test';
import { publicPresentationContent } from '../../lib/model/public-content.ts';
import type { GiftContent } from '../../lib/model/types.ts';

const content: GiftContent = {
  fields: { title: 'Garden', pinCode: '583941', closingLine: 'A private line', signature: 'A.', recipientName: 'M.' },
  sections: ['opening', 'closing'],
  data: { moments: [] },
  media: [],
};

test('public garden content removes the PIN and protected note from public snapshots', () => {
  const safe = publicPresentationContent('interactive-flower-adventure', content);
  assert.deepEqual(safe.fields, { title: 'Garden', recipientName: 'M.' });
  assert.deepEqual(content.fields, { title: 'Garden', pinCode: '583941', closingLine: 'A private line', signature: 'A.', recipientName: 'M.' }, 'private revision source remains unchanged');
  assert.deepEqual(safe.sections, content.sections);
  assert.deepEqual(safe.data, content.data);
});

test('public presentation content preserves content for unrelated templates', () => {
  assert.strictEqual(publicPresentationContent('for-you-scrapbook', content), content);
});
