import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/session';
import { extractQrisPaymentImage, QrisImageError, type NormalizedCrop } from '@/lib/server/qris-image';
import sharp from 'sharp';
import type { Metadata as SharpMetadata } from 'sharp';

const BUCKET = 'payment-method-images';
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host')); }
  catch { return false; }
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function manualCropFrom(form: FormData): NormalizedCrop | null {
  const value = form.get('manualCrop');
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 500) throw new QrisImageError('invalid_manual_crop');
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number' || typeof parsed.width !== 'number' || typeof parsed.height !== 'number') throw new Error('invalid');
    return { x: parsed.x, y: parsed.y, width: parsed.width, height: parsed.height };
  } catch { throw new QrisImageError('invalid_manual_crop'); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ ok: false, code: 'bad_origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ ok: false, code: 'sign_in_required' }, 401);
  if (!user.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 256 * 1024) return json({ ok: false, code: 'file_too_large' }, 413);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, code: 'invalid_form_data' }, 400);
  const file = form.get('file');
  if (!(file instanceof File)) return json({ ok: false, code: 'file_required' }, 400);
  if (!allowed.has(file.type)) return json({ ok: false, code: 'invalid_file_type' }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ ok: false, code: 'file_too_large' }, 400);

  const mode = form.get('mode') === 'preview' ? 'preview' : 'save';
  const paymentType = form.get('paymentType') === 'qris' ? 'qris' : 'other';
  if (mode === 'preview' && paymentType !== 'qris') return json({ ok: false, code: 'invalid_preview_mode' }, 400);
  let content: Buffer;
  let contentType: 'image/webp' | 'image/png';
  let extension: 'webp' | 'png';
  try {
    const source = Buffer.from(await file.arrayBuffer());
    if (paymentType === 'qris') {
      const extraction = await extractQrisPaymentImage(source, manualCropFrom(form));
      content = extraction.png;
      contentType = 'image/png';
      extension = 'png';
      if (mode === 'preview') {
        return json({
          ok: true, verified: true, qrisDetectionStatus: 'confirmed',
          previewDataUrl: `data:image/png;base64,${content.toString('base64')}`,
          width: extraction.width, height: extraction.height, size: content.length,
        });
      }
    } else {
      let metadata: SharpMetadata;
      try { metadata = await sharp(source, { limitInputPixels: 20_000_000 }).metadata(); }
      catch { return json({ ok: false, code: 'image_processing_failed' }, 400); }
      if (!metadata.width || !metadata.height || metadata.width > 6000 || metadata.height > 6000 || metadata.width * metadata.height > 20_000_000) {
        return json({ ok: false, code: 'invalid_image_dimensions' }, 400);
      }
      content = await sharp(source, { limitInputPixels: 20_000_000 }).rotate().webp({ quality: 95, effort: 4 }).toBuffer();
      contentType = 'image/webp';
      extension = 'webp';
    }
  } catch (error) {
    const code = error instanceof QrisImageError ? error.code : 'image_processing_failed';
    const status = code === 'image_processing_failed' || code === 'invalid_image_dimensions' ? 400 : 422;
    return json({ ok: false, code }, status);
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return json({ ok: false, code: 'storage_not_configured' }, 503);
  const id = crypto.randomUUID();
  const path = paymentType === 'qris'
    ? `payment-methods/${user.uid}/qris/${id}.png`
    : `payment-methods/${user.uid}/${id}.${extension}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, content, { contentType, upsert: false, cacheControl: '3600' });
  if (error) {
    console.error('[payment-methods] image upload failed', { code: error.name, message: error.message.slice(0, 300) });
    return json({ ok: false, code: 'payment_method_image_upload_failed' }, 502);
  }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return json({
    ok: true, path, url: data.publicUrl, contentType, size: content.length, processed: true,
    ...(paymentType === 'qris' ? { qrisDetectionStatus: 'confirmed' } : {}),
  });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ ok: false, code: 'bad_origin' }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ ok: false, code: 'sign_in_required' }, 401);
  if (!user.admin) return json({ ok: false, code: 'admin_required' }, 403);
  const admin = createSupabaseAdminClient();
  if (!admin) return json({ ok: false, code: 'storage_not_configured' }, 503);
  const body = await request.json().catch(() => ({}));
  const path = typeof body.path === 'string' ? body.path : '';
  const prefix = `payment-methods/${user.uid}/`;
  const filename = path.startsWith(prefix) ? path.slice(prefix.length) : '';
  const ordinaryImage = new RegExp(`^${UUID}\\.(jpg|png|webp)$`, 'i').test(filename);
  const verifiedQrisImage = new RegExp(`^qris/${UUID}\\.png$`, 'i').test(filename);
  if (!ordinaryImage && !verifiedQrisImage) return json({ ok: false, code: 'invalid_path' }, 400);
  const { error } = await admin.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error('[payment-methods] image delete failed', { code: error.name, message: error.message.slice(0, 300) });
    return json({ ok: false, code: 'payment_method_image_delete_failed' }, 502);
  }
  return json({ ok: true });
}
