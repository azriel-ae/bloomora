'use client';

import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import type { RenderSection } from '@/lib/engine/types';
import type { GiftLabels } from '@/lib/engine/labels';
import { fmt } from '@/lib/engine/labels';
import { deckReducer, lightboxReducer, pad2, roman, swipeDirection } from '@/lib/engine/interaction';
import { IconClose, IconNext, IconPause, IconPlay, IconPrev, PlateArt, Reveal, useGift } from './parts';

type Common = { section: RenderSection; labels: GiftLabels };
const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

function Head({ id, chapter, label, labels }: { id: string; chapter: number | null; label: string; labels: GiftLabels }) {
  return (
    <header className="bl-head">
      {chapter !== null && <p className="bl-eyebrow">{labels.chapterWord} {roman(chapter)}</p>}
      <h2 className="bl-h2" id={id}>{label}</h2>
    </header>
  );
}

/* ------------------------------ Opening ------------------------------ */
const first = (s: string) => (s.trim()[0] ?? '').toLocaleUpperCase();

export function OpeningScene({ section, labels, phase, onOpen }: Common & { phase: 'sealed' | 'opening' | 'leaving'; onOpen: () => void }) {
  const { recipientName, senderName, occasion } = section.fields;
  const initials = `${first(senderName)}${first(recipientName)}`;
  return (
    <section className={`bl-opening bl-phase-${phase}`} aria-label={labels.sectionOpening}>
      <div className="bl-opening-inner">
        {recipientName && (
          <>
            <p className="bl-eyebrow">{labels.forLabel}</p>
            <h1 className="bl-open-recipient">{recipientName}</h1>
          </>
        )}
        <svg className="bl-envelope" viewBox="0 -40 320 280" aria-hidden="true" focusable="false" onClick={phase === 'sealed' ? onOpen : undefined}>
          <path className="bl-flap-open" d="M20 70L160 -20L300 70Z" />
          <rect className="bl-env-back" x="20" y="70" width="280" height="150" />
          <g className="bl-env-letter">
            <rect x="40" y="84" width="240" height="130" />
            <path d="M64 118H200M64 140H256M64 160H232M64 180H180" />
          </g>
          <path className="bl-env-front" d="M20 70L160 160L300 70V220H20Z" />
          <path className="bl-env-fold" d="M20 220L140 142M300 220L180 142" />
          <path className="bl-flap" d="M20 70L160 160L300 70Z" />
          <g className="bl-seal">
            <circle cx="160" cy="160" r="27" />
            <circle className="bl-seal-ring" cx="160" cy="160" r="21" />
            <text x="160" y="167" textAnchor="middle">{initials}</text>
          </g>
        </svg>
        {occasion && <p className="bl-open-occasion">{occasion}</p>}
        <button type="button" className="bl-btn" onClick={onOpen} disabled={phase !== 'sealed'}>{labels.openButton}</button>
        <p className="bl-open-hint">{labels.openHint}</p>
        {senderName && <p className="bl-open-from">{labels.fromLabel} {senderName}</p>}
      </div>
    </section>
  );
}

/* ------------------------------- Hero -------------------------------- */
export function Hero({ section, labels, recipient, sender }: Common & { recipient: string; sender: string }) {
  const { title, subtitle, dateLine } = section.fields;
  return (
    <section id="bl-hero" data-bl-section="hero" className="bl-sec bl-hero" aria-labelledby="bl-hero-title">
      <div className="bl-hero-frame">
        <svg className="bl-rings" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
          <circle cx="47" cy="32" r="22" /><circle cx="73" cy="32" r="22" />
        </svg>
        <h1 id="bl-hero-title" className="bl-hero-title">{title}</h1>
        {subtitle && <p className="bl-hero-sub">{subtitle}</p>}
        {dateLine && <p className="bl-hero-date">{dateLine}</p>}
        {(recipient || sender) && (
          <p className="bl-hero-for">
            {recipient && <span>{labels.forLabel} {recipient}</span>}
            {recipient && sender && <span className="bl-dot" aria-hidden="true" />}
            {sender && <span>{labels.fromLabel} {sender}</span>}
          </p>
        )}
      </div>
      <span className="bl-cue" aria-hidden="true" />
    </section>
  );
}

/* ------------------------------- Letter ------------------------------ */
export function Letter({ section, labels, chapter }: Common & { chapter: number }) {
  const { letterGreeting, letterBody, letterSignoff } = section.fields;
  return (
    <section id="bl-letter" data-bl-section="letter" className="bl-sec bl-letter" aria-labelledby="bl-h-letter">
      <Reveal>
        <Head id="bl-h-letter" chapter={chapter} label={labels.sectionLetter} labels={labels} />
        <article className="bl-paper">
          {letterGreeting && <p className="bl-letter-greeting">{letterGreeting}</p>}
          <div className="bl-letter-body">{paragraphs(letterBody).map((p, i) => <p key={i}>{p}</p>)}</div>
          {letterSignoff && <p className="bl-letter-signoff">{letterSignoff}</p>}
        </article>
      </Reveal>
    </section>
  );
}

