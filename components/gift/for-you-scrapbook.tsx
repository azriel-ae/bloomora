'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import type { GiftMode, GiftExperienceProps } from './gift-experience';
import type { RenderSection } from '@/lib/engine/types';

type Page = 'letter' | 'flower' | 'music';
const field = (section: RenderSection | undefined, key: string) => section?.fields[key] ?? '';
const paragraphs = (copy: string) => copy.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

function RoseBouquet() {
  return (
    <svg className="fy-bouquet" viewBox="0 0 360 360" role="img" aria-label="Ilustrasi buket mawar orisinal">
      <defs>
        <linearGradient id="fy-paper" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#f4dfc1" /><stop offset="1" stopColor="#d4af8e" /></linearGradient>
        <linearGradient id="fy-rose" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#dc8490" /><stop offset="1" stopColor="#862c42" /></linearGradient>
      </defs>
      <g fill="none" stroke="#597454" strokeLinecap="round" strokeWidth="5">
        <path d="M180 286L102 112M183 286L145 83M182 286L205 74M184 286L257 113M183 286L72 169M183 286L290 177" />
      </g>
      <g fill="#78906d" stroke="#4e684e" strokeWidth="2">
        <path d="M121 172C82 158 75 130 78 117c24 6 47 23 43 55Z" /><path d="M147 143c-25-33-16-58-7-69 18 18 29 40 7 69Z" />
        <path d="M207 141c3-42 26-56 39-57 1 27-8 49-39 57Z" /><path d="M238 180c26-34 53-32 64-25-14 22-32 36-64 25Z" />
        <path d="M163 206c-42 1-57-21-59-34 26-4 49 3 59 34Z" /><path d="M213 208c38-17 60-4 67 7-22 16-46 22-67-7Z" />
      </g>
      <g fill="url(#fy-rose)" stroke="#6f2739" strokeWidth="2">
        <path d="M83 126c-22-17-14-46 7-50 12-24 44-20 49 4 20 15 11 45-12 49-13 19-37 18-44-3Z" />
        <path d="M132 91c-15-20-3-45 18-43 17-19 43-7 39 14 14 20-2 43-24 39-17 15-35 10-33-10Z" />
        <path d="M195 85c-9-23 8-43 28-35 22-14 43 5 33 24 8 23-14 41-33 29-21 8-36-1-28-18Z" />
        <path d="M246 128c-17-18-8-44 13-45 13-22 41-14 41 8 18 17 5 44-18 43-15 17-37 14-36-6Z" />
        <path d="M62 177c-12-20 1-43 22-40 18-17 43-3 37 18 12 21-6 43-28 36-18 13-36 5-31-14Z" />
        <path d="M264 187c-7-23 11-41 31-32 23-12 42 9 30 27 6 24-18 39-35 25-22 5-36-6-26-20Z" />
      </g>
      <g fill="none" stroke="#f5c3b2" strokeLinecap="round" strokeWidth="3">
        <path d="M101 88c9-10 20-8 25-1M156 57c8-8 18-6 23 0M226 53c7-6 17-3 20 3M275 97c9-6 19-2 20 5M88 157c8-7 17-6 21 0M293 169c8-4 16 0 18 6" />
      </g>
      <path d="M137 247c15 16 45 22 71 0l34 72H103Z" fill="url(#fy-paper)" stroke="#bc987b" strokeWidth="2" />
      <path d="M151 251c15 16 31 17 46 0l-5 43h-34Z" fill="#9e3b50" stroke="#74283d" strokeWidth="2" />
      <path d="M181 286c-20 1-28 20-16 31 12-2 18-12 16-31Zm1 0c20 1 28 20 16 31-12-2-18-12-16-31Z" fill="#d88c91" stroke="#9b475a" strokeWidth="2" />
    </svg>
  );
}

function Polaroid({ memory, index }: { memory: Record<string, string>; index: number }) {
  return (
    <figure className={`fy-polaroid fy-polaroid-${index % 3}`} data-memory-id={memory.itemId || undefined}>
      <div className="fy-polaroid-image">
        {memory.imageSrc ? <Image src={memory.imageSrc} alt={memory.caption || `Kenangan ${index + 1}`} fill sizes="(max-width: 700px) 74vw, 280px" unoptimized /> : <span className="fy-photo-placeholder" aria-hidden="true"><i /><i /><i /></span>}
      </div>
      <figcaption><span>{memory.caption}</span>{memory.place && <small>{memory.place}</small>}</figcaption>
    </figure>
  );
}

