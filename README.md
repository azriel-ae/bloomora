# Bloomora

Bloomora is a warm, editorial digital gift platform for creating and sharing personalized interactive keepsakes.

## Current implementation

The public product slice is complete and runnable: homepage, template catalog, template detail pages, pricing, FAQ, informational/legal placeholders, responsive navigation/footer, recipient demo/invalid states, shared template definitions, route manifest, and a first responsive gift editor experience.

The integration slice is wired for Firebase email/password authentication, server-verified session cookies, Firestore gift persistence, Firebase Storage rules, and a server-only Gemini chatbot route. The preview intentionally shows explicit configuration states until the required environment values are supplied; it does not fabricate account, AI, payment, or publish success.

## Vercel configuration

Use these variables in Vercel Project Settings:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_STORAGE_BUCKET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `NEXT_PUBLIC_SITE_URL=https://bloomora-lovat-theta.vercel.app`

Keep `FIREBASE_PRIVATE_KEY` and `GEMINI_API_KEY` server-only. Set `GEMINI_MODEL` to a currently supported model from the official Google Gemini model catalog. Firebase web configuration is public client configuration; Firestore and Storage Security Rules must enforce access.

The Firebase project `bloomora-production` has the Bloomora Next.js web app registered. Email/Password Authentication is enabled, and `localhost` plus `bloomora-lovat-theta.vercel.app` are authorized. Google Sign-In is not enabled because the current app only implements email/password authentication. Cloud Firestore is Standard edition in `asia-southeast2` (Jakarta), initialized in production mode. Its rules are deployed; there are no compound-query indexes because the current app performs no client-side Firestore queries.

Firebase Storage requires upgrading this project to the Blaze billing plan in the Firebase Console. Billing has not been enabled, so Storage is not provisioned and its rules remain local in `firebase/storage.rules`. Do not upload files or rely on Storage until the owner approves billing and the bucket is created.

For server-side Admin SDK use, configure a dedicated service account with only the Authentication, Firestore, and (after Storage is approved) Storage permissions the server needs. Keep its credentials in local/Vercel environment variables; never commit service-account JSON or place private values in `NEXT_PUBLIC_` variables. Set custom admin claims through a trusted operator process; Firestore rules check `request.auth.token.admin == true`.

## Local emulator flow

Install the Firebase CLI separately, then run `firebase emulators:start --config firebase.json`. Production Firebase credentials are not used by the emulator unless you explicitly configure them.

## Checks

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

The current QRIS payment flow is intentionally manual and remains the next business-configured slice: the owner supplies the active QRIS image/instructions, server-owned package pricing, proof upload, admin verification, and publish entitlement behavior.
