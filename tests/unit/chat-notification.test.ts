import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldNotifyChatReply } from '../../lib/chat-notification.ts';

test('chat sound only opts in once a non-empty successful reply is complete', () => {
  const base = { soundEnabled: true, responseOk: true, replyText: 'Balasan selesai.', alreadyNotified: false };
  assert.equal(shouldNotifyChatReply(base), true);
  assert.equal(shouldNotifyChatReply({ ...base, soundEnabled: false }), false);
  assert.equal(shouldNotifyChatReply({ ...base, responseOk: false }), false);
  assert.equal(shouldNotifyChatReply({ ...base, replyText: '  ' }), false);
  assert.equal(shouldNotifyChatReply({ ...base, replyText: null }), false);
  assert.equal(shouldNotifyChatReply({ ...base, alreadyNotified: true }), false);
});
