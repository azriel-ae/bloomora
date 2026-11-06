import type { CategoryId, L10n } from './types.ts';

export const CATEGORIES: readonly { id: CategoryId; label: L10n }[] = [
  { id: 'birthday', label: { en: 'Birthday', id: 'Ulang tahun' } },
  { id: 'anniversary', label: { en: 'Anniversary', id: 'Hari jadi' } },
  { id: 'friendship', label: { en: 'Friendship', id: 'Persahabatan' } },
  { id: 'graduation', label: { en: 'Graduation', id: 'Kelulusan' } },
  { id: 'thank-you', label: { en: 'Thank you', id: 'Terima kasih' } },
  { id: 'long-distance', label: { en: 'Long distance', id: 'Jarak jauh' } },
  { id: 'appreciation', label: { en: 'Appreciation', id: 'Apresiasi' } },
  { id: 'just-because', label: { en: 'Just because', id: 'Tanpa alasan khusus' } },
  { id: 'wedding', label: { en: 'Wedding', id: 'Pernikahan' } },
  { id: 'family', label: { en: 'Family', id: 'Keluarga' } },
  { id: 'romantic-love', label: { en: 'Romantic & Love', id: 'Romantis & Cinta' } },
  { id: 'birthday-celebration', label: { en: 'Birthday & Celebration', id: 'Ulang Tahun & Perayaan' } },
  { id: 'apology-appreciation', label: { en: 'Apology & Appreciation', id: 'Permintaan Maaf & Apresiasi' } },
  { id: 'family-friendship', label: { en: 'Family & Friendship', id: 'Keluarga & Persahabatan' } },
  { id: 'graduation-achievement', label: { en: 'Graduation & Achievement', id: 'Kelulusan & Pencapaian' } },
  { id: 'special-moments', label: { en: 'Special Moments', id: 'Momen Spesial' } },
  { id: 'holiday-seasonal', label: { en: 'Holiday & Seasonal', id: 'Hari Raya & Musiman' } },
];
