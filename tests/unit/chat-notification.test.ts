import assert from 'node:assert/strict';
import test from 'node:test';
import { playChatNotificationSound, shouldNotifyChatReply } from '../../lib/chat-notification.ts';

test('chat sound is mandatory once for each non-empty successful completed reply', () => {
  const base = { responseOk: true, replyText: 'Balasan selesai.', alreadyNotified: false };
  assert.equal(shouldNotifyChatReply(base), true);
  assert.equal(shouldNotifyChatReply({ ...base, responseOk: false }), false);
  assert.equal(shouldNotifyChatReply({ ...base, replyText: '  ' }), false);
  assert.equal(shouldNotifyChatReply({ ...base, replyText: null }), false);
  assert.equal(shouldNotifyChatReply({ ...base, alreadyNotified: true }), false);
});

test('chat notification uses two clear notes at a substantially louder, unclipped gain', () => {
  const peaks: number[] = [];
  const frequencies: number[] = [];
  let started = 0;
  const context = {
    state: 'running', currentTime: 2, destination: {},
    createOscillator() {
      return { type: 'sine', frequency: { setValueAtTime(value: number) { frequencies.push(value); } }, connect() {}, start() { started++; }, stop() {} };
    },
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime(value: number) { if (value > 0.001) peaks.push(value); } }, connect() {} };
    },
  } as unknown as AudioContext;
  assert.equal(playChatNotificationSound(context), true);
  assert.deepEqual(frequencies, [740, 988]);
  assert.deepEqual(peaks, [0.22, 0.22]);
  assert.equal(started, 2);
});

test('chat notification does not schedule audio while AudioContext is suspended', () => {
  let created = false;
  const context = { state: 'suspended', currentTime: 0, destination: {}, createOscillator() { created = true; throw new Error('must not run'); }, createGain() { throw new Error('must not run'); } } as unknown as AudioContext;
  assert.equal(playChatNotificationSound(context), false);
  assert.equal(created, false);
});
