# Bloomora delivery outcomes

## Public product experience
- [ ] Visitors can browse the Bloomora homepage before registration, understand that they can create personalized interactive digital gifts without coding, and use real links for create, templates, pricing, FAQ, and support/legal destinations.
- [ ] The template catalog provides original thumbnails/previews, configurable category labels, search, sorting, loading/empty/error states, and real preview/create actions.
- [ ] Each template detail page identifies demo content, explains supported features/scenes, provides responsive preview modes, and links into the editor flow.
- [ ] Pricing packages are configurable and initially represent Basic Rp19.000 for 3 days, Plus Rp39.000 for 14 days, and Premium Rp69.000 for 30 days; limitations are visible and server-side pricing remains authoritative.
- [ ] About, contact, privacy, terms, refund/cancellation, payment instructions, FAQ, expiration, and media-retention pages use editable-safe content and do not invent unapproved legal identity or guarantees.

## Identity, persistence, and media
- [ ] Firebase Authentication supports email/password registration, login, logout, password reset, session persistence, profile data, useful validation/errors, and protected account areas.
- [ ] Private API routes verify identity, ownership, and authorization server-side; clients cannot set roles, ownership, payment states, order amounts, publication status, or expiry entitlements.
- [ ] Firestore stores users, templates/categories, packages, gifts, media, orders, proof, settings, and audit data with ownership-aware rules and deterministic configuration/seed support.
- [ ] Cloud Storage uploads validate type/size/count/ownership, use durable stable asset addresses, support thumbnails/compression/progress, and implement soft-delete/retention behavior without promising unavailable physical deletion.

## Gift editor and recipient renderer
- [ ] The editor works responsively on desktop and mobile with settings, approved scenes, photo/audio management, live preview, shared rendering, validation, and mobile-safe interactions.
- [ ] Three usable configuration-driven templates exist: Elegant Botanical Gift, Interactive Memory Scrapbook, and Minimal Letter and Photo Story.
- [ ] Autosave is debounced and exposes saving/saved/failure/retry states, validates on the server, handles conflicts/recovery, and prevents stale requests from overwriting newer changes.
- [ ] Published gifts use `/g/[giftSlug]`, support responsive/reduced-motion/loading/invalid/expired/access-denied states, and preserve payment history when extended or edited according to explicit rules.

## Orders, QRIS, and administration
- [ ] Users can create orders with server-owned package pricing, view order/payment/proof state, upload payment proof, and see clear QRIS instructions.
- [ ] Administrators can replace the QRIS image, verify/reject payments, manage packages/templates/categories/content/branding, review users/gifts/orders, and see audit history.
- [ ] Publication only becomes available after the configured payment/verification rules pass; shared links and generated QR codes use stable public gift identity.

## AI, safety, and delivery
- [ ] The chatbot calls the official Gemini integration only from a server route, keeps credentials server-side, validates input, handles empty/error/retry states, and does not expose secrets.
- [ ] Indonesian (`id`) is the default interface language for new visitors and English (`en`) is supported through a compact accessible navbar selector that persists a locale cookie across navigation and reloads.
- [ ] Translation messages live in separate Indonesian and English catalogs with parity checking; the selected locale is passed to Gemini, localized chatbot controls/errors are shown, and user-created gift content is never silently translated or overwritten.
- [ ] Locale-prefixed aliases such as `/id`, `/id/templates`, `/id/pricing`, `/en`, `/en/templates`, and `/en/pricing` preserve the current route where an equivalent localized route exists, and document language/hreflang metadata is provided for public entry points.
- [ ] IDR prices remain trusted application values and use locale-aware `Intl.NumberFormat` formatting without changing order amounts, validity, payment state, or timestamps.
- [ ] Homepage, catalog, pricing, authentication, editor, payment instructions, footer, FAQ, contact, privacy, terms, refunds, expiration, and media-policy surfaces use the centralized Indonesian/English catalogs rather than English-only hardcoded public copy.
- [ ] Arbitrary HTML/JavaScript/executable scene content is rejected; upload validation, rate/abuse controls, privacy/retention controls, security headers, and accessible reduced-motion behavior are implemented.
- [ ] `/manus-routes.json`, metadata, canonical/OG/Twitter tags when a public origin is configured, robots/sitemap behavior, typecheck, lint, build, and major route checks remain synchronized.
- [ ] The project includes environment documentation, Firebase emulator/rules configuration, a durable logo URL before checkpointing, and only claims tested behavior.
