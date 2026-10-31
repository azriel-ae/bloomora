import type { TemplateConfig } from '../types.ts';
import { S } from './builders.ts';

/** Featured template: an editorial, romantic story told chapter by chapter. */
export const chapterOfUs: TemplateConfig = {
  id: 'chapter-of-us',
  version: 1,
  name: { en: 'Chapter of Us', id: 'Bab Tentang Kita' },
  tagline: { en: 'An editorial love story, told one chapter at a time', id: 'Kisah cinta bergaya editorial, diceritakan satu bab demi satu bab' },
  description: {
    en: 'A sealed letter opens onto a magazine-style title page, a handwritten-feeling letter, a timeline of chapters, a gallery of illustrated plates, and a deck of reasons the recipient can turn one by one.',
    id: 'Surat bersegel terbuka ke halaman judul bergaya majalah, surat yang terasa ditulis tangan, linimasa bab, galeri ilustrasi, dan setumpuk alasan yang bisa dibuka satu per satu.',
  },
  category: 'anniversary', tier: 'core', status: 'active',
  featured: true, popular: true, isNew: true, hasDemo: true,
  theme: {
    palette: { background: '#f6efe6', surface: '#fffaf3', ink: '#2a1d1b', mutedInk: '#65504a', accent: '#8a2f3c', accentInk: '#fff7f0', line: '#dccfc0' },
    display: 'serif-didone', body: 'serif-old', motion: 'subtle',
  },
  sections: [
    S.opening('sealed-letter'), S.hero('editorial-title'), S.letter('folio'), S.timeline('vertical-chapters', 3, 7),
    S.gallery('plates', 3, 8), S.message('reasons-deck', 3, 10), S.appreciation('quiet-note'), S.music(), S.closing('signature'),
  ],
  sample: {
    en: {
      fields: {
        recipientName: 'Maya', senderName: 'Arga', occasion: 'Three years together',
        title: 'Three Years, One Story', subtitle: 'A small book of the days that became ours.', dateLine: '14 February 2023 — 14 February 2026',
        letterGreeting: 'Dear Maya,',
        letterBody: 'I wanted to give you something that could hold more than a card. So I wrote this down, one chapter at a time, in the order we lived it.\n\nThree years ago I did not know that a quiet Tuesday could become the day I measure everything against. You arrived with a borrowed umbrella and an opinion about the coffee, and somehow I have been listening ever since.\n\nWhat I love most is not the big moments. It is that you hum while you cook, that you leave notes in my coat pockets, that you make every ordinary street feel as if it has a secret. Thank you for making a home out of us.\n\nRead this slowly. There is no hurry, and there is a little more waiting at the end.',
        letterSignoff: 'Always yours,',
        reasonsIntro: 'Six of the many reasons',
        appreciationText: 'Thank you for the patience on my bad days and the joy on my good ones. I am a better person in your orbit.',
        closingLine: 'Here is to the next chapter, and every one after it.', signature: 'Arga',
      },
      lists: {
        chapters: [
          { when: 'February 2023', title: 'The borrowed umbrella', text: 'It rained on the way to a place neither of us wanted to be. You offered half of your umbrella and I accepted before I could be polite about it.' },
          { when: 'August 2023', title: 'The long drive', text: 'Six hours, one playlist, two wrong turns. We arrived late and happier than either of us had planned to be.' },
          { when: 'March 2024', title: 'Our first kitchen', text: 'Mismatched plates, one working burner, and a soup that was better than it had any right to be. We called it home that night.' },
          { when: 'November 2024', title: 'The hard winter', text: 'We learned how to be quiet together, and how to stay. That was the year I stopped counting days and started counting on you.' },
          { when: 'February 2026', title: 'Today', text: 'Three years, and I still look for you first in every room.' },
        ],
        moments: [
          { caption: 'The bridge where you said yes to dinner', place: 'Old Town' },
          { caption: 'Your handwriting on the first recipe', place: 'Our kitchen' },
          { caption: 'Rain again, and nobody minded', place: 'The bus stop on Rinjani Street' },
          { caption: 'The view from the longest walk', place: 'Hilltop' },
          { caption: 'Sunday, unplanned', place: 'Home' },
          { caption: 'The night we stayed up talking', place: 'The balcony' },
        ],
        reasons: [
          { text: 'You laugh before the punchline, and it is always better than the joke.' },
          { text: 'You remember the small things I forget I ever told you.' },
          { text: 'You make quiet feel like company.' },
          { text: 'You are kind to people who will never find out.' },
          { text: 'You still read the last page first, and I still pretend to be annoyed.' },
          { text: 'With you, ordinary Tuesdays are the good ones.' },
        ],
      },
    },
    id: {
      fields: {
        recipientName: 'Maya', senderName: 'Arga', occasion: 'Tiga tahun bersama',
        title: 'Tiga Tahun, Satu Cerita', subtitle: 'Buku kecil tentang hari-hari yang menjadi milik kita.', dateLine: '14 Februari 2023 — 14 Februari 2026',
        letterGreeting: 'Untuk Maya,',
        letterBody: 'Aku ingin memberimu sesuatu yang muat lebih banyak daripada sekadar kartu. Jadi aku menuliskannya, satu bab demi satu bab, sesuai urutan kita menjalaninya.\n\nTiga tahun lalu aku belum tahu bahwa sebuah Selasa yang tenang bisa jadi hari yang kujadikan ukuran untuk segalanya. Kamu datang dengan payung pinjaman dan pendapat tentang kopi, dan entah bagaimana aku terus mendengarkan sejak saat itu.\n\nYang paling kusuka bukan momen-momen besarnya. Tapi caramu bersenandung saat memasak, catatan kecil yang kamu selipkan di saku mantelku, dan caramu membuat jalan yang biasa terasa menyimpan rahasia. Terima kasih sudah menjadikan kita sebuah rumah.\n\nBacalah pelan-pelan. Tidak perlu terburu-buru, dan masih ada sedikit penantian di bagian akhir.',
        letterSignoff: 'Selalu milikmu,',
        reasonsIntro: 'Enam dari sekian banyak alasan',
        appreciationText: 'Terima kasih atas kesabaranmu di hari-hari burukku dan kegembiraanmu di hari-hari baikku. Aku jadi orang yang lebih baik di dekatmu.',
        closingLine: 'Untuk bab berikutnya, dan semua bab sesudahnya.', signature: 'Arga',
      },
      lists: {
        chapters: [
          { when: 'Februari 2023', title: 'Payung pinjaman', text: 'Hujan turun di jalan menuju tempat yang tak ingin kita datangi. Kamu menawarkan separuh payungmu dan aku menerimanya sebelum sempat bersikap sopan.' },
          { when: 'Agustus 2023', title: 'Perjalanan panjang', text: 'Enam jam, satu daftar lagu, dua kali salah belok. Kita tiba terlambat dan lebih bahagia daripada yang kita rencanakan.' },
          { when: 'Maret 2024', title: 'Dapur pertama kita', text: 'Piring yang tak serasi, satu kompor yang menyala, dan sup yang jauh lebih enak daripada seharusnya. Malam itu kita menyebutnya rumah.' },
          { when: 'November 2024', title: 'Musim dingin yang berat', text: 'Kita belajar diam bersama, dan belajar bertahan. Itulah tahun ketika aku berhenti menghitung hari dan mulai bersandar padamu.' },
          { when: 'Februari 2026', title: 'Hari ini', text: 'Tiga tahun, dan aku masih mencarimu lebih dulu di setiap ruangan.' },
        ],
        moments: [
          { caption: 'Jembatan tempat kamu bilang iya untuk makan malam', place: 'Kota Lama' },
          { caption: 'Tulisan tanganmu di resep pertama', place: 'Dapur kita' },
          { caption: 'Hujan lagi, dan tak ada yang keberatan', place: 'Halte Jalan Rinjani' },
          { caption: 'Pemandangan dari jalan kaki terpanjang', place: 'Puncak bukit' },
          { caption: 'Hari Minggu yang tak direncanakan', place: 'Rumah' },
          { caption: 'Malam ketika kita begadang bercerita', place: 'Balkon' },
        ],
        reasons: [
          { text: 'Kamu tertawa sebelum bagian lucunya, dan itu selalu lebih lucu daripada leluconnya.' },
          { text: 'Kamu mengingat hal-hal kecil yang aku sendiri lupa pernah kuceritakan.' },
          { text: 'Kamu membuat sunyi terasa seperti ditemani.' },
          { text: 'Kamu baik kepada orang-orang yang tak akan pernah tahu.' },
          { text: 'Kamu masih membaca halaman terakhir lebih dulu, dan aku masih pura-pura kesal.' },
          { text: 'Bersamamu, Selasa yang biasa adalah hari yang baik.' },
        ],
      },
    },
  },
};
