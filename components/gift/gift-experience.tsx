'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { RenderModel } from '@/lib/engine/types';
import type { GiftLabels } from '@/lib/engine/labels';
import { OPENING_MS, activeIndex, openingReducer, roman, scrollProgress } from '@/lib/engine/interaction';
import { themeVars } from '@/lib/engine/theme-vars';
import { GiftContext, IconClose, IconMenu, usePrefersReducedMotion } from './parts';
import { Appreciation, Closing, Gallery, Hero, Letter, Music, OpeningScene, Reasons, Timeline } from './sections';
import './gift.css';

/**
 * 'demo'    full page, sealed opening, sample content
 * 'public'  full page, sealed opening, the recipient's real content
 * 'preview' embedded (own scroll area), opening skipped; for the editor
 */
export type GiftMode = 'demo' | 'public' | 'preview';

export interface GiftExperienceProps {
  model: RenderModel;
  labels: GiftLabels;
  mode: GiftMode;
  /** Shown in the top bar. */
  title: string;
  /** Extra controls in the top bar (the demo puts "Use template" here). */
  navActions?: ReactNode;
  /** Rendered inside the closing section (the demo puts its call to action here). */
  footer?: ReactNode;
  /** Resolved URL of the gift's audio. The music section is hidden without it. */
  audioSrc?: string;
}

const NUMBERED = new Set(['letter', 'timeline', 'gallery', 'message', 'appreciation', 'music']);
const sectionLabel = (labels: GiftLabels, type: string): string => {
  const key = `section${type[0].toUpperCase()}${type.slice(1)}` as keyof GiftLabels;
  return labels[key] ?? type;
};
const pick = (model: RenderModel, key: string) => model.sections.map((s) => s.fields[key]).find(Boolean) ?? '';