/* ------------------------------ Timeline ----------------------------- */
export function Timeline({ section, labels, chapter }: Common & { chapter: number }) {
  return (
    <section id="bl-timeline" data-bl-section="timeline" className="bl-sec bl-timeline" aria-labelledby="bl-h-timeline">
      <Reveal><Head id="bl-h-timeline" chapter={chapter} label={labels.sectionTimeline} labels={labels} /></Reveal>
      <ol className="bl-chapters">
        {section.lists.chapters.map((c, i) => (
          <Reveal tag="li" key={i} className="bl-chapter">
            <span className="bl-chapter-num" aria-hidden="true">{pad2(i + 1)}</span>
            <p className="bl-chapter-when">{c.when}</p>
            <div className="bl-chapter-body">
              {c.title && <h3 className="bl-h3">{c.title}</h3>}
              {c.text && <p>{c.text}</p>}
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------- Gallery ----------------------------- */
function Lightbox({ items, index, dispatch, labels, onClose }: {
  items: Record<string, string>[]; index: number; dispatch: (a: { type: 'next' | 'prev' }) => void; labels: GiftLabels; onClose: () => void;
}) {
  const { root } = useGift();
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const el = root ?? document.documentElement;
    const prev = el.style.overflow;
    el.style.overflow = 'hidden';
    return () => { el.style.overflow = prev; };
  }, [root]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); dispatch({ type: 'next' }); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); dispatch({ type: 'prev' }); }
      else if (e.key === 'Tab') {
        const f = Array.from(boxRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
        if (!f.length) return;
        const firstEl = f[0]; const lastEl = f[f.length - 1];
        const a = document.activeElement;
        // Focus can land on <body> after a click inside the dialog; pull it back in instead of leaking to the page.
        if (!boxRef.current?.contains(a) || a === boxRef.current) { e.preventDefault(); (e.shiftKey ? lastEl : firstEl).focus(); }
        else if (e.shiftKey && a === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && a === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dispatch, onClose]);

  const item = items[index];
  return (
    <div className="bl-lightbox" role="dialog" aria-modal="true" aria-label={labels.lightboxTitle} ref={boxRef} tabIndex={-1} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button type="button" ref={closeRef} className="bl-lb-btn bl-lb-close" aria-label={labels.lightboxClose} onClick={onClose}><IconClose /></button>
      <figure
        className="bl-lb-fig"
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const dir = swipeDirection(e.clientX - start.current.x, e.clientY - start.current.y);
          start.current = null;
          if (dir) dispatch({ type: dir });
        }}
      >
        <div className="bl-lb-plate"><PlateArt index={index} /></div>
        <figcaption>
          {item?.caption && <p className="bl-lb-caption">{item.caption}</p>}
          {item?.place && <p className="bl-lb-place">{item.place}</p>}
        </figcaption>
      </figure>
      <div className="bl-lb-bar">
        <button type="button" className="bl-lb-btn" aria-label={labels.lightboxPrev} onClick={() => dispatch({ type: 'prev' })}><IconPrev /></button>
        <p className="bl-lb-count" role="status" aria-live="polite">{fmt(labels.lightboxCounter, { current: index + 1, total: items.length })}</p>
        <button type="button" className="bl-lb-btn" aria-label={labels.lightboxNext} onClick={() => dispatch({ type: 'next' })}><IconNext /></button>
      </div>
    </div>
  );
}

export function Gallery({ section, labels, chapter }: Common & { chapter: number }) {
  const items = section.lists.moments;
  const [lb, dispatch] = useReducer(lightboxReducer, { open: false, index: 0, count: items.length });
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => { dispatch({ type: 'setCount', count: items.length }); }, [items.length]);
  const close = () => { dispatch({ type: 'close' }); const o = opener.current; opener.current = null; requestAnimationFrame(() => o?.focus()); };
  return (
    <section id="bl-gallery" data-bl-section="gallery" className="bl-sec bl-gallery" aria-labelledby="bl-h-gallery">
      <Reveal><Head id="bl-h-gallery" chapter={chapter} label={labels.sectionGallery} labels={labels} /></Reveal>
      <ul className="bl-plates">
        {items.map((m, i) => (
          <Reveal tag="li" key={i} className="bl-plate-li">
            <button
              type="button" className="bl-plate"
              aria-label={fmt(labels.openPlate, { caption: m.caption || m.place || String(i + 1) })}
              onClick={(e) => { opener.current = e.currentTarget; dispatch({ type: 'open', index: i }); }}
            >
              <span className="bl-plate-frame"><PlateArt index={i} /></span>
              <span className="bl-plate-cap">
                <span>{m.caption}</span>
                {m.place && <span className="bl-plate-place">{m.place}</span>}
              </span>
            </button>
          </Reveal>
        ))}
      </ul>
      {lb.open && <Lightbox items={items} index={lb.index} dispatch={dispatch} labels={labels} onClose={close} />}
    </section>
  );
}

