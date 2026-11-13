# Bloomora

Bloomora is a warm, editorial digital gift platform for creating and sharing personalized interactive keepsakes.

## Current implementation

The public product slice includes the homepage, template catalog, template detail pages, pricing, FAQ, informational/legal placeholders, responsive navigation/footer, recipient demo/invalid states, shared template definitions, route manifest, and a responsive gift editor.

The server integration uses Supabase Auth for provisioned administrator identities, PostgreSQL transactions for domain data, private Supabase Storage for payment proofs, and a server-only Gemini chatbot route. Customers remain account-free guests; public signup is disabled. The application fails closed when required Supabase configuration is missing and never fabricates account, payment, upload, or publish success.

## Supabase configuration

Configure these variables in local development and Vercel Project Settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `SUPABASE_DB_URL` (server-only transaction/session-pooler URI)
- `GEMINI_API_KEY` (server-only)
- `GEMINI_MODEL`
- `NEXT_PUBLIC_SITE_URL=https://bloomora.my.id`

The product interface is Indonesian-only. Legacy `/id/...` and `/en/...` links redirect to unprefixed routes. `NEXT_PUBLIC_SITE_URL` must be set to the exact official HTTPS origin in Vercel; public links, QR codes, canonical metadata, and sitemap entries never use a Vercel preview hostname. Domain/DNS binding itself must be verified in the Vercel project.

Run the committed SQL migration in `supabase/migrations/` against the owner-controlled Supabase project. Keep service-role and database credentials out of Git and out of all `NEXT_PUBLIC_` variables. Provision owner/admin users out of band in Supabase Auth and insert their server-controlled rows in `admin_profiles`. Disable public signup in Supabase Auth.

The `payment-proofs` Storage bucket is private. Guest proof uploads and administrator previews must go through the server routes, which validate the order token, ownership, file type, size, and admin role. `payment-method-images` is public for owner-managed payment instructions. The `gift-media` bucket is private and reserved for customer photos/audio; its metadata is recorded in `gift_media` and its objects must be served through authorized server routes. Do not expose service-role credentials to browser code. For an idempotent SQL setup, use `supabase/setup_storage.sql`.

## Local checks

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:supabase
pnpm check:i18n
pnpm build
```

The QRIS payment flow is intentionally manual: the owner supplies the active QRIS instructions, package pricing, proof review, and publication entitlement policy. Supabase remains the only application backend; no alternate database provider or local file database is used.
testttbro ada masalah upload file e