function PageMenu({ onChoose }: { onChoose: (page: Page) => void }) {
  const pages: { id: Page; title: string; label: string; art: string }[] = [
    { id: 'letter', title: 'Letter', label: 'A note I wrote just for you', art: 'paper' },
    { id: 'flower', title: 'Flower', label: 'A garden of little things I love', art: 'rose' },
    { id: 'music', title: 'A song for you', label: 'Press play when you have a minute', art: 'record' },
  ];
  return (
    <section className="fy-home" aria-labelledby="fy-home-title">
      <p className="fy-kicker">A LITTLE BOOK OF US</p>
      <h1 id="fy-home-title">For you</h1>
      <p className="fy-home-intro">Pilih satu halaman. Ada hal-hal kecil yang ingin kusampaikan di sana.</p>
      <div className="fy-menu-cards">
        {pages.map((page, index) => <button type="button" className={`fy-menu-card fy-menu-card-${page.art}`} onClick={() => onChoose(page.id)} key={page.id}>
          <span className="fy-card-number">0{index + 1}</span>
          <span className="fy-menu-art" aria-hidden="true">{page.art === 'rose' ? <RoseBouquet /> : page.art === 'record' ? <span className="fy-menu-record" /> : <span className="fy-menu-paper"><i /><i /><i /></span>}</span>
          <span className="fy-menu-card-title">{page.title}</span><span className="fy-menu-card-label">{page.label}</span><span className="fy-card-arrow" aria-hidden="true">↗</span>
        </button>)}
      </div>
      <p className="fy-handnote">take your time, there is no rush</p>
    </section>
  );
}

