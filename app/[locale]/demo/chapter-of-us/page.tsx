import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActiveTemplate } from '@/lib/engine/registry';
import { sampleContent } from '@/lib/engine/resolve';
import { GiftView } from '@/components/gift/gift-view';
import messagesId from '@/messages/id.json';

const TEMPLATE_ID = 'chapter-of-us';
const USE_HREF = `/create?template=${TEMPLATE_ID}`;

export async function generateMetadata(): Promise<Metadata> {
  const template = getActiveTemplate(TEMPLATE_ID);
  if (!template) return {};
  return { title: `${template.name.id} · Demo`, description: template.description.id, alternates: { canonical: '/demo/chapter-of-us' } };
}

/** Demo interaktif memakai renderer hadiah yang sama tanpa membaca atau menulis data pengguna. */
export default async function ChapterOfUsDemoPage() {
  const locale = 'id' as const;
  const config = getActiveTemplate(TEMPLATE_ID);
  if (!config || !config.hasDemo) notFound();
  const m = messagesId.featuredDemo;

  return (
    <GiftView
      templateId={config.id}
      templateVersion={config.version}
      content={sampleContent(config, locale)}
      locale={locale}
      mode="demo"
      navActions={<Link className="bl-nav-link" href={USE_HREF}>{m.useTemplate}</Link>}
      footer={<div className="bl-demo-footer"><h2>{m.footerTitle}</h2><p>{m.footerBody}</p><div className="bl-demo-actions"><Link className="bl-btn" href={USE_HREF}>{m.useTemplate}</Link><Link className="bl-btn bl-btn--ghost" href="/templates">{m.allTemplates}</Link></div></div>}
    />
  );
}
