import type { FieldDef, FieldKind, ListDef, SectionDef } from '../types.ts';

/**
 * Section builders with a fixed field vocabulary, so every template uses the
 * same keys for the same ideas (recipientName, letterBody, chapters...). The
 * editor and migrations can then treat templates uniformly; templates differ
 * by variant, theme, section selection and copy, not by ad hoc field names.
 */
const f = (key: string, kind: FieldKind, en: string, id: string, maxLength: number, required = false, hint?: [string, string]): FieldDef =>
  ({ key, kind, label: { en, id }, maxLength, required, ...(hint ? { hint: { en: hint[0], id: hint[1] } } : {}) });

const list = (key: string, en: string, id: string, itemEn: string, itemId: string, itemFields: FieldDef[], minItems: number, maxItems: number): ListDef =>
  ({ key, label: { en, id }, itemLabel: { en: itemEn, id: itemId }, itemFields, minItems, maxItems });

export const S = {
  opening: (variant: string): SectionDef => ({
    id: 'opening', type: 'opening', variant, fields: [
      f('recipientName', 'text', 'Recipient name', 'Nama penerima', 40, true),
      f('senderName', 'text', 'Your name', 'Namamu', 40, true),
      f('occasion', 'text', 'Occasion line', 'Keterangan momen', 60, false, ['Shown on the cover, for example "Three years together".', 'Tampil di sampul, misalnya "Tiga tahun bersama".']),
    ], lists: [],
  }),
  hero: (variant: string): SectionDef => ({
    id: 'hero', type: 'hero', variant, fields: [
      f('title', 'text', 'Title', 'Judul', 60, true),
      f('subtitle', 'text', 'Subtitle', 'Subjudul', 120),
      f('dateLine', 'text', 'Date line', 'Baris tanggal', 60),
    ], lists: [],
  }),
  letter: (variant: string): SectionDef => ({
    id: 'letter', type: 'letter', variant, fields: [
      f('letterGreeting', 'text', 'Greeting', 'Salam pembuka', 60),
      f('letterBody', 'textarea', 'Letter', 'Isi surat', 1800, true, ['Separate paragraphs with a blank line.', 'Pisahkan paragraf dengan satu baris kosong.']),
      f('letterSignoff', 'text', 'Sign-off', 'Salam penutup', 60),
    ], lists: [],
  }),
  timeline: (variant: string, min = 3, max = 7): SectionDef => ({
    id: 'timeline', type: 'timeline', variant, fields: [], lists: [
      list('chapters', 'Chapters', 'Bab', 'Chapter', 'Bab', [
        f('when', 'text', 'When', 'Kapan', 30), f('title', 'text', 'Title', 'Judul', 60), f('text', 'textarea', 'Story', 'Cerita', 280),
      ], min, max),
    ],
  }),
  gallery: (variant: string, min = 3, max = 8): SectionDef => ({
    id: 'gallery', type: 'gallery', variant, fields: [], lists: [
      list('moments', 'Moments', 'Momen', 'Moment', 'Momen', [
        f('caption', 'text', 'Caption', 'Keterangan', 90), f('place', 'text', 'Place', 'Tempat', 50),
      ], min, max),
    ],
  }),
  message: (variant: string, min = 3, max = 10): SectionDef => ({
    id: 'message', type: 'message', variant, fields: [f('reasonsIntro', 'text', 'Introduction', 'Pengantar', 80)], lists: [
      list('reasons', 'Reasons', 'Alasan', 'Reason', 'Alasan', [f('text', 'textarea', 'Reason', 'Alasan', 160)], min, max),
    ],
  }),
  appreciation: (variant: string, optional = true): SectionDef => ({
    id: 'appreciation', type: 'appreciation', variant, optional, fields: [
      f('appreciationText', 'textarea', 'Appreciation note', 'Catatan apresiasi', 400, true),
    ], lists: [],
  }),
  music: (): SectionDef => ({
    id: 'music', type: 'music', variant: 'quiet-player', optional: true, requiresMedia: 'audio', fields: [
      f('trackTitle', 'text', 'Track title', 'Judul lagu', 80), f('trackArtist', 'text', 'Artist', 'Artis', 60),
    ], lists: [],
  }),
  closing: (variant: string): SectionDef => ({
    id: 'closing', type: 'closing', variant, fields: [
      f('closingLine', 'text', 'Closing line', 'Kalimat penutup', 120, true),
      f('signature', 'text', 'Signature', 'Tanda tangan', 60, true),
    ], lists: [],
  }),
};
