import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getGuestOrderOwnerForProof, saveGuestPaymentProofAnalysis, submitGuestPaymentProof } from '@/lib/server/guest-services';
import { analyzePaymentProof } from '@/lib/server/proof-ai';
import { autoApproveGuestPaymentProof } from '@/lib/server/services';
import { getServerEnv } from '@/lib/server/runtime';
import { proofSignatureMatches } from '@/lib/server/proof-validation';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['application/pdf', 'pdf']]);
const privateJson = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status, headers: { 'cache-control': 'private, no-store' } });

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const env = getServerEnv();
  const storage = createSupabaseAdminClient();
  if (!env || !storage) return privateJson(503, { ok: false, code: 'storage_not_configured' });
  const { orderId } = await params;
  const accessToken = request.headers.get('x-bloomora-order-token');
  const owner = await getGuestOrderOwnerForProof(env, orderId, accessToken);
  if (!owner.ok) return privateJson(owner.status, owner);
  const form = await request.formData().catch(() => null);
  const file = form?.get('proof');
  if (!(file instanceof File)) return privateJson(400, { ok: false, code: 'proof_required' });
  if (file.size < 1 || file.size > MAX_BYTES) return privateJson(400, { ok: false, code: 'invalid_proof_size' });
  const extension = TYPES.get(file.type);
  if (!extension) return privateJson(400, { ok: false, code: 'invalid_proof_type' });
  const path = `paymentProofs/${owner.ownerUid}/${orderId}/${randomUUID()}.${extension}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!proofSignatureMatches(file.type, buffer)) return privateJson(415, { ok: false, code: 'proof_signature_mismatch' });
    const fileSha256 = createHash('sha256').update(buffer).digest('hex');
    const { error: uploadError } = await storage.storage.from('payment-proofs').upload(path, buffer, { contentType: file.type, cacheControl: '0', upsert: false });
    if (uploadError) throw uploadError;
    const result = await submitGuestPaymentProof(env, orderId, accessToken, { storagePath: path, contentType: file.type, sizeBytes: file.size, fileSha256 });
    if (!result.ok) {
      await storage.storage.from('payment-proofs').remove([path]).catch(() => undefined);
      return privateJson(result.status, result);
    }
    let aiReview: unknown = 'unavailable_manual_review';
    try {
      const analysis = await analyzePaymentProof(buffer, file.type, { amountIdr: owner.expectedAmountIdr, paymentMethod: owner.paymentMethod });
      const savedAnalysis = await saveGuestPaymentProofAnalysis(env, orderId, accessToken, path, analysis);
      aiReview = analysis.state === 'analyzed' ? 'manual_review' : analysis.state;
      if (savedAnalysis.ok && analysis.state === 'analyzed') {
        const autoReview = await autoApproveGuestPaymentProof(env, orderId);
        if (autoReview.ok) aiReview = autoReview.status;
      }
    } catch (error) {
      console.error('[guest-proof] optional AI analysis failed', error instanceof Error ? error.message.slice(0, 200) : 'unknown_error');
    }
    return privateJson(200, { ...result, aiReview });
  } catch {
    await storage.storage.from('payment-proofs').remove([path]).catch(() => undefined);
    return privateJson(503, { ok: false, code: 'proof_upload_failed' });
  }
}