export function GiftExperience({ model, labels, mode, title, navActions, footer, audioSrc }: GiftExperienceProps) {
  const embedded = mode === 'preview';
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion(model.theme.motion);
  const style = useMemo(() => themeVars(model.theme) as React.CSSProperties, [model.theme]);

  const sections = useMemo(
    () => model.sections.filter((s) => (s.type !== 'music' || !!audioSrc)),
    [model.sections, audioSrc],
  );
  const opening = sections[0]?.type === 'opening' ? sections[0] : null;
  const story = sections.filter((s) => s.type !== 'opening');
  const gated = !!opening && !embedded;
  const [phase, dispatch] = useReducer(openingReducer, gated ? 'sealed' : 'open');
  const storyHidden = gated && (phase === 'sealed' || phase === 'opening');

  const storyRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  // Opening sequence timers. With reduced motion the reducer jumps straight to 'open'.
  useEffect(() => {
    if (phase !== 'opening' && phase !== 'leaving') return;
    const t = setTimeout(() => dispatch({ type: 'advance' }), phase === 'opening' ? OPENING_MS.opening : OPENING_MS.leaving);
    return () => clearTimeout(t);
  }, [phase]);

  const openedOnce = useRef(false);
  useEffect(() => {
    if (phase === 'open' && gated && !openedOnce.current) {
      openedOnce.current = true;
      storyRef.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }, [phase, gated]);

  // Reading progress and the active chapter, from scroll position.
  useEffect(() => {
    if (storyHidden) return;
    const scroller: HTMLElement | Window = embedded && root ? root : window;
    let raf = 0;
    const update = () => {
      raf = 0;
      const host = embedded && root ? root : null;
      const vh = host ? host.clientHeight : window.innerHeight;
      const top0 = host ? host.getBoundingClientRect().top : 0;
      const els = Array.from((host ?? document).querySelectorAll<HTMLElement>('[data-bl-section]'));
      const tops = els.map((el) => el.getBoundingClientRect().top - top0);
      setActive(Math.max(0, activeIndex(tops, vh * 0.35)));
      const p = host ? scrollProgress(host.scrollTop, host.scrollHeight, host.clientHeight)
        : scrollProgress(window.scrollY, document.documentElement.scrollHeight, window.innerHeight);
      if (barRef.current) { barRef.current.style.transform = `scaleX(${p})`; barRef.current.parentElement?.setAttribute('aria-valuenow', String(Math.round(p * 100))); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => { scroller.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [storyHidden, embedded, root, story.length]);

  // Chapter menu: Escape and outside click close it; focus returns to its button.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); menuBtn.current?.focus(); } };
    const onDown = (e: MouseEvent) => { if (navRef.current && !navRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [menu]);

  const behavior = reduced ? 'auto' : 'smooth';
  const goTo = useCallback((type: string) => {
    const el = (embedded && root ? root : document).querySelector<HTMLElement>(`[data-bl-section="${type}"]`);
    el?.scrollIntoView({ behavior, block: 'start' });
    setMenu(false);
  }, [embedded, root, behavior]);
  const toTop = useCallback(() => {
    if (embedded && root) root.scrollTo({ top: 0, behavior }); else window.scrollTo({ top: 0, behavior });
  }, [embedded, root, behavior]);

  const ctx = useMemo(() => ({ reduced, root: embedded ? root : null }), [reduced, embedded, root]);
  const recipient = pick(model, 'recipientName');
  const sender = pick(model, 'senderName');

  if (!model.sections.length) {
    return <div className="bl-root" style={style} data-mode={mode} data-embedded={embedded || undefined}><p className="bl-empty">{labels.emptyGift}</p></div>;
  }

  let chapterNo = 0;
  const nodes = story.map((s) => {
    const chapter = NUMBERED.has(s.type) ? ++chapterNo : 0;
    switch (s.type) {
      case 'hero': return <Hero key={s.id} section={s} labels={labels} recipient={recipient} sender={sender} />;
      case 'letter': return <Letter key={s.id} section={s} labels={labels} chapter={chapter} />;
      case 'timeline': return <Timeline key={s.id} section={s} labels={labels} chapter={chapter} />;
      case 'gallery': return <Gallery key={s.id} section={s} labels={labels} chapter={chapter} />;
      case 'message': return <Reasons key={s.id} section={s} labels={labels} chapter={chapter} />;
      case 'appreciation': return <Appreciation key={s.id} section={s} labels={labels} chapter={chapter} />;
      case 'music': return audioSrc ? <Music key={s.id} section={s} labels={labels} chapter={chapter} src={audioSrc} /> : null;
      case 'closing': return <Closing key={s.id} section={s} labels={labels} onReplay={toTop}>{footer}</Closing>;
      default: return null;
    }
  });

  return (
    <GiftContext.Provider value={ctx}>
      <div
        className="bl-root" style={style} ref={setRoot}
        data-mode={mode} data-embedded={embedded || undefined} data-motion={reduced ? 'none' : model.theme.motion}
      >
        {gated && phase !== 'open' && opening && (
          <OpeningScene section={opening} labels={labels} phase={phase} onOpen={() => dispatch({ type: 'begin', reducedMotion: reduced })} />
        )}
        <noscript><style>{'.bl-opening{display:none!important}.bl-story[hidden]{display:block!important}'}</style></noscript>
        <div className="bl-story" ref={storyRef} tabIndex={-1} hidden={storyHidden}>
          <nav className="bl-nav" ref={navRef} aria-label={labels.navChapters}>
            <div className="bl-nav-row">
              <p className="bl-nav-title">{title}</p>
              <div className="bl-nav-actions">
                {navActions}
                <button type="button" ref={menuBtn} className="bl-nav-btn" aria-label={labels.navChapters} aria-expanded={menu} aria-controls="bl-menu" onClick={() => setMenu((m) => !m)}>
                  {menu ? <IconClose /> : <IconMenu />}<span>{labels.navChapters}</span>
                </button>
              </div>
            </div>
            <div className="bl-progress" role="progressbar" aria-label={labels.progress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
              <div className="bl-progress-bar" ref={barRef} />
            </div>
            {menu && (
              <div className="bl-menu" id="bl-menu">
                <p className="bl-menu-title">{labels.navMenuTitle}</p>
                <ul>
                  {story.map((s, i) => (
                    <li key={s.id}>
                      <button type="button" aria-current={active === i ? 'true' : undefined} onClick={() => goTo(s.type)} autoFocus={i === 0}>
                        <span className="bl-menu-no" aria-hidden="true">{roman(i + 1)}</span>{sectionLabel(labels, s.type)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </nav>
          {nodes}
        </div>
      </div>
    </GiftContext.Provider>
  );
}
