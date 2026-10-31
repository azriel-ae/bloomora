import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale } from '@/lib/i18n';
import messagesEn from '@/messages/en.json';
import messagesId from '@/messages/id.json';
import { getActiveTemplate } from '@/lib/engine/registry';
import { sampleContent } from '@/lib/engine/resolve';
import { GiftView } from '@/components/gift/gift-view';
import { DemoLanguageToggle } from '@/components/demo-language-toggle';

const TEMPLATE_ID = 'chapter-of-us';
const USE_HREF = `/create?template=${TEMPLATE_ID}`;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getActiveTemplate(TEMPLATE_ID);
  if (!t) return {};
  return { title: `${t.name[locale]} · Demo`, description: t.description[locale] };
}

/**
 * Featured demo. Sample content only: nothing here reads or writes user data, needs a login, or touches Firebase.
 * The template is rendered by the same GiftView that the editor preview and public gift page will use.
 */
export default async function ChapterOfUsDemoPage() {
  const locale = await getLocale();
  const config = getActiveTemplate(TEMPLATE_ID);
  if (!config || !config.hasDemo) notFound();
  const m = (locale === 'id' ? messagesId : messagesEn).featuredDemo;

  return (
    <GiftView
      templateId={config.id}
      templateVersion={config.version}
      content={sampleContent(config, locale)}
      locale={locale}
      mode="demo"
      navActions={<><DemoLanguageToggle /><Link className="bl-nav-link" href={USE_HREF}>{m.useTemplate}</Link></>}
      footer={
        <div className="bl-demo-footer">
          <h2>{m.footerTitle}</h2>
          <p>{m.footerBody}</p>
          <div className="bl-demo-actions">
            <Link className="bl-btn" href={USE_HREF}>{m.useTemplate}</Link>
            <Link className="bl-btn bl-btn--ghost" href="/templates">{m.allTemplates}</Link>
          </div>
        </div>
      }
    />
  );
}
