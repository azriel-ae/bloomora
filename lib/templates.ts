export type Template = {
  slug: string;
  name: string;
  category: string;
  eyebrow: string;
  description: string;
  longDescription: string;
  priceFrom: number;
  duration: string;
  scenes: string[];
  palette: { background: string; accent: string; ink: string };
  badge?: string;
  art: 'botanical' | 'scrapbook' | 'letter';
};

export const templates: Template[] = [
  {
    slug: 'pressed-garden',
    name: 'Pressed Garden',
    category: 'Thank you',
    eyebrow: 'Elegant botanical gift',
    description: 'A quiet, floral keepsake for the person who makes ordinary days feel lighter.',
    longDescription: 'Pressed Garden pairs a soft opening, handwritten-style letter, and a gallery of small memories with an understated botanical rhythm.',
    priceFrom: 19000,
    duration: '3–30 days',
    scenes: ['Opening', 'Letter', 'Photo gallery', 'Appreciation', 'Closing'],
    palette: { background: '#f1eee5', accent: '#66745d', ink: '#25241f' },
    badge: 'Most loved',
    art: 'botanical',
  },
  {
    slug: 'our-little-archive',
    name: 'Our Little Archive',
    category: 'Friendship',
    eyebrow: 'Interactive memory scrapbook',
    description: 'A playful timeline of inside jokes, tiny victories, and all the places your story has been.',
    longDescription: 'Our Little Archive turns your favorite moments into a layered digital scrapbook, with prompts that invite the recipient to tap, reveal, and remember.',
    priceFrom: 39000,
    duration: '14–30 days',
    scenes: ['Envelope reveal', 'Memory timeline', 'Interactive question', 'Photo gallery', 'Closing'],
    palette: { background: '#f5e5dc', accent: '#b86f68', ink: '#352a26' },
    art: 'scrapbook',
  },
  {
    slug: 'just-a-letter',
    name: 'Just a Letter',
    category: 'Long-distance',
    eyebrow: 'Minimal letter & photo story',
    description: 'A considered note with room for photographs, pauses, and everything you could not fit in a text.',
    longDescription: 'Just a Letter is made for honest words: one beautiful cover, a calm letter scene, and a photo story that lets the message breathe.',
    priceFrom: 19000,
    duration: '3–14 days',
    scenes: ['Opening', 'Letter', 'Photo story', 'Closing'],
    palette: { background: '#efe7da', accent: '#8b6a4f', ink: '#2e2a25' },
    art: 'letter',
  },
];

export function getTemplate(slug: string) {
  return templates.find((template) => template.slug === slug);
}
