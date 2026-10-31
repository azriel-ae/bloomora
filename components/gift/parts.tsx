'use client';

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PLATE_H, PLATE_W, TONE_VAR, plateFor, type Shape } from '@/lib/engine/plates';

/** Shared motion/scroll context: whether to animate, and which element scrolls (null = the window). */
export const GiftContext = createContext<{ reduced: boolean; root: HTMLElement | null }>({ reduced: false, root: null });
export const useGift = () => useContext(GiftContext);

/** True when the visitor asked for reduced motion, or the template opts out of motion entirely. */
export function usePrefersReducedMotion(themeMotion: 'none' | 'subtle' | 'standard'): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced || themeMotion === 'none';
}

/**
 * Fades content in once as it scrolls into view. Server markup and the first client render are fully
 * visible; hiding only starts after mount, so no-JS and reduced-motion visitors always see everything.
 */
export function Reveal({ children, className = '', tag = 'div' }: { children: ReactNode; className?: string; tag?: 'div' | 'li' | 'section' }) {
  const { reduced, root } = useGift();
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<'idle' | 'hidden' | 'in'>('idle');
  useEffect(() => {
    if (reduced || typeof IntersectionObserver === 'undefined') { setState('in'); return; }
    const el = ref.current;
    if (!el) return;
    setState((s) => (s === 'in' ? 'in' : 'hidden'));
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setState('in'); io.disconnect(); } }, { root, rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, root]);
  return createElement(tag, { ref, className: `bl-reveal${state === 'hidden' ? ' is-hidden' : ''} ${className}`.trim() }, children);
}

function shapeNode(s: Shape, i: number) {
  const color = `var(${TONE_VAR[s.tone]})`;
  const paint = 'stroke' in s && s.stroke
    ? { fill: 'none', stroke: color, strokeWidth: s.stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, opacity: s.o }
    : { fill: color, opacity: s.o };
  switch (s.t) {
    case 'rect': return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} style={paint} />;
    case 'circle': return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} style={paint} />;
    case 'path': return <path key={i} d={s.d} style={paint} />;
    case 'line': return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} style={{ ...paint, fill: 'none' }} />;
  }
}

/** One original SVG plate (see lib/engine/plates.ts). Decorative: the caption carries the meaning. */
export function PlateArt({ index, className }: { index: number; className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${PLATE_W} ${PLATE_H}`} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      {plateFor(index).shapes.map(shapeNode)}
    </svg>
  );
}

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;
export const IconClose = () => <svg {...icon}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconPrev = () => <svg {...icon}><path d="M15 5l-7 7 7 7" /></svg>;
export const IconNext = () => <svg {...icon}><path d="M9 5l7 7-7 7" /></svg>;
export const IconMenu = () => <svg {...icon}><path d="M4 8h16M4 16h16" /></svg>;
export const IconPlay = () => <svg {...icon}><path d="M8 5.5v13l10-6.5z" /></svg>;
export const IconPause = () => <svg {...icon}><path d="M9 5v14M15 5v14" /></svg>;