export function ForYouScrapbook({ model, mode, title, navActions, footer, audioSrc, style }: {
  model: GiftExperienceProps['model']; mode: GiftMode; title: string; navActions?: ReactNode; footer?: ReactNode; audioSrc?: string; style: React.CSSProperties;
}) {
  const [opened, setOpened] = useState(mode === 'preview');
  const [envelopeOpening, setEnvelopeOpening] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const openEnvelope = () => {
    if (envelopeOpening) return;
    setEnvelopeOpening(true);
    window.setTimeout(() => setOpened(true), 680);
  };
  const sections = model.sections;
  const opening = sections.find((section) => section.id === 'opening');
  const hero = sections.find((section) => section.id === 'hero');
  const letter = sections.find((section) => section.id === 'letter');
  const flower = sections.find((section) => section.id === 'flower');
  const music = sections.find((section) => section.id === 'music');
  const closing = sections.find((section) => section.id === 'closing');
  const moments = letter?.lists.moments ?? [];
  const embedded = mode === 'preview';
  const signature = field(closing, 'signature');

  return (
    <div className="bl-root fy-root" style={style} data-mode={mode} data-embedded={embedded || undefined} data-art-style="scrapbook-memories" data-template-id="for-you-scrapbook">
      {!opened ? <section className="fy-opening" aria-labelledby="fy-opening-title">
        <div className="fy-opening-frame">
          <p className="fy-kicker">A LETTER, SEALED WITH LOVE</p>
          <h1 id="fy-opening-title">Untuk {field(hero, 'recipientName') || 'seseorang yang istimewa'}</h1>
          <p className="fy-opening-copy">{field(opening, 'openingMessage')}</p>
          <button type="button" className={`fy-envelope-button${envelopeOpening ? ' is-opening' : ''}`} onClick={openEnvelope} disabled={envelopeOpening} aria-label="Buka amplop surat">
            <span className="fy-envelope-back" /><span className="fy-envelope-paper"><span>For you</span></span><span className="fy-envelope-front" /><span className="fy-envelope-flap" /><span className="fy-wax-seal">F</span>
          </button>
          <button type="button" className="fy-open-button" onClick={openEnvelope} disabled={envelopeOpening}>{envelopeOpening ? 'Membuka surat...' : 'Buka suratnya'}</button>
          <p className="fy-open-hint">sentuh segel untuk membuka</p>
          <p className="fy-from">Dengan penuh sayang, {field(hero, 'senderName')}</p>
        </div>
      </section> : <>
        <header className="fy-topbar">
          <button type="button" className="fy-brand" onClick={() => setPage(null)} aria-label="Kembali ke menu For you">{title}</button>
          <div className="fy-nav-actions">{navActions}<button type="button" className="fy-menu-back" onClick={() => setPage(null)}>{page ? 'For you' : 'Halaman awal'}</button></div>
        </header>
        {!page ? <PageMenu onChoose={setPage} /> : <main className="fy-page-wrap">
          <button type="button" className="fy-back" onClick={() => setPage(null)}>← <span>Kembali ke For you</span></button>
          {page === 'letter' && <section className="fy-letter-page" aria-labelledby="fy-letter-title">
            <div className="fy-letter-copy">
              <p className="fy-kicker">A LETTER FROM {field(hero, 'senderName').toUpperCase()}</p>
              <h1 id="fy-letter-title">{field(letter, 'letterGreeting')}</h1>
              <article className="fy-paper">
                {paragraphs(field(letter, 'letterBody')).map((part, index) => <p key={index}>{part}</p>)}
                {field(letter, 'letterSignoff') && <p className="fy-signoff">{field(letter, 'letterSignoff')}<br /><strong>{field(hero, 'senderName')}</strong></p>}
              </article>
              <p className="fy-page-caption">{field(hero, 'occasion')}</p>
            </div>
            <aside className="fy-memory-gallery" aria-label="Galeri foto kenangan">
              <div className="fy-photo-stamp">our days,<br />kept close</div>
              {moments.map((memory, index) => <Polaroid memory={memory} index={index} key={memory.itemId || `${memory.caption}-${index}`} />)}
            </aside>
          </section>}
          {page === 'flower' && <section className="fy-flower-page" aria-labelledby="fy-flower-title">
            <p className="fy-kicker">A LITTLE GARDEN, JUST FOR YOU</p>
            <h1 id="fy-flower-title">{field(flower, 'flowerHeading')}</h1>
            <p className="fy-flower-quote fy-flower-quote-left">“{field(flower, 'flowerQuoteOne')}”</p>
            <RoseBouquet />
            <p className="fy-flower-quote fy-flower-quote-right">“{field(flower, 'flowerQuoteTwo')}”</p>
            <div className="fy-flower-note"><span className="fy-note-rule" />{field(flower, 'flowerNote')}</div>
          </section>}
          {page === 'music' && <section className="fy-music-page" aria-labelledby="fy-music-title">
            <p className="fy-kicker">A SONG, SAVED FOR YOU</p>
            <h1 id="fy-music-title">A song for you</h1>
            <p className="fy-music-note">{field(music, 'musicNote')}</p>
            <div className="fy-record-scene">
              <div className="fy-vinyl" aria-hidden="true"><span className="fy-vinyl-label">{field(music, 'trackTitle').slice(0, 1) || 'F'}</span></div>
              <div className="fy-album-cover">
                {moments[0]?.imageSrc ? <Image src={moments[0].imageSrc} alt={moments[0].caption || 'Foto kenangan'} fill sizes="(max-width: 700px) 45vw, 260px" unoptimized /> : <span className="fy-album-placeholder"><span>for you</span><i /></span>}
              </div>
            </div>
            <div className="fy-track-card"><span className="fy-track-eyebrow">OUR SONG</span><h2>{field(music, 'trackTitle') || 'Lagu pilihanmu'}</h2><p>{field(music, 'trackArtist')}</p>{audioSrc ? <audio className="fy-audio" controls preload="metadata" src={audioSrc}>Browser kamu belum mendukung pemutar audio.</audio> : <p className="fy-audio-hint">{field(music, 'trackTitle') ? 'Lagu ini disimpan sebagai kenangan. Audio bisa ditambahkan dari editor.' : 'Tambahkan judul dan audio lagu pilihanmu di editor.'}</p>}</div>
          </section>}
          {closing && <footer className="fy-closing"><p>{field(closing, 'closingLine')}</p>{signature && <span>{signature}</span>}{footer}</footer>}
        </main>}
      </>}
    </div>
  );
}
