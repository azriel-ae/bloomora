# Bloomora data model (schema v2) and access rules

Business rule (Model B): a package controls creating and editing. It never
controls the lifetime of a published gift.

| Collection | Who reads | Who writes | Notes |
|---|---|---|---|
| `packages/{id}` | anyone | server | Seeded from `lib/packages.ts` values (Basic 19.000/3d, Plus 39.000/14d, Premium 69.000/30d). Falls back to the same constants if not seeded. |
| `orders/{id}` | owner, admin | server | `awaiting_payment` -> `proof_submitted` -> `approved` / `rejected`. Package terms are frozen in `packageSnapshot`. |
| `subscriptions/{id}` | owner, admin | server only | Created solely by `approveOrder`, id `sub_<orderId>`. "Expired" is derived from `expiresAt`, not stored. |
| `gifts/{id}` | owner, admin | server | Private: owner, template, slug, draft (`content`, `version`), `publishedRevision`. No `expiresAt`. |
| `gifts/{id}/revisions/{n}` | owner, admin | server | Immutable snapshot per publish. |
| `publicGifts/{slug}` | anyone (single get, only `status == 'published'`) | server | No owner, order or subscription data. Archived/deleted gifts become `archived` / `removed`. |
| `slugs/{slug}` | nobody | server | Reservation and slug -> gift mapping. Kept after deletion so a URL is never reused. |
| `adminAuditLogs/{id}` | admin | server | Written on approve/reject. |

All client writes are denied; every mutation goes through route handlers that
verify the session cookie, then call `lib/server/services.ts`, which runs one
Firestore transaction using the server clock.

## What expiry changes

| Action | Active | Expired / none |
|---|---|---|
| Create gift, save draft, publish/update | yes | no |
| Restore archived gift | yes | no |
| Archive or delete own gift | yes | yes |
| Copy/share link, recipients opening the gift | yes | yes |

## Decisions

Lihat `docs/DECISIONS.md` (sumber utama). Dua hal di kode saat ini berbeda dari keputusan atau belum diputuskan, dan ditandai di sana: subscription belum menumpuk sisa masa aktif (kode memulai saat persetujuan), dan kuota `maxGifts: 1` per subscription adalah asumsi sementara.

## Storage layout (rules written, not deployed)

`private/{uid}/gifts/{giftId}/...` owner read; `public/gifts/{slug}/{revision}/...` public read, copied by the server at publish time so editing a draft cannot change a published gift; `paymentProofs/{uid}/{orderId}/...` private. Clients never write; uploads will be server-issued.

## Tests

`pnpm test:unit` runs without network (Node >= 22.6). `pnpm test:rules` needs the Firebase emulator.
