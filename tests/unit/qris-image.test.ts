import assert from 'node:assert/strict';
import test from 'node:test';
import ZXing from '@zxing/library';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { extractQrisPaymentImage, isQrisPayload, QrisImageError } from '../../lib/server/qris-image.ts';

const { BarcodeFormat, EncodeHintType, QRCodeWriter } = ZXing;

function tlv(tag: string, value: string): string {
  return `${tag}${Buffer.byteLength(value, 'ascii').toString().padStart(2, '0')}${value}`;
}

function crc16(value: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'ascii')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function qrisPayload(): string {
  const fields = [
    tlv('00', '01'), tlv('01', '11'),
    tlv('26', `${tlv('00', 'ID.CO.QRIS.WWW')}${tlv('01', '1234567890123456')}`),
    tlv('52', '5411'), tlv('53', '360'), tlv('58', 'ID'), tlv('59', 'BLOOMORA TEST'), tlv('60', 'JAKARTA'),
  ].join('');
  const body = `${fields}6304`;
  return `${body}${crc16(body)}`;
}

async function qrPng(payload: string, size: number): Promise<Buffer> {
  const matrix = new QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, size, size, new Map([[EncodeHintType.MARGIN, 4]]));
  const width = matrix.getWidth();
  const height = matrix.getHeight();
  const data = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!matrix.get(x, y)) continue;
      const offset = (y * width + x) * 4;
      data[offset] = 0; data[offset + 1] = 0; data[offset + 2] = 0; data[offset + 3] = 255;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function sourceWithQr(left: number, top: number, payload = qrisPayload(), options: { width?: number; height?: number; qrSize?: number; background?: string } = {}): Promise<Buffer> {
  const width = options.width ?? 1100;
  const height = options.height ?? 850;
  const qr = await qrPng(payload, options.qrSize ?? 400);
  const noise = await sharp({ create: { width: 160, height: 60, channels: 4, background: '#754f45' } }).png().toBuffer();
  return sharp({ create: { width, height, channels: 4, background: options.background ?? '#dce8d1' } })
    .composite([{ input: qr, left, top }, { input: noise, left: Math.max(0, width - 180), top: Math.max(0, height - 80) }]).png().toBuffer();
}

async function qrPayloadFromPng(png: Buffer): Promise<string | null> {
  const frame = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(frame.data), frame.info.width, frame.info.height, { inversionAttempts: 'attemptBoth' });
  return result?.data ?? null;
}

test('validates QRIS TLV, Indonesian currency/country, merchant GUI and CRC', () => {
  const payload = qrisPayload();
  assert.equal(isQrisPayload(payload), true);
  assert.equal(isQrisPayload(payload.slice(0, -4) + '0000'), false);
  assert.equal(isQrisPayload('https://example.test/pay'), false);
});

test('crops only the QRIS plus four-module quiet zone across positions, resolutions and source backgrounds', async () => {
  const payload = qrisPayload();
  const cases = [
    { left: 120, top: 105, width: 1100, height: 850, qrSize: 400, background: '#dce8d1' },
    { left: 540, top: 305, width: 1100, height: 850, qrSize: 400, background: '#dce8d1' },
    { left: 65, top: 80, width: 640, height: 480, qrSize: 250, background: '#f3d8ac' },
    { left: 990, top: 160, width: 1700, height: 1150, qrSize: 560, background: '#dedff5' },
  ];
  for (const placement of cases) {
    const source = await sourceWithQr(placement.left, placement.top, payload, placement);
    const result = await extractQrisPaymentImage(source);
    const metadata = await sharp(result.png).metadata();
    assert.ok(metadata.width && metadata.width < placement.qrSize + 80, 'crop should be much smaller than the full source image');
    assert.equal(metadata.width, metadata.height, 'QRIS crop remains square');
    assert.equal(await qrPayloadFromPng(result.png), payload, 'lossless crop must decode to the unchanged source payload');
    const frame = await sharp(result.png).raw().toBuffer({ resolveWithObject: true });
    const corner = (0 * frame.info.width + 0) * frame.info.channels;
    assert.ok(frame.data[corner] > 230 && frame.data[corner + 1] > 230 && frame.data[corner + 2] > 230, 'quiet zone remains light at the crop boundary');
  }
});

test('manual crop narrows a busy source before QR location and still extracts only the QR', async () => {
  const payload = qrisPayload();
  const source = await sourceWithQr(330, 175);
  const result = await extractQrisPaymentImage(source, { x: 0.2, y: 0.1, width: 0.6, height: 0.75 });
  assert.equal(await qrPayloadFromPng(result.png), payload);
});

test('rejects generic QR payloads and malformed manual regions without producing a crop', async () => {
  const generic = await sourceWithQr(200, 160, 'https://example.test/payment');
  await assert.rejects(extractQrisPaymentImage(generic), (error: unknown) => error instanceof QrisImageError && error.code === 'qris_payload_invalid');
  const source = await sourceWithQr(200, 160);
  await assert.rejects(extractQrisPaymentImage(source, { x: 0.9, y: 0.2, width: 0.3, height: 0.3 }), (error: unknown) => error instanceof QrisImageError && error.code === 'invalid_manual_crop');
});
