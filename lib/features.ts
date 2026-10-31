/**
 * Image and audio upload stays disabled until Firebase Storage billing (Blaze)
 * has been approved and the bucket provisioned. This is a compile-time constant
 * on purpose: an environment variable could be flipped by mistake and expose a
 * half-built upload path. Change it only in the same commit that ships the
 * server-issued upload flow.
 */
export const MEDIA_UPLOAD_ENABLED = false as boolean;
