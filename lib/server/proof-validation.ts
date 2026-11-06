const SIGNATURES = {
  'image/jpeg': (bytes: Uint8Array) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes: Uint8Array) => bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]),
  'image/webp': (bytes: Uint8Array) => bytes.length >= 12 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 12) === 'WEBP',
  'application/pdf': (bytes: Uint8Array) => bytes.length >= 5 && text(bytes, 0, 5) === '%PDF-',
} as const;

function text(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

export function proofSignatureMatches(contentType: string, bytes: Uint8Array): boolean {
  const check = SIGNATURES[contentType as keyof typeof SIGNATURES];
  return typeof check === 'function' && check(bytes);
}
