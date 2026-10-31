import type { TemplateConfig } from '../types.ts';
import { S } from './builders.ts';

export const justALetter: TemplateConfig = {
  id: 'just-a-letter', version: 1,
  name: { en: 'Just a Letter', id: 'Sekadar Surat' },
  tagline: { en: 'Minimal letter and photo story', id: 'Surat minimalis dan kisah foto' },
  description: {
    en: 'A considered note with room for photographs, pauses, and everything you could not fit in a text.',
    id: 'Catatan yang dipikirkan matang dengan ruang untuk foto, jeda, dan semua yang tak muat dalam pesan singkat.',
  },
  category: 'long-distance', tier: 'core', status: 'active', featured: false, popular: false, isNew: false, hasDemo: false,
  theme: {
    palette: { background: '#efe7da', surface: '#faf5ea', ink: '#2e2a25', mutedInk: '#5f5446', accent: '#7a5a40', accentInk: '#faf5ea', line: '#d8ccb8' },
    display: 'serif-old', body: 'typewriter', motion: 'subtle',
  },
  sections: [S.opening('cover-page'), S.letter('typewritten'), S.gallery('filmstrip', 3, 6), S.closing('full-stop')],
  sample: {
    en: {
      fields: { recipientName: 'Lio', senderName: 'Tari', occasion: 'Eleven time zones apart', letterGreeting: 'Lio,', letterBody: 'It is morning here and night there, and I keep doing that arithmetic in my head.\n\nI wanted to send you more than a message. So here is a small letter, and a few pictures of the days you missed.', letterSignoff: 'Yours, across the distance,', closingLine: 'See you soon.', signature: 'Tari' },
      lists: { moments: [{ caption: 'The cafe you would have liked', place: 'Corner of 5th' }, { caption: 'Your plant, doing well', place: 'Windowsill' }, { caption: 'Sunrise on the walk to work', place: 'Riverside' }] },
    },
    id: {
      fields: { recipientName: 'Lio', senderName: 'Tari', occasion: 'Terpisah sebelas zona waktu', letterGreeting: 'Lio,', letterBody: 'Di sini pagi dan di sana malam, dan aku terus menghitungnya di kepala.\n\nAku ingin mengirimimu lebih dari sekadar pesan. Jadi ini sebuah surat kecil, dan beberapa gambar dari hari-hari yang kamu lewatkan.', letterSignoff: 'Milikmu, dari seberang jarak,', closingLine: 'Sampai jumpa segera.', signature: 'Tari' },
      lists: { moments: [{ caption: 'Kafe yang pasti kamu suka', place: 'Sudut Jalan Kelima' }, { caption: 'Tanamanmu, tumbuh sehat', place: 'Ambang jendela' }, { caption: 'Matahari terbit di jalan menuju kantor', place: 'Tepi sungai' }] },
    },
  },
};
