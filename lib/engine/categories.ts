import type { CategoryId, L10n } from './types.ts';

export const CATEGORIES: readonly { id: CategoryId; label: L10n }[] = [
  { id: 'romantic-anniversary', label: { en: 'Romance & Anniversaries', id: 'Romantis & Hari Jadi' } },
  { id: 'birthday-celebration', label: { en: 'Birthdays & Celebrations', id: 'Ulang Tahun & Perayaan' } },
  { id: 'family-friendship', label: { en: 'Family & Friendship', id: 'Keluarga & Persahabatan' } },
  { id: 'appreciation-thanks', label: { en: 'Appreciation & Thanks', id: 'Apresiasi & Terima Kasih' } },
  { id: 'graduation-achievement', label: { en: 'Graduation & Achievements', id: 'Kelulusan & Pencapaian' } },
  { id: 'special-moments', label: { en: 'Special Moments', id: 'Momen Spesial' } },
];
