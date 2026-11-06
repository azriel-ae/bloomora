# Template engine

A template is data (`lib/engine/templates/*.ts`): theme tokens, ordered sections
(each a type + visual variant), editable fields and lists, and complete sample
content in English and Indonesian. One shared renderer will draw every template
for the editor, demo, preview and public gift page.

- `types.ts`: config shapes and the allowed variants per section type.
- `templates/builders.ts`: section builders with a fixed field vocabulary (`recipientName`, `letterBody`, `chapters`...), so templates are interchangeable for the editor.
- `resolve.ts`: `validateContentForTemplate`, `missingForPublish`, `resolveRenderModel`, `sampleContent`, `blankContent`. Pure, no React.
- `validate-config.ts`: the quality gate every template must pass (both languages complete, no emoji-like glyphs, WCAG contrast, valid variants, unique keys, complete matching samples).
- `registry.ts`: all versions ever shipped. New gifts get the newest ACTIVE version; existing gifts render and stay editable against the exact version they pinned, even after the template is deactivated (Model B).

Adding a template: create a config, add it to `ALL_TEMPLATE_VERSIONS`; `pnpm test:unit` fails until it passes the gate. Changing fields or layout of a shipped template: add a new entry with `version + 1`, never edit the old one.

Rules the renderer must follow: draw only what `resolveRenderModel` returns; never pass `fillEmptyFrom` for a real gift; no section appears without content; respect `theme.motion` and `prefers-reduced-motion`.

## Renderer (Phase 3)

`components/gift/gift-view.tsx` adalah satu-satunya cara menampilkan gift: demo, pratinjau editor, dan halaman publik memakainya. Lihat `docs/ARCHITECTURE.md` untuk mode dan aturan. Varian section yang diimplementasikan ada di `lib/engine/theme-vars.ts` (`IMPLEMENTED_VARIANTS`); menambah varian berarti menambah komponen, entri di sana, CSS, dan tes browser.
