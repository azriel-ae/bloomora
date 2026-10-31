import { createRoot } from 'react-dom/client';
import { GiftView } from '@/components/gift/gift-view';
import { blankContent, sampleContent } from '@/lib/engine/resolve';
import { chapterOfUs } from '@/lib/engine/templates/chapter-of-us';
import type { GiftContent } from '@/lib/engine/types';
import { DemoLanguageToggle } from '@/components/demo-language-toggle';

/** Browser test page: renders GiftView exactly as the app does, with the scenario chosen by the query string. */
const q = new URLSearchParams(location.search);
const locale = (q.get('locale') ?? 'id') as 'en' | 'id';
const scenario = q.get('scenario') ?? 'full';
const mode = (q.get('mode') ?? 'demo') as 'demo' | 'public' | 'preview';

function silentWav(): string {
  const n = 4000; const bytes = new Uint8Array(44 + n); const v = new DataView(bytes.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true); bytes.fill(128, 44);
  let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return `data:audio/wav;base64,${btoa(bin)}`;
}

let content: GiftContent = sampleContent(chapterOfUs, locale);
let audioSrc: string | undefined;
if (scenario === 'blank') content = blankContent(chapterOfUs);
if (scenario === 'partial') {
  content = { ...blankContent(chapterOfUs), fields: { recipientName: 'Lina', senderName: 'Bo', title: 'Hanya Judul', letterBody: 'Satu paragraf saja.', closingLine: 'Selesai.', signature: 'Bo' } };
}
if (scenario === 'xss') {
  const evil = '"><img src=x onerror="window.__xss=1"><script>window.__xss=2</script>';
  content = { ...content, fields: { ...content.fields, recipientName: evil, senderName: evil, title: evil, letterBody: evil, closingLine: evil, signature: evil }, data: { ...content.data, moments: [{ caption: evil, place: evil }], reasons: [{ text: evil }, { text: evil }, { text: evil }] } };
}
if (scenario === 'audio' || scenario === 'audio-nourl') {
  content = { ...content, sections: [...content.sections.filter((s) => s !== 'closing'), 'music', 'closing'], fields: { ...content.fields, trackTitle: 'Quiet Hours', trackArtist: 'Test Tone' }, media: [{ id: 'a1', kind: 'audio', path: 'private/u/gifts/g/a1.wav' }] };
  if (scenario === 'audio') audioSrc = silentWav();
}

const nav = <><DemoLanguageToggle /><a className="bl-nav-link" href="#use-template">{locale === 'id' ? 'Gunakan Template' : 'Use template'}</a></>;
const footer = <div className="bl-demo-footer"><h2>{locale === 'id' ? 'Suka dengan yang kamu lihat?' : 'Like what you see?'}</h2><div className="bl-demo-actions"><a className="bl-btn" href="#use-template">{locale === 'id' ? 'Gunakan Template' : 'Use template'}</a></div></div>;
const view = <GiftView templateId="chapter-of-us" templateVersion={1} content={content} locale={locale} mode={mode} navActions={nav} footer={footer} audioSrc={audioSrc} />;
createRoot(document.getElementById('root')!).render(mode === 'preview' ? <div id="host" style={{ height: 640, width: 900, margin: '0 auto', border: '1px solid #ccc' }}>{view}</div> : view);
