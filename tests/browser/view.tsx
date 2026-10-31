import { GiftView } from '@/components/gift/gift-view';
import { sampleContent } from '@/lib/engine/resolve';
import { chapterOfUs } from '@/lib/engine/templates/chapter-of-us';
import { DemoLanguageToggle } from '@/components/demo-language-toggle';

/** The demo page's element tree, shared by the server-render and hydration tests. */
export function demoView(locale: 'en' | 'id') {
  return (
    <GiftView
      templateId="chapter-of-us" templateVersion={1} content={sampleContent(chapterOfUs, locale)} locale={locale} mode="demo"
      navActions={<><DemoLanguageToggle /><a className="bl-nav-link" href="#use">Use</a></>}
      footer={<div className="bl-demo-footer"><a className="bl-btn" href="#use">Use</a></div>}
    />
  );
}
