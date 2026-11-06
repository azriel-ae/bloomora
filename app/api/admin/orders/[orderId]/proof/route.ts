import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getAdminPaymentProofPath } from '@/lib/server/services';
import { withActor } from '@/lib/server/http';

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return withActor(request, async (env, actor) => {
    const storage = createSupabaseAdminClient();
    if (!storage) return { ok: false, status: 503, code: 'storage_not_configured' };
    const proof = await getAdminPaymentProofPath(env, actor, orderId);
    if (!proof.ok) return proof;
    try {
      const { data, error } = await storage.storage.from('payment-proofs').createSignedUrl(proof.storagePath, 5 * 60);
      if (error || !data?.signedUrl) return { ok: false, status: 503, code: 'proof_preview_unavailable' };
      return { ok: true, url: data.signedUrl, contentType: proof.contentType, expiresAtMs: Date.now() + 5 * 60_000 };
    } catch {
      return { ok: false, status: 503, code: 'proof_preview_unavailable' };
    }
  }, { body: false });
}
