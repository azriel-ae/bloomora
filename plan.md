# Bloomora implementation plan

## Product scope

Bloomora is a production-oriented digital gift platform where a visitor can browse original gift templates, create a personalized interactive gift, preview it, upload bounded photo/audio media, pay manually through administrator-managed QRIS, publish the gift, and share a unique recipient URL and QR code. The product also includes account management, an authorized admin workspace, editable product configuration, and a server-only Gemini chatbot.

The build will honor the requested stack: Next.js App Router, strict TypeScript, React, Tailwind CSS, Framer Motion, Lucide React, React Hook Form, Zod, QR generation, Next.js route handlers, Firebase Authentication/Firestore/Cloud Storage, Firebase Admin SDK, Firebase rules and emulator support, the official Google Gen AI SDK, Vercel deployment, and environment-specific configuration. Firebase is the source of truth for application data and media; the managed project server/database capability supplies the web runtime but does not replace Firestore.

## Delivery approach

Build in working vertical slices rather than a static mockup or a large untested scaffold:

1. Establish the visual system, route manifest, public pages, data contracts, configuration, and a polished template catalog/detail experience using original copy and deterministic demo template definitions.
2. Add Firebase configuration, server-side session/auth boundaries, user dashboard, Firestore repositories, and protected route handlers. Keep public template browsing usable before login.
3. Add the reusable gift editor and shared renderer. Start with the three required templates and approved scene types; enforce schema validation, ownership checks, debounced autosave, media limits, and responsive editor/preview behavior.
4. Add manual QRIS ordering, proof uploads to Cloud Storage, administrator verification, server-owned prices and entitlements, publication/expiry rules, recipient routes, and QR-code sharing.
5. Add the admin workspace for QRIS replacement, package/template/category/content/branding management, payment verification, audit history, and safe deletion requests.
6. Add the Gemini chatbot route, retention/access safeguards, rules/emulator configuration, observability-friendly error states, SEO metadata, and production configuration documentation.

Each slice must leave the app runnable and must not claim Firebase, payment, AI, or publication behavior until its server path and authorization checks exist. Missing external credentials are configuration blockers, not reasons to silently substitute fake success states.

## Architecture and boundaries

- `app/` contains public, auth, dashboard, editor, recipient, admin, and API route handlers. Server Components render public content and protected shells; Client Components are reserved for editor controls, chat, auth forms, previews, and upload interactions.
- `components/` contains the visual system, navigation, cards, dialogs, form controls, template preview primitives, editor panels, recipient renderer, QR display, and status/empty/error states.
- `lib/` contains brand configuration, Zod schemas, template definitions, scene registry, date/price helpers, Firebase client/admin initialization, repositories, session/auth helpers, storage upload helpers, QR generation, and Gemini client wrappers.
- `content/` contains editable-safe defaults for homepage, FAQ, legal placeholders, payment instructions, and demo content. Business-specific legal identity remains explicitly configurable and is not invented.
- `firebase/` contains Firestore indexes, Firestore rules, Storage rules, emulator configuration, and deterministic seed helpers where safe.
- `public/` contains route manifest, icons, robots/sitemap support, and small local assets only. User media never goes into Git.
- `scripts/` contains checks, seed/migration helpers, and local emulator setup where needed.

The application will use a configuration-driven template engine. A template record includes version, category, theme, typography, supported scenes, default order, editable fields, validation, animation, feature requirements, and publication compatibility. React renderers are approved components; user data can populate fields and scene configuration but can never inject arbitrary HTML, JavaScript, or executable content.

## Data model direction

Firestore collections will be designed around ownership and auditability: `users`, `templates`, `categories`, `packages`, `gifts`, `giftMedia`, `orders`, `paymentProofs`, `siteSettings`, `adminAuditLogs`, and `chatSessions` only if persistence is explicitly needed. Gifts store immutable public identity, template/version snapshot, validated content, scene order, status, payment/entitlement references, publication/expiry dates, and deletion state. Media records store owner, gift/order relationship, object key, stable storage URL, type/size metadata, and soft-delete state. Sensitive operations go through server routes with verified Firebase identity and role checks.

The order amount and package limits are calculated on the server from the stored package definition. The browser cannot change price, payment status, admin verification, role, owner, publication status, or expiry entitlement. Published gifts retain payment history and use explicit rules for edits and extensions.

## Design direction

Three possible styles, sampled as low-probability alternatives:

- Botanical editorial keepsake — probability 0.08.
- Soft neo-romantic atelier — probability 0.06.
- Modern paper-letter minimalism — probability 0.05.

Chosen style: **Botanical editorial keepsake**.

