import type { CSSProperties } from 'react';
import type { Locale, TemplateConfig } from '@/lib/engine/types';
import { CATEGORIES } from '@/lib/engine/categories';

type PreviewLayout = 'editorial' | 'scrapbook' | 'letter' | 'botanical';

function getPreviewLayout(template: TemplateConfig): PreviewLayout {
  const variants = template.sections.map((section) => section.variant);
  if (variants.includes('dated-ledger') || variants.includes('contact-sheet') || variants.includes('tap-to-reveal')) return 'scrapbook';
  if (variants.includes('typewritten') || variants.includes('filmstrip')) return 'letter';
  if (variants.includes('editorial-title') || variants.includes('split-columns')) return 'editorial';
  return 'botanical';
}

function firstPreviewLine(template: TemplateConfig, locale: Locale): string {
  const fields = template.sample[locale].fields;
  const value = fields.title || fields.letterGreeting || fields.appreciationText || fields.closingLine || template.tagline[locale];
  return value.split('\n')[0].slice(0, 88);
}

export function TemplateArt({ template, compact = false, locale = 'id' }: {
  template: TemplateConfig;
  compact?: boolean;
  locale?: Locale;
}) {
  const { palette } = template.theme;
  const layout = getPreviewLayout(template);
  const category = CATEGORIES.find((item) => item.id === template.category)?.label[locale] ?? template.category;
  const previewLine = firstPreviewLine(template, locale);
  const sampleList = template.sample[locale].lists.chapters ?? template.sample[locale].lists.moments ?? [];
  const style = {
    backgroundColor: palette.background,
    color: palette.ink,
    '--art-surface': palette.surface,
    '--art-accent': palette.accent,
    '--art-muted': palette.mutedInk,
    '--art-line': palette.line,
  } as CSSProperties;

  return (
    <div
      role="img"
      aria-label={`${template.name[locale]}: ${template.tagline[locale]}`}
      data-template-art
      data-template-id={template.id}
      data-layout={layout}
      className={`relative isolate overflow-hidden rounded-[2rem] p-5 sm:p-6 ${compact ? 'h-44 sm:h-52' : 'h-72 sm:h-80'}`}
      style={style}
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full border opacity-40" style={{ borderColor: palette.accent }} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full border opacity-30" style={{ borderColor: palette.accent }} />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[.2em]" style={{ color: palette.accent }}>
          <span>Bloomora</span>
          <span>{category}</span>
        </div>

        {layout === 'editorial' && (
          <div className="relative max-w-sm py-3">
            <p className="font-display text-3xl leading-[1.08] sm:text-4xl">{template.name[locale]}</p>
            <div className="my-3 h-px w-16" style={{ backgroundColor: palette.accent }} />
            <p className="max-w-xs text-xs leading-5 sm:text-sm" style={{ color: palette.mutedInk }}>{previewLine}</p>
            <svg aria-hidden="true" viewBox="0 0 100 100" className="absolute -right-2 -top-6 h-20 w-20 opacity-30 sm:h-24 sm:w-24" fill="none">
              <circle cx="50" cy="50" r="39" stroke={palette.accent} />
              <circle cx="50" cy="50" r="29" stroke={palette.accent} strokeDasharray="2 4" />
              <path d="M50 22v56M22 50h56" stroke={palette.accent} />
            </svg>
          </div>
        )}

        {layout === 'scrapbook' && (
          <div className="grid grid-cols-[1fr_.82fr] items-center gap-3 py-2">
            <div className="space-y-2">
              {[0, 1].map((index) => (
                <div key={index} className={`rounded-sm p-3 shadow-sm ${index === 0 ? '-rotate-2' : 'rotate-1'}`} style={{ backgroundColor: palette.surface }}>
                  <span className="block text-[9px] uppercase tracking-[.15em]" style={{ color: palette.accent }}>{sampleList[index]?.when ?? `0${index + 1}`}</span>
                  <span className="mt-1 block font-display text-sm leading-tight">{sampleList[index]?.title ?? template.name[locale]}</span>
                </div>
              ))}
            </div>
            <div className="flex aspect-[4/5] flex-col justify-between border p-3" style={{ borderColor: palette.line, backgroundColor: palette.surface }}>
              <span className="h-14 w-full border" style={{ borderColor: palette.line, backgroundColor: palette.background }} />
              <span className="font-display text-base leading-tight">{template.name[locale]}</span>
              <span className="h-px w-12" style={{ backgroundColor: palette.accent }} />
            </div>
          </div>
        )}

        {layout === 'letter' && (
          <div className="mx-auto w-full max-w-xs border p-4 shadow-sm sm:p-5" style={{ borderColor: palette.line, backgroundColor: palette.surface }}>
            <p className="font-display text-xl">{template.sample[locale].fields.letterGreeting ?? template.name[locale]}</p>
            <div className="mt-3 space-y-2" aria-hidden="true">
              {[1, 0.82, 0.94].map((width, index) => <div key={index} className="h-px" style={{ width: `${width * 100}%`, backgroundColor: palette.line }} />)}
            </div>
            <p className="mt-4 line-clamp-2 text-[11px] leading-4" style={{ color: palette.mutedInk }}>{previewLine}</p>
            <p className="mt-3 text-right font-display text-sm italic" style={{ color: palette.accent }}>{template.sample[locale].fields.signature ?? template.tagline[locale]}</p>
          </div>
        )}

        {layout === 'botanical' && (
          <div className="flex items-center gap-5 py-2">
            <svg aria-hidden="true" viewBox="0 0 100 130" className="h-28 w-20 shrink-0 sm:h-36 sm:w-24" fill="none">
              <path d="M50 122C48 88 51 51 68 11M50 92C38 75 27 64 10 60c3 19 17 31 40 32ZM57 61c7-20 18-31 34-37-1 18-13 31-33 40ZM49 112c-8-14-20-22-37-25 5 16 17 25 39 27Z" stroke={palette.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="min-w-0">
              <p className="font-display text-2xl leading-tight sm:text-3xl">{template.name[locale]}</p>
              <p className="mt-2 max-w-xs text-xs leading-5 sm:text-sm" style={{ color: palette.mutedInk }}>{previewLine}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-3 text-[9px] uppercase tracking-[.17em]" style={{ borderColor: palette.line, color: palette.accent }}>
          <span>{template.sections.length} {locale === 'id' ? 'momen' : 'moments'}</span>
          <span>{template.theme.display.replaceAll('-', ' ')}</span>
        </div>
      </div>
    </div>
  );
}
