/**
 * Public gift slugs: 12 characters from a 31-symbol alphabet (about 59 bits),
 * generated with a CSPRNG and rejection sampling. They contain no user id and
 * cannot be derived from one. Uniqueness is enforced by creating
 * `slugs/{slug}` with `create()` inside a transaction (server side).
 */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no i, l, o, 0, 1
export const SLUG_LENGTH = 12;
const SLUG_PATTERN = new RegExp(`^[${ALPHABET}]{${SLUG_LENGTH}}$`);

/** Routes that must never be claimed as a slug-like token. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(['demo']);

export function generateSlug(random: (n: number) => Uint8Array = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < SLUG_LENGTH) {
    for (const byte of random(SLUG_LENGTH * 2)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === SLUG_LENGTH) break;
    }
  }
  return out;
}

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG_PATTERN.test(value) && !RESERVED_SLUGS.has(value);
}
