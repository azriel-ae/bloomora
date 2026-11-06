export function shouldNotifyChatReply(input: {
  soundEnabled: boolean;
  responseOk: boolean;
  replyText: unknown;
  alreadyNotified: boolean;
}): boolean {
  return input.soundEnabled
    && input.responseOk
    && typeof input.replyText === 'string'
    && input.replyText.trim().length > 0
    && !input.alreadyNotified;
}