/* ------------------------------ Reasons deck ------------------------- */
export function Reasons({ section, labels, chapter }: Common & { chapter: number }) {
  const items = section.lists.reasons;
  const [deck, dispatch] = useReducer(deckReducer, { open: [] as number[], count: items.length });
  useEffect(() => { dispatch({ type: 'setCount', count: items.length }); }, [items.length]);
  const intro = section.fields.reasonsIntro;
  return (
    <section id="bl-message" data-bl-section="message" className="bl-sec bl-reasons" aria-labelledby="bl-h-message">
      <Reveal>
        <Head id="bl-h-message" chapter={chapter} label={labels.sectionMessage} labels={labels} />
        {intro && <p className="bl-lead">{intro}</p>}
      </Reveal>
      <ul className="bl-cards">
        {items.map((r, i) => {
          const open = deck.open.includes(i);
          return (
            <Reveal tag="li" key={i} className="bl-card-li">
              <button
                type="button" className="bl-card" aria-expanded={open}
                aria-label={open ? `${fmt(labels.reasonClose, { n: i + 1 })}. ${r.text}` : fmt(labels.reasonOpen, { n: i + 1 })}
                onClick={() => dispatch({ type: 'toggle', index: i })}
              >
                <span className="bl-card-inner">
                  <span className="bl-face bl-face-closed" aria-hidden={open}>
                    <span className="bl-card-num">{roman(i + 1)}</span>
                    <span className="bl-card-label">{labels.reasonLabel}</span>
                  </span>
                  <span className="bl-face bl-face-open" aria-hidden={!open}><span className="bl-card-text">{r.text}</span></span>
                </span>
              </button>
            </Reveal>
          );
        })}
      </ul>
      <div className="bl-deck-controls">
        <button type="button" className="bl-btn bl-btn--ghost" onClick={() => dispatch({ type: 'openNext' })} disabled={deck.open.length >= items.length}>{labels.reasonsOpenNext}</button>
        <button type="button" className="bl-btn bl-btn--ghost" onClick={() => dispatch({ type: 'closeAll' })} disabled={deck.open.length === 0}>{labels.reasonsCloseAll}</button>
        <p className="bl-deck-status" role="status" aria-live="polite">{fmt(labels.reasonsStatus, { open: deck.open.length, total: items.length })}</p>
      </div>
    </section>
  );
}

/* ----------------------------- Appreciation -------------------------- */
export function Appreciation({ section, labels, chapter }: Common & { chapter: number }) {
  return (
    <section id="bl-appreciation" data-bl-section="appreciation" className="bl-sec bl-appreciation" aria-labelledby="bl-h-appreciation">
      <Reveal>
        <Head id="bl-h-appreciation" chapter={chapter} label={labels.sectionAppreciation} labels={labels} />
        <p className="bl-quiet">{section.fields.appreciationText}</p>
      </Reveal>
    </section>
  );
}

/* -------------------------------- Music ------------------------------ */
export function Music({ section, labels, chapter, src }: Common & { chapter: number; src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const { trackTitle, trackArtist } = section.fields;
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => setPlaying(false)); else el.pause();
  };
  return (
    <section id="bl-music" data-bl-section="music" className="bl-sec bl-music" aria-labelledby="bl-h-music">
      <Reveal>
        <Head id="bl-h-music" chapter={chapter} label={labels.sectionMusic} labels={labels} />
        <div className="bl-player">
          {/* Never autoplays: playback starts only from the button below. */}
          <audio ref={ref} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
          <button type="button" className="bl-player-btn" aria-pressed={playing} aria-label={playing ? labels.musicPause : labels.musicPlay} onClick={toggle}>
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <div>
            <p className="bl-player-label">{labels.musicLabel}</p>
            {trackTitle && <p className="bl-player-title">{trackTitle}</p>}
            {trackArtist && <p className="bl-player-artist">{trackArtist}</p>}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ------------------------------- Closing ----------------------------- */
export function Closing({ section, labels, onReplay, children }: Common & { onReplay: () => void; children?: ReactNode }) {
  const { closingLine, signature } = section.fields;
  return (
    <section id="bl-closing" data-bl-section="closing" className="bl-sec bl-closing">
      <Reveal>
        <svg className="bl-flourish" viewBox="0 0 160 24" aria-hidden="true" focusable="false"><path d="M4 14C28 2 44 22 70 12S110 4 124 12 148 16 156 8" /></svg>
        {closingLine && <p className="bl-closing-line">{closingLine}</p>}
        {signature && <p className="bl-signature">{signature}</p>}
        <button type="button" className="bl-btn bl-btn--ghost" onClick={onReplay}>{labels.closingReplay}</button>
        {children}
      </Reveal>
    </section>
  );
}
