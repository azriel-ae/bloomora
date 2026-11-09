import type { GiftContent } from './types.ts';

/**
 * Returns only presentation-safe content for the publicly readable snapshot.
 * The immutable gift revision remains private and is used by the server-side PIN unlock route.
 */
export function publicPresentationContent(templateId: string, content: GiftContent): GiftContent {
  if (templateId !== 'interactive-flower-adventure') return content;
  const fields = { ...content.fields };
  delete fields.pinCode;
  delete fields.closingLine;
  delete fields.signature;
  return { ...content, fields };
}
