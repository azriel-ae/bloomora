import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { AuthCallout } from '@/components/auth-callout';
import { TemplateArt } from '@/components/template-art';
import { CATEGORIES } from '@/lib/engine/categories';
import { getActiveTemplate, listCatalog } from '@/lib/engine/registry';
import { getLocale, getMessages } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/session';
import { isEditorDevMode } from '@/lib/server/dev-editor-env';

export const metadata: Metadata = { title: 'Create a gift', description: 'Start a private Bloomora gift from a considered template.' };

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const locale = await getLocale();
  const { template: selectedId } = await searchParams;
  const catalog = listCatalog();
  const selected = selectedId ? getActiveTemplate(selectedId) : null;
  const previewTemplate = selected ?? catalog[0] ?? null;
  const messages = getMessages(locale);
  const devMode = isEditorDevMode();
  const user = devMode ? null : await getCurrentUser();
  const returnTo = selected ? `/editor/new?template=${encodeURIComponent(selected.id)}` : undefined;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_.85fr] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.createPage.eyebrow}</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl leading-tight sm:text-6xl">{messages.createPage.title}</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink/60">{messages.createPage.intro}</p>
          {selected && (
            <div className="mt-8 border border-line bg-paper px-5 py-4" aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.createPage.selectedTemplate}</p>
              <p className="mt-1 font-display text-2xl">{selected.name[locale]}</p>
            </div>
          )}
          <div className="mt-10">
            {selected && (user || devMode) ? <Link href={returnTo!} className="inline-flex rounded-full bg-moss px-6 py-3.5 text-sm font-semibold text-ivory">{messages.createPage.startEditing}</Link> : <AuthCallout
              title={messages.createPage.authTitle}
              eyebrow={messages.createPage.authEyebrow}
              body={messages.createPage.authBody}
              registerLabel={messages.createPage.register}
              loginLabel={messages.createPage.login}
              returnTo={returnTo}
            />}
          </div>
        </div>

        {previewTemplate && (
          <aside aria-label={messages.createPage.start} className="rounded-[2.2rem] border border-line bg-paper p-4 shadow-soft">
            <TemplateArt template={previewTemplate} compact locale={locale} />
            <div className="px-3 pb-3 pt-5">
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{messages.createPage.start}</p>
              <div className="mt-4 space-y-1">
                {catalog.map((template) => {
                  const category = CATEGORIES.find((item) => item.id === template.category)?.label[locale] ?? template.category;
                  const isSelected = template.id === selected?.id;
                  return (
                    <Link
                      key={template.id}
                      href={`/create?template=${template.id}`}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`flex items-center justify-between gap-4 border-b border-line px-2 py-3 text-sm last:border-0 ${isSelected ? 'text-moss' : 'text-ink/70 hover:text-moss'}`}
                    >
                      <span><span className="block font-semibold">{template.name[locale]}</span><span className="mt-1 block text-xs text-ink/45">{category}</span></span>
                      <ArrowUpRight size={15} aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
