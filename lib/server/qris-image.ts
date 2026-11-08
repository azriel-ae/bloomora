import jsQR, { type QRCode } from 'jsqr';
import sharp from 'sharp';
import type { Metadata as SharpMetadata } from 'sharp';

export type NormalizedCrop = { x: number; y: number; width: number; height: number };
export type QrisImageResult = { png: Buffer; width: number; height: number };

export class QrisImageError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

const MAX_PIXELS = 20_000_000;
const MAX_DIMENSION = 6000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

function parseTlv(payload: string): Array<{ tag: string; value: string }> | null {
  const entries: Array<{ tag: string; value: string }> = [];
  let offset = 0;
  while (offset < payload.length) {
    if (offset + 4 > payload.length) return null;
    const tag = payload.slice(offset, offset + 2);
    const lengthText = payload.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) return null;
    const length = Number(lengthText);
    offset += 4;
    if (offset + length > payload.length) return null;
    entries.push({ tag, value: payload.slice(offset, offset + length) });
    offset += length;
  }
  return entries;
}

function crc16Ccitt(value: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, 'ascii')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Validate an EMVCo payload for Indonesian QRIS without changing its bytes. */
export function isQrisPayload(payload: string): boolean {
  if (payload.length < 40 || payload.length > 4096 || !/^[\x20-\x7e]+$/.test(payload)) return false;
  const entries = parseTlv(payload);
  if (!entries || entries.length < 8) return false;
  const last = entries[entries.length - 1];
  if (last.tag !== '63' || last.value.length !== 4 || !/^[0-9A-F]{4}$/i.test(last.value)) return false;
  const checksumInput = payload.slice(0, -4);
  if (crc16Ccitt(checksumInput) !== last.value.toUpperCase()) return false;
  const all = (tag: string) => entries.filter((entry) => entry.tag === tag).map((entry) => entry.value);
  if (!all('00').includes('01') || !all('53').includes('360') || !all('58').includes('ID')) return false;
  if (!all('01').some((value) => value === '11' || value === '12')) return false;
  if (!all('59').some((value) => value.trim().length > 0)) return false;
  const merchantAccounts = entries.filter((entry) => /^2[6-9]$|^[3-4]\d$|^5[01]$/.test(entry.tag));
  return merchantAccounts.some((account) => {
    const nested = parseTlv(account.value);
    if (!nested) return false;
    return nested.some((entry) => entry.tag === '00' && (entry.value === 'ID.CO.QRIS.WWW' || entry.value === 'A000000677010111'));
  });
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function qrGeometry(qr: QRCode, width: number, height: number) {
  const { topLeftCorner: tl, topRightCorner: tr, bottomRightCorner: br, bottomLeftCorner: bl } = qr.location;
  const edges = [distance(tl, tr), distance(tr, br), distance(br, bl), distance(bl, tl)];
  const side = edges.reduce((sum, edge) => sum + edge, 0) / edges.length;
  const diagonalU = { x: tr.x - tl.x, y: tr.y - tl.y };
  const diagonalV = { x: bl.x - tl.x, y: bl.y - tl.y };
  const lengthU = Math.hypot(diagonalU.x, diagonalU.y);
  const lengthV = Math.hypot(diagonalV.x, diagonalV.y);
  const axisAligned = lengthU > 0 && lengthV > 0
    && Math.min(Math.abs(diagonalU.x), Math.abs(diagonalU.y)) / lengthU <= 0.08
    && Math.min(Math.abs(diagonalV.x), Math.abs(diagonalV.y)) / lengthV <= 0.08
    && Math.abs((diagonalU.x * diagonalV.x + diagonalU.y * diagonalV.y) / (lengthU * lengthV)) <= 0.15;
  if (!axisAligned || !Number.isFinite(side) || side <= 0 || Math.max(...edges) / Math.min(...edges) > 1.18) {
    throw new QrisImageError('qris_alignment_unsupported');
  }
  const modules = 17 + 4 * qr.version;
  const moduleSize = side / modules;
  const quiet = moduleSize * 4;
  const points = [tl, tr, br, bl];
  const left = Math.floor(Math.min(...points.map((point) => point.x)) - quiet);
  const top = Math.floor(Math.min(...points.map((point) => point.y)) - quiet);
  const right = Math.ceil(Math.max(...points.map((point) => point.x)) + quiet);
  const bottom = Math.ceil(Math.max(...points.map((point) => point.y)) + quiet);
  if (left < 0 || top < 0 || right > width || bottom > height) throw new QrisImageError('qris_quiet_zone_missing');
  const cropWidth = right - left;
  const cropHeight = bottom - top;
  if (cropWidth < modules || cropHeight < modules || Math.abs(cropWidth - cropHeight) > 2) {
    throw new QrisImageError('qris_alignment_unsupported');
  }
  const codeLeft = Math.min(...points.map((point) => point.x)) - left;
  const codeTop = Math.min(...points.map((point) => point.y)) - top;
  const codeRight = Math.max(...points.map((point) => point.x)) - left;
  const codeBottom = Math.max(...points.map((point) => point.y)) - top;
  return { left, top, width: cropWidth, height: cropHeight, codeLeft, codeTop, codeRight, codeBottom, moduleSize };
}

function quietZoneLooksClear(frame: { data: Buffer; info: { width: number; height: number; channels: number } }, geometry: ReturnType<typeof qrGeometry>): boolean {
  const { data, info } = frame;
  const x0 = Math.max(0, Math.floor(geometry.codeLeft));
  const y0 = Math.max(0, Math.floor(geometry.codeTop));
  const x1 = Math.min(info.width, Math.ceil(geometry.codeRight));
  const y1 = Math.min(info.height, Math.ceil(geometry.codeBottom));
  const bands: Array<[number, number, number, number]> = [
    [x0, 0, x1, y0], [x0, y1, x1, info.height], [0, y0, x0, y1], [x1, y0, info.width, y1],
  ];
  let pixels = 0;
  let darkPixels = 0;
  for (const [left, top, right, bottom] of bands) {
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * info.width + x) * info.channels;
        const r = data[index] ?? 255;
        const g = data[index + 1] ?? r;
        const b = data[index + 2] ?? r;
        const alpha = info.channels >= 4 ? (data[index + 3] ?? 255) / 255 : 1;
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) * alpha + 255 * (1 - alpha);
        pixels += 1;
        if (luminance < 150) darkPixels += 1;
      }
    }
  }
  return pixels > 0 && darkPixels / pixels <= 0.01;
}

