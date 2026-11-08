import type { TemplateConfig } from '../types.ts';
import { S } from './builders.ts';

export const pressedGarden: TemplateConfig = {
  id: 'pressed-garden', version: 1,
  name: { en: 'Pressed Garden', id: 'Taman Terkering' },
  tagline: { en: 'Elegant botanical gift', id: 'Hadiah botani yang anggun' },
  description: {
    en: 'A quiet, floral keepsake for the person who makes ordinary days feel lighter.',
    id: 'Kenang-kenangan bernuansa bunga yang tenang untuk orang yang membuat hari biasa terasa lebih ringan.',
  },
  category: 'thank-you', tier: 'core', status: 'active', featured: false, popular: true, isNew: false, hasDemo: false,
  theme: {
    palette: { background: '#f1eee5', surface: '#fbf9f3', ink: '#25241f', mutedInk: '#575f50', accent: '#4f5e47', accentInk: '#f7f5ee', line: '#d9d6c8' },
    display: 'serif-old', body: 'sans-clean', motion: 'subtle',
  },
  sections: [S.opening('cover-page'), S.letter('handwritten-card'), S.gallery('plates', 3, 6), S.appreciation('quiet-note', false), S.closing('full-stop')],
  sample: {
    en: {
      fields: {
        recipientName: 'Nadia', senderName: 'Dimas', occasion: 'With thanks',
        letterGreeting: 'Dear Nadia,', letterBody: 'Thank you for the way you notice things: the tired look I tried to hide, the good news I was too shy to share.\n\nYou made a difficult season feel lighter, and I wanted you to know it.', letterSignoff: 'With gratitude,',
        appreciationText: 'Your kindness arrives quietly and stays a long time.',
        closingLine: 'Thank you, truly.', signature: 'Dimas',
      },
      lists: { moments: [{ caption: 'The first coffee you insisted on', place: 'Office pantry' }, { caption: 'The afternoon you stayed late to help', place: 'Third floor' }, { caption: 'Plants you left on my desk', place: 'My desk' }] },
    },
    id: {
      fields: {
        recipientName: 'Nadia', senderName: 'Dimas', occasion: 'Dengan rasa terima kasih',
        letterGreeting: 'Untuk Nadia,', letterBody: 'Terima kasih atas caramu memperhatikan: wajah lelah yang kucoba sembunyikan, kabar baik yang terlalu malu untuk kubagi.\n\nKamu membuat musim yang sulit terasa lebih ringan, dan aku ingin kamu tahu itu.', letterSignoff: 'Dengan rasa syukur,',
        appreciationText: 'Kebaikanmu datang diam-diam dan tinggal lama.',
        closingLine: 'Terima kasih, sungguh.', signature: 'Dimas',
      },
      lists: { moments: [{ caption: 'Kopi pertama yang kamu paksa untuk kutraktir', place: 'Pantri kantor' }, { caption: 'Sore ketika kamu lembur membantuku', place: 'Lantai tiga' }, { caption: 'Tanaman yang kamu taruh di mejaku', place: 'Mejaku' }] },
    },
  },
};
