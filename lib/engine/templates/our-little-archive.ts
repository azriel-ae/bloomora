import type { TemplateConfig } from '../types.ts';
import { S } from './builders.ts';

export const ourLittleArchive: TemplateConfig = {
  id: 'our-little-archive', version: 1,
  name: { en: 'Our Little Archive', id: 'Arsip Kecil Kita' },
  tagline: { en: 'Interactive memory scrapbook', id: 'Scrapbook kenangan interaktif' },
  description: {
    en: 'A playful timeline of inside jokes, tiny victories, and all the places your story has been.',
    id: 'Linimasa jenaka berisi lelucon internal, kemenangan kecil, dan semua tempat yang pernah kalian singgahi.',
  },
  category: 'friendship', tier: 'extended', status: 'active', featured: false, popular: false, isNew: false, hasDemo: false,
  theme: {
    palette: { background: '#f5e5dc', surface: '#fff6f0', ink: '#352a26', mutedInk: '#6a4d44', accent: '#9a4f48', accentInk: '#fff6f0', line: '#e0c8bc' },
    display: 'serif-classic', body: 'sans-clean', motion: 'standard',
  },
  sections: [S.opening('curtain'), S.timeline('dated-ledger', 3, 7), S.message('tap-to-reveal', 3, 8), S.gallery('contact-sheet', 3, 8), S.closing('postscript')],
  sample: {
    en: {
      fields: { recipientName: 'Sasha', senderName: 'Rin', occasion: 'Ten years of friendship', reasonsIntro: 'Tap to read', closingLine: 'Same time next year?', signature: 'Rin' },
      lists: {
        chapters: [{ when: '2016', title: 'The seat by the window', text: 'You saved me a seat and a story. I took both.' }, { when: '2020', title: 'The video-call year', text: 'Two screens, one very long conversation.' }, { when: '2026', title: 'Still here', text: 'Ten years and we still argue about the playlist.' }],
        reasons: [{ text: 'You answer on the first ring, always.' }, { text: 'You never tell me the plan is silly.' }, { text: 'You keep every ticket stub.' }],
        moments: [{ caption: 'Concert, row Z', place: 'Arena' }, { caption: 'Missed the last train', place: 'Station' }, { caption: 'Birthday pancakes', place: 'Your kitchen' }],
      },
    },
    id: {
      fields: { recipientName: 'Sasha', senderName: 'Rin', occasion: 'Sepuluh tahun bersahabat', reasonsIntro: 'Ketuk untuk membaca', closingLine: 'Tahun depan, jam yang sama?', signature: 'Rin' },
      lists: {
        chapters: [{ when: '2016', title: 'Kursi dekat jendela', text: 'Kamu menyimpankan kursi dan sebuah cerita. Aku mengambil keduanya.' }, { when: '2020', title: 'Tahun panggilan video', text: 'Dua layar, satu percakapan yang sangat panjang.' }, { when: '2026', title: 'Masih di sini', text: 'Sepuluh tahun dan kita masih berdebat soal daftar lagu.' }],
        reasons: [{ text: 'Kamu selalu mengangkat di dering pertama.' }, { text: 'Kamu tak pernah bilang rencanaku konyol.' }, { text: 'Kamu menyimpan setiap sobekan tiket.' }],
        moments: [{ caption: 'Konser, baris Z', place: 'Arena' }, { caption: 'Ketinggalan kereta terakhir', place: 'Stasiun' }, { caption: 'Pancake ulang tahun', place: 'Dapurmu' }],
      },
    },
  },
};
