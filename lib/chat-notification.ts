export function shouldNotifyChatReply(input: {
  responseOk: boolean;
  replyText: unknown;
  alreadyNotified: boolean;
}): boolean {
  return input.responseOk
    && typeof input.replyText === 'string'
    && input.replyText.trim().length > 0
    && !input.alreadyNotified;
}

/**
 * Play a clear, short two-note notification. Web Audio gain is linear: the old
 * 0.035 peak was about 16 dB quieter than this 0.22 peak and was easy to miss.
 * The new peak remains below 0.25 to leave ample headroom from clipping.
 */
export function playChatNotificationSound(context: Pick<AudioContext, 'state' | 'currentTime' | 'destination' | 'createOscillator' | 'createGain'>): boolean {
  if (context.state !== 'running') return false;
  const notes = [
    { frequency: 740, offset: 0, duration: 0.16 },
    { frequency: 988, offset: 0.19, duration: 0.22 },
  ];
  try {
    for (const note of notes) {
      const start = context.currentTime + note.offset;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(note.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + note.duration + 0.01);
    }
    return true;
  } catch {
    return false;
  }
}
