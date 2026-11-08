import { GiftView } from '@/components/gift/gift-view';
import { sampleContent } from '@/lib/engine/resolve';
import { chapterOfUs } from '@/lib/engine/templates/chapter-of-us';

/** Demo page element tree shared by the server-render and hydration tests. */
export function demoView() {
  const locale = 'id' as const;
  return (
    <GiftView
      templateId="chapter-of-us" templateVersion={1} content={sampleContent(chapterOfUs, locale)} locale={locale} mode="demo"
      navActions={<a className="bl-nav-link" href="#use">Gunakan Template</a>}
      footer={<div className="bl-demo-footer"><a className="bl-btn" href="#use">Gunakan Template</a></div>}
    />
  );
}
