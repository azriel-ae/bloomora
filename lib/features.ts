/**
 * Customer photo/audio uploads remain opt-in per deployment. Enable only after
 * applying the customer-media migration and provisioning the private `gift-media`
 * bucket plus server-side service-role configuration. The API also refuses
 * uploads when privileged Storage is unavailable; never expose that key to clients.
 */
export const MEDIA_UPLOAD_ENABLED = process.env.NEXT_PUBLIC_BLOOMORA_MEDIA_UPLOAD_ENABLED === 'true';
