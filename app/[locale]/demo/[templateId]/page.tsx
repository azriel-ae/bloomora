import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getActiveTemplate } from '@/lib/engine/registry';
import { sampleContent } from '@/lib/engine/resolve';
import { GiftView } from '@/components/gift/gift-view';
import messagesId from '@/messages/id.json';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ templateId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { templateId } = await params;
  const template = getActiveTemplate(templateId);
  if (!template) return {};
  return { title: `${template.name.id} · Demo Bloomora`, description: template.description.id, alternates: { canonical: `/demo/${template.id}` } };
}

export default async function TemplateDemoPage({ params }: Props) {
  const { templateId } = await params;
  const template = getActiveTemplate(templateId);
  if (!template) notFound();
  const m = messagesId.featuredDemo;
  return <GiftView templateId={template.id} templateVersion={template.version} content={sampleContent(template, 'id')} locale="id" mode="demo"
    navActions={<Link className="bl-nav-link" href={`/create?template=${encodeURIComponent(template.id)}`}>{m.useTemplate}</Link>}
    footer={<div className="bl-demo-footer"><h2>{m.footerTitle}</h2><p>{m.footerBody}</p><div className="bl-demo-actions"><Link className="bl-btn" href={`/create?template=${encodeURIComponent(template.id)}`}>{m.useTemplate}</Link><Link className="bl-btn bl-btn--ghost" href="/templates">{m.allTemplates}</Link></div></div>} />;
}