function normalizedCropRect(crop: NormalizedCrop, width: number, height: number) {
  const values = [crop.x, crop.y, crop.width, crop.height];
  if (!values.every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1 || crop.y + crop.height > 1 || crop.width < 0.08 || crop.height < 0.08) {
    throw new QrisImageError('invalid_manual_crop');
  }
  const left = Math.floor(crop.x * width);
  const top = Math.floor(crop.y * height);
  const right = Math.ceil((crop.x + crop.width) * width);
  const bottom = Math.ceil((crop.y + crop.height) * height);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Detect a single QRIS payload, keep the original module pixels, crop only its
 * square code and source quiet zone, then decode the lossless PNG again and
 * require its payload to exactly match the original source decode.
 */
export async function extractQrisPaymentImage(source: Buffer, manualCrop?: NormalizedCrop | null): Promise<QrisImageResult> {
  let normalized: Buffer;
  let metadata: SharpMetadata;
  try {
    normalized = await sharp(source, { limitInputPixels: MAX_PIXELS }).rotate().png({ compressionLevel: 9, effort: 8 }).toBuffer();
    metadata = await sharp(normalized).metadata();
  } catch { throw new QrisImageError('image_processing_failed'); }
  if (!metadata.width || !metadata.height || metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || metadata.width * metadata.height > MAX_PIXELS) {
    throw new QrisImageError('invalid_image_dimensions');
  }
  let working = normalized;
  if (manualCrop) {
    const rect = normalizedCropRect(manualCrop, metadata.width, metadata.height);
    try { working = await sharp(normalized).extract(rect).png({ compressionLevel: 9, effort: 8 }).toBuffer(); }
    catch { throw new QrisImageError('invalid_manual_crop'); }
  }
  const frame = await sharp(working).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const detected = jsQR(new Uint8ClampedArray(frame.data), frame.info.width, frame.info.height, { inversionAttempts: 'attemptBoth' });
  if (!detected) throw new QrisImageError('qris_not_found');
  if (!isQrisPayload(detected.data)) throw new QrisImageError('qris_payload_invalid');
  const geometry = qrGeometry(detected, frame.info.width, frame.info.height);
  let crop = await sharp(working).extract({ left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height }).png({ compressionLevel: 9, effort: 8 }).toBuffer();
  if (geometry.width !== geometry.height) {
    crop = await sharp(crop).extend({
      right: Math.max(0, geometry.height - geometry.width),
      bottom: Math.max(0, geometry.width - geometry.height),
      background: '#ffffff',
    }).png({ compressionLevel: 9, effort: 8 }).toBuffer();
  }
  if (crop.length > MAX_OUTPUT_BYTES) throw new QrisImageError('qris_crop_too_large');
  const croppedFrame = await sharp(crop).toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!quietZoneLooksClear(croppedFrame, geometry)) throw new QrisImageError('qris_quiet_zone_unclear');
  const redecoded = jsQR(new Uint8ClampedArray(croppedFrame.data), croppedFrame.info.width, croppedFrame.info.height, { inversionAttempts: 'attemptBoth' });
  if (!redecoded || redecoded.data !== detected.data || !isQrisPayload(redecoded.data)) throw new QrisImageError('qris_crop_validation_failed');
  const outputMetadata = await sharp(crop).metadata();
  return { png: crop, width: outputMetadata.width ?? geometry.width, height: outputMetadata.height ?? geometry.height };
}
