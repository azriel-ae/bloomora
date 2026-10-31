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
];
