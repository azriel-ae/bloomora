import type { TemplateConfig } from '../types.ts';

const text = (key: string, en: string, id: string, maxLength: number, required = false) => ({
  key,
  kind: 'text' as const,
  label: { en, id },
  maxLength,
  required,
});
const paragraph = (key: string, en: string, id: string, maxLength: number, required = false) => ({
  key,
  kind: 'textarea' as const,
  label: { en, id },
  maxLength,
  required,
});

/** A bespoke maroon scrapbook journey with an envelope, three-page menu and per-memory photo slots. */
export const forYouScrapbook: TemplateConfig = {
  id: 'for-you-scrapbook',
  version: 1,
  name: { en: 'For You, With Love', id: 'Untukmu, Dengan Cinta' },
  tagline: { en: 'A little scrapbook made from the things only you two know', id: 'Scrapbook kecil dari hal-hal yang cuma kalian berdua tahu' },
  description: {
    en: 'A sealed letter opens into a maroon scrapbook with a handwritten note, a rose garden, personal music and photographs tucked into polaroid frames.',
    id: 'Surat bersegel membuka scrapbook merah marun berisi tulisan personal, taman mawar, lagu pilihan, dan foto kenangan dalam bingkai polaroid.',
  },
  category: 'romantic-anniversary',
  tier: 'core',
  status: 'active',
  featured: false,
  popular: false,
  isNew: true,
  hasDemo: true,
  theme: {
    palette: {
      background: '#35131b',
      surface: '#421923',
      ink: '#fff1df',
      mutedInk: '#dfc6b5',
      accent: '#e4a1a6',
      accentInk: '#35131b',
      line: '#80515a',
    },
    display: 'serif-didone',
    body: 'serif-old',
    motion: 'standard',
    flowerTransition: true,
  },
  sections: [
    {
      id: 'opening', type: 'opening', variant: 'sealed-letter', fields: [
        paragraph('openingMessage', 'A note for a very particular person', 'Sebuah catatan untuk seseorang yang istimewa', 180, true),
      ], lists: [],
    },
    {
      id: 'hero', type: 'hero', variant: 'editorial-title', fields: [
        text('recipientName', 'Recipient', 'Untuk', 60, true),
        text('senderName', 'From', 'Dari', 60, true),
        text('occasion', 'The occasion', 'Momen spesial', 100),
        text('title', 'Scrapbook title', 'Judul scrapbook', 100, true),
        paragraph('subtitle', 'Short introduction', 'Pengantar singkat', 220),
      ], lists: [],
    },
    {
      id: 'letter', type: 'letter', variant: 'folio', fields: [
        text('letterGreeting', 'Greeting', 'Salam pembuka', 100, true),
        paragraph('letterBody', 'Your letter', 'Isi surat', 3000, true),
        text('letterSignoff', 'Sign-off', 'Salam penutup', 100),
      ], lists: [{
        key: 'moments', label: { en: 'Polaroid memories', id: 'Foto polaroid kenangan' }, itemLabel: { en: 'Memory', id: 'Kenangan' },
        itemFields: [
          text('caption', 'Photo caption', 'Cerita pada foto', 180, true),
          text('place', 'Place or date', 'Tempat atau tanggal', 100),
        ],
        systemFields: { photoId: 120, itemId: 80 },
        minItems: 1, maxItems: 8,
      }],
    },
    {
      id: 'flower', type: 'appreciation', variant: 'quiet-note', fields: [
        text('flowerHeading', 'Garden heading', 'Judul halaman bunga', 100, true),
        text('flowerQuoteOne', 'First rose note', 'Potongan kalimat pertama', 120, true),
        text('flowerQuoteTwo', 'Second rose note', 'Potongan kalimat kedua', 120, true),
        paragraph('flowerNote', 'A note among the flowers', 'Catatan di antara bunga', 360),
      ], lists: [],
    },
    {
      id: 'music', type: 'music', variant: 'quiet-player', fields: [
        text('trackTitle', 'Song title', 'Judul lagu', 80),
        text('trackArtist', 'Artist', 'Penyanyi', 60),
        paragraph('musicNote', 'Why this song', 'Alasan memilih lagu ini', 240),
      ], lists: [],
    },
    {
      id: 'closing', type: 'closing', variant: 'signature', fields: [
        paragraph('closingLine', 'Last words', 'Kalimat penutup', 240, true),
        text('signature', 'Signature', 'Tanda tangan', 60, true),
      ], lists: [],
    },
  ],
  sample: {
    en: {
      fields: {
        openingMessage: 'Take your time. This one is just for you.',
        recipientName: 'Maya', senderName: 'Arga', occasion: 'Our third year, still choosing us',
        title: 'Small things, all ours', subtitle: 'A few pages for the days I never want to forget.',
        letterGreeting: 'Maya, my favorite person,',
        letterBody: 'I keep thinking about how love showed up for us: not all at once, but in small, ordinary ways. In your hand finding mine under the table. In the extra sambal you save for me. In the quiet drive home when neither of us needs to fill the silence.\n\nThank you for making room for every version of me, even the tired one who forgets where the keys are. I hope these pages feel a little like our favorite evenings: warm, unhurried, and better because you are here.\n\nI would choose the long way home with you, every time.',
        letterSignoff: 'Always,',
        flowerHeading: 'For the way you make things bloom',
        flowerQuoteOne: 'You make ordinary days feel kept.',
        flowerQuoteTwo: 'There is always room for one more walk.',
        flowerNote: 'A rose for every small kindness I forgot to say thank you for in the moment.',
        trackTitle: 'Kiss Me', trackArtist: 'Sixpence None the Richer',
        musicNote: 'This one always sounds like the ride back from the coast, windows down, your hand in mine.',
        closingLine: 'The best part of every story is still the part we have not lived yet.', signature: 'Arga',
      },
      lists: { moments: [
        { itemId: 'memory-one', caption: 'The afternoon the rain changed our plans', place: 'Bandung, July' },
        { itemId: 'memory-two', caption: 'Our first kitchen, still a little crooked', place: 'The old apartment' },
        { itemId: 'memory-three', caption: 'A Sunday with nowhere else to be', place: 'Home' },
      ] },
    },
    id: {
      fields: {
        openingMessage: 'Pelan-pelan saja. Yang ini memang khusus untukmu.',
        recipientName: 'Maya', senderName: 'Arga', occasion: 'Tiga tahun bersama, tetap memilih kita',
        title: 'Hal-hal kecil milik kita', subtitle: 'Beberapa halaman untuk hari-hari yang selalu ingin kuingat.',
        letterGreeting: 'Maya, orang kesayanganku,',
        letterBody: 'Aku sering memikirkan bagaimana cinta hadir di antara kita: bukan sekaligus, melainkan lewat hal-hal kecil yang biasa. Tanganmu mencari tanganku di bawah meja. Sambal tambahan yang kamu sisihkan untukku. Perjalanan pulang yang tenang, saat tak satu pun dari kita perlu mengisi jeda.\n\nTerima kasih sudah menyediakan ruang untuk setiap versiku, termasuk yang lelah dan sering lupa menaruh kunci. Semoga halaman-halaman ini terasa seperti malam-malam kesukaan kita: hangat, tanpa buru-buru, dan selalu lebih menyenangkan karena kamu ada di sini.\n\nAku akan selalu memilih jalan pulang yang lebih jauh kalau bersamamu.',
        letterSignoff: 'Selalu,',
        flowerHeading: 'Untuk caramu membuat semuanya tumbuh',
        flowerQuoteOne: 'Kamu membuat hari biasa terasa istimewa.',
        flowerQuoteTwo: 'Selalu ada waktu untuk jalan sore lagi.',
        flowerNote: 'Satu mawar untuk setiap kebaikan kecil yang lupa kusyukuri saat itu juga.',
        trackTitle: 'Kiss Me', trackArtist: 'Sixpence None the Richer',
        musicNote: 'Lagu ini selalu mengingatkanku pada perjalanan pulang dari pantai, jendela terbuka, tanganmu di tanganku.',
        closingLine: 'Bagian terbaik dari kisah kita masih menunggu untuk dijalani.', signature: 'Arga',
      },
      lists: { moments: [
        { itemId: 'memory-one', caption: 'Sore ketika hujan mengubah rencana kita', place: 'Bandung, Juli' },
        { itemId: 'memory-two', caption: 'Dapur pertama kita yang sedikit berantakan', place: 'Apartemen lama' },
        { itemId: 'memory-three', caption: 'Hari Minggu tanpa tujuan lain', place: 'Rumah' },
      ] },
    },
  },
};
