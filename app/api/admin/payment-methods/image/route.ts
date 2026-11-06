import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/session';
import sharp from 'sharp';
import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library';

const BUCKET = 'payment-method-images';
const allowed = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, code: 'sign_in_required' }, { status: 401 });
  if (!user.admin) return NextResponse.json({ ok: false, code: 'admin_required' }, { status: 403 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: 'storage_not_configured' }, { status: 503 });
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, code: 'file_required' }, { status: 400 });
  const extension = allowed.get(file.type);
  if (!extension) return NextResponse.json({ ok: false, code: 'invalid_file_type' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, code: 'file_too_large' }, { status: 400 });
  let normalized: Buffer;
  let qrisDetected = false;
  try {
    const source = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(source, { limitInputPixels: 20_000_000 }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 6000 || metadata.height > 6000) return NextResponse.json({ ok: false, code: 'invalid_image_dimensions' }, { status: 400 });
    const oriented = await sharp(source, { limitInputPixels: 20_000_000 }).rotate().toBuffer();
    const frame = await sharp(oriented).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    try {
      const luminance = new RGBLuminanceSource(new Uint8ClampedArray(frame.data), frame.info.width, frame.info.height);
      const reader = new MultiFormatReader();
      reader.setHints(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]]]));
      const result = reader.decode(new BinaryBitmap(new HybridBinarizer(luminance)));
      const points = result.getResultPoints();
      if (points.length >= 3) qrisDetected = true;
    } catch { /* Detection is informational only; the uploaded image is never cropped. */ }
    // Preserve the full source bounds and quiet zone. Styling belongs outside
    // this image; never crop, trim, redraw, recolor, or stretch QR modules.
    normalized = await sharp(oriented).webp({ quality: 95, effort: 4 }).toBuffer();
  } catch (error) {
    console.warn('[payment-methods] QRIS image processing failed', error instanceof Error ? error.message.slice(0, 200) : 'unknown_error');
    return NextResponse.json({ ok: false, code: 'image_processing_failed' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const path = `payment-methods/${user.uid}/${id}.webp`;
  const { error } = await admin.storage.from(BUCKET).upload(path, normalized, { contentType: 'image/webp', upsert: false, cacheControl: '3600' });
  if (error) {
    console.error('[payment-methods] image upload failed', { code: error.name, message: error.message.slice(0, 300) });
    return NextResponse.json({ ok: false, code: 'payment_method_image_upload_failed' }, { status: 502 });
  }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, path, url: data.publicUrl, contentType: 'image/webp', size: normalized.length, processed: true, qrisDetected });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, code: 'sign_in_required' }, { status: 401 });
  if (!user.admin) return NextResponse.json({ ok: false, code: 'admin_required' }, { status: 403 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, code: 'storage_not_configured' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const path = typeof body.path === 'string' ? body.path : '';
  const prefix = `payment-methods/${user.uid}/`;
  const filename = path.startsWith(prefix) ? path.slice(prefix.length) : '';
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(filename)) return NextResponse.json({ ok: false, code: 'invalid_path' }, { status: 400 });
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error('[payment-methods] image delete failed', { code: error.name, message: error.message.slice(0, 300) });
    return NextResponse.json({ ok: false, code: 'payment_method_image_delete_failed' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