### Design Movement

A contemporary botanical editorial language: part premium stationery, part intimate digital album, with generous paper-like space and restrained ornamental detail.

### Core Principles

1. Make the recipient feel personally considered; every surface should support warmth and clarity.
2. Use editorial rhythm, asymmetry, and breathing room instead of dashboard-like density.
3. Keep decoration quiet and purposeful so the gift content remains the hero.
4. Make important actions obvious and reassuring, especially save, payment, publish, and share states.

### Color Philosophy

Warm ivory and parchment neutrals create the sense of a keepsake page. Muted rose supplies emotional warmth without becoming sugary. Deep ink provides calm, readable contrast. A single moss accent ties the botanical motif to a grounded, ownable brand tone.

### Layout Paradigm

Use offset editorial compositions: asymmetric hero copy paired with an illustrated gift card, catalog sections that alternate text and preview rails, and dashboard/editor surfaces that use a strong reading column with an adjacent utility rail. On mobile, collapse into a single intentional story flow rather than shrinking desktop grids.

### Signature Elements

- A thin “pressed stem” line motif used as dividers and progress cues.
- Warm paper cards with subtle edge shadows and corner notches rather than glass panels.
- Small botanical seals and hand-set labels used sparingly for category, saved state, and template version.

### Interaction Philosophy

Interactions should feel like opening stationery: gentle reveal, clear affordance, and visible completion. Autosave is quiet but legible. Preview changes should feel immediate. Destructive actions require context and confirmation; payment and publication states use explicit language rather than ambiguous icon-only feedback.

### Animation

Use short ease-out fades and 8–16px lifts for cards, staggered scene entrances for recipient gifts, and a low-amplitude stem draw for important transitions. Respect `prefers-reduced-motion` by removing parallax, stagger, and decorative movement while preserving state changes and focus visibility.

### Typography System

Use a high-contrast serif for editorial display text and a clean humanist sans for controls and body copy. The display scale is compact and intentional; long copy remains in a readable measure. Labels use small uppercase or sentence-case metadata with increased tracking only when it improves scanning.

### Brand Essence

Personal digital keepsakes for people who want to say more than a message can hold. Personality: tender, composed, memorable.

### Brand Voice

Headlines are intimate and specific; CTAs are inviting and action-oriented; microcopy is calm and honest about progress and limitations.

Example lines:

- “Make a little world for someone you love.”
- “Your gift is safe here. We’ll keep saving as you shape it.”

### Wordmark & Logo

Use a custom Bloomora wordmark treatment with a small seed-and-stem mark: two offset leaves forming a subtle “B” silhouette, paired with a high-contrast serif wordmark. The mark should also work as a compact favicon and as a stamp on gift previews.

### Signature Brand Color

**Pressed Moss** — a muted green with enough gray to feel editorial, used for primary actions, active states, and the botanical seal rather than as a broad background.

## Public routes

- `/` home
- `/templates` catalog
- `/templates/[slug]` template detail and preview
- `/pricing` configurable packages
- `/about`, `/contact`, `/faq`, `/payment`, `/privacy`, `/terms`, `/refunds`, `/expiration`, `/media-policy`
- `/login`, `/register`, `/forgot-password`
- `/g/[giftSlug]` published recipient experience
- `/manus-routes.json` route manifest

Private routes include `/dashboard`, `/dashboard/gifts`, `/dashboard/orders`, `/create`, `/editor/[giftId]`, `/admin`, and nested admin management pages. APIs cover auth/session, gifts, media, orders, payments, publishing, admin configuration, and chatbot requests.

## Build workflow

Use pnpm with a pinned package manager and explicit lifecycle permissions. Register host-managed TypeScript diagnostics before the first code batch. Keep the development service on the configured port and verify `/manus-routes.json` with HTTP 200 after route changes. Run typecheck, lint, and production build checks after each major slice. Use Firebase Emulator Suite configuration for local auth/firestore/storage testing where possible, but treat the shared managed database and production credentials as real data boundaries. Before checkpointing, ensure the root `app.config.ts` contains a quoted durable HTTPS `logoUrl`, then commit the intended files to the project canonical `main` branch.

## External configuration required before production behavior

The implementation will include `.env.example` and clear setup documentation for Firebase client configuration, Firebase Admin service-account credentials, Gemini API credentials/model configuration, public application origin, and admin bootstrap/role setup. Protected values will be requested through the project secret flow rather than pasted into source or chat. Until those values are supplied, the code will show an explicit configuration state or use public deterministic template content; it will not pretend that auth, uploads, payments, or AI are succeeding.
