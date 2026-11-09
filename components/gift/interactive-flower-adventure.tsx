'use client';

import Image from 'next/image';
import { useMemo, useState, type ReactNode, type CSSProperties } from 'react';
import type { Locale, RenderModel, RenderSection } from '@/lib/engine/types';
import type { GiftMode } from './gift-experience';
import { GiftExtras } from './gift-extras';
import './interactive-flower-adventure.css';

const section = (model: RenderModel, id: string) => model.sections.find((item) => item.id === id);
const field = (item: RenderSection | undefined, key: string) => item?.fields[key] ?? '';
const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ');
const paragraphs = (value: string) => value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

function Flower({ name, message, color, watered, onWater }: { name: string; message: string; color: string; watered: boolean; onWater: () => void }) {
  return <button type="button" className={`ifa-flower${watered ? ' is-watered' : ''}`} onClick={onWater} aria-pressed={watered} style={{ '--ifa-flower': color || '#c7864b' } as CSSProperties}>
    <span className="ifa-flower-stem" /><span className="ifa-flower-head"><i /><i /><i /><b /></span><span className="ifa-flower-copy"><strong>{name}</strong><small>{watered ? 'Blooming' : 'Water this flower'}</small><em>{message}</em></span>
  </button>;
}

export function InteractiveFlowerAdventure({ model, mode, locale, title, navActions, footer, style }: { model: RenderModel; mode: GiftMode; locale: Locale; title: string; navActions?: ReactNode; footer?: ReactNode; style: CSSProperties }) {
  const opening = section(model, 'opening'); const hero = section(model, 'hero'); const letter = section(model, 'letter'); const message = section(model, 'message'); const garden = section(model, 'appreciation'); const closing = section(model, 'closing');
  const puzzles = message?.lists.puzzles ?? []; const flowers = garden?.lists.flowers ?? []; const moments = letter?.lists.moments ?? [];
  const [answers, setAnswers] = useState<Record<number, string>>({}); const [watered, setWatered] = useState<number[]>([]);
  const solved = puzzles.length > 0 && puzzles.every((item, index) => normalize(answers[index] ?? '') === normalize(item.answer ?? ''));
  const allWatered = flowers.length > 0 && watered.length === flowers.length;
  const privateReady = solved && allWatered;
  const reset = () => { setAnswers({}); setWatered([]); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const flowerHint = useMemo(() => garden?.fields.appreciationText ?? '', [garden]);
  return <div className="ifa-root" style={style} data-template-id="interactive-flower-adventure" data-mode={mode}>
    <header className="ifa-topbar"><button type="button" className="ifa-brand" onClick={reset}>{title}</button><div>{navActions}<button type="button" className="ifa-reset" onClick={reset}>Start again</button></div></header>
    <main>
      <section className="ifa-hero"><p className="ifa-eyebrow">THE GARDEN I SAVED FOR YOU</p><h1>{field(hero, 'title')}</h1><p>{field(hero, 'subtitle')}</p><span className="ifa-hero-line" /></section>
      <section className="ifa-letter" aria-labelledby="ifa-letter-title"><div><p className="ifa-eyebrow">A NOTE FROM {field(opening, 'senderName').toUpperCase()}</p><h2 id="ifa-letter-title">{field(letter, 'letterGreeting')}</h2><article>{paragraphs(field(letter, 'letterBody')).map((text, index) => <p key={index}>{text}</p>)}<p className="ifa-signoff">{field(letter, 'letterSignoff')}<br /><strong>{field(opening, 'senderName')}</strong></p></article></div><div className="ifa-memories" aria-label="Memory cards">{moments.map((item, index) => <figure key={item.itemId || index} className={`ifa-memory ifa-memory-${index % 3}`}>{item.imageSrc ? <Image src={item.imageSrc} alt={item.caption || 'Memory'} fill sizes="(max-width: 700px) 42vw, 250px" unoptimized /> : <span className="ifa-memory-placeholder"><i /><i /><i /></span>}<figcaption>{item.caption}<small>{item.place}</small></figcaption></figure>)}</div></section>
      <section className="ifa-puzzles" aria-labelledby="ifa-puzzles-title"><p className="ifa-eyebrow">THE PATH OF LITTLE CLUES</p><h2 id="ifa-puzzles-title">{field(message, 'reasonsIntro')}</h2><div className="ifa-clue-grid">{puzzles.map((item, index) => { const correct = normalize(answers[index] ?? '') === normalize(item.answer ?? ''); return <article className={`ifa-clue${correct ? ' is-solved' : ''}`} key={index}><span>0{index + 1}</span><h3>{item.clue}</h3><input value={answers[index] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))} placeholder="Your answer" aria-label={`Answer clue ${index + 1}`} /><small>{correct ? 'The path opens.' : item.hint}</small></article>; })}</div>{solved && <p className="ifa-success" role="status">The hidden path is open. The garden is waiting.</p>}</section>
      <section className="ifa-keepsakes" aria-label={locale === 'id' ? 'Permainan dan studio foto' : 'Game and Photo Studio'}><GiftExtras variant="garden" locale={locale} motion={model.theme.motion} /></section>
      <section className="ifa-garden" aria-labelledby="ifa-garden-title"><p className="ifa-eyebrow">A GARDEN OF SMALL THINGS</p><h2 id="ifa-garden-title">Wake the flowers</h2><p className="ifa-garden-intro">{flowerHint}</p><div className="ifa-flower-bed">{flowers.map((item, index) => <Flower key={index} name={item.name} message={item.message} color={item.color} watered={watered.includes(index)} onWater={() => setWatered((current) => current.includes(index) ? current : [...current, index])} />)}</div><p className="ifa-progress" role="status">{watered.length} of {flowers.length} flowers awake</p></section>
      <section className={`ifa-private${privateReady ? ' is-ready' : ''}`} aria-labelledby="ifa-private-title"><p className="ifa-eyebrow">THE PRIVATE NOTE</p><h2 id="ifa-private-title">{privateReady ? 'A note beneath the petals' : 'Something is still growing'}</h2>{!privateReady ? <p>Solve every clue and water every flower to reveal the private note.</p> : <article className="ifa-note">{paragraphs(field(closing, 'closingLine')).map((text, index) => <p key={index}>{text}</p>)}<p className="ifa-signoff">{field(closing, 'signature')}</p></article>}</section>
      <footer className="ifa-footer"><button type="button" className="ifa-primary" onClick={reset}>Replay the garden</button>{footer}</footer>
    </main>
  </div>;
}
