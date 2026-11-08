'use client';

import Link from 'next/link';
import { ArrowDown, ChevronRight, MessageCircle, Sparkles, SquarePen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from './locale-provider';
import { playChatNotificationSound, shouldNotifyChatReply } from '@/lib/chat-notification';

type Message = { role: 'user' | 'model'; text: string };

const STORAGE_KEY = 'bloomora_chat_v1';
const WHATSAPP_NUMBER = '6285648601964'; // +62 856-4860-1964

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91c0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07c0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.17-.48-.29Z" />
    </svg>
  );
}

const copy = {
  suggestions: ['Rekomendasi kado untuk pasangan', 'Bantu tulis pesan ulang tahun', 'Apa bedanya Basic, Plus, dan Premium?', 'Bagaimana cara membayar?'],
  resume: 'Lanjutkan obrolan sebelumnya atau mulai yang baru?',
  fresh: 'Mulai baru',
  newChat: 'Obrolan baru',
  reply: 'Tulis pesan…',
  privacy: 'Jangan tulis data pribadi di sini.',
  down: 'Ke pesan terbaru',
  cta: { pricing: 'Lihat paket dan harga', templates: 'Lihat template', payment: 'Cara pembayaran' },
} as const;

function pickCta(text: string) {
  const lower = text.toLowerCase();
  if (/harga|paket|price|plan|basic|plus|premium|rp\s?\d/.test(lower)) return { href: '/pricing', label: copy.cta.pricing };
  if (/bayar|qris|payment|pay /.test(lower)) return { href: '/payment', label: copy.cta.payment };
  if (/template|pressed garden|archive|just a letter/.test(lower)) return { href: '/templates', label: copy.cta.templates };
  return null;
}

function renderText(text: string) {
  const blocks: ({ type: 'p'; text: string } | { type: 'ul'; items: string[] })[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const bullet = /^[-–•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'ul') last.items.push(bullet[1]);
      else blocks.push({ type: 'ul', items: [bullet[1]] });
    } else blocks.push({ type: 'p', text: trimmed });
  }
  return blocks.map((block, index) => block.type === 'p' ? (
    <p key={index}>{block.text}</p>
  ) : (
    <ul key={index} className="space-y-2">
      {block.items.map((item, i) => <li key={i} className="flex gap-3"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-rose" /><span>{item}</span></li>)}
    </ul>
  ));
}

export function Chatbot() {
  const { locale, t } = useLocale();
  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Halo Bloomora, saya ingin bertanya tentang hadiah digital.')}`;
  const welcome: Message = { role: 'model', text: t('chat', 'welcome') };
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [restored, setRestored] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const requestSequenceRef = useRef(0);
  const notifiedRequestsRef = useRef(new Set<number>());

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (Array.isArray(saved) && saved.length > 1) { setMessages(saved); setShowResume(true); }
    } catch { /* penyimpanan lokal boleh tidak tersedia */ }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch { /* abaikan */ }
  }, [messages, restored]);

  useEffect(() => { if (atBottom) endRef.current?.scrollIntoView({ block: 'end' }); }, [messages, pending, open, atBottom]);

  function activateAudioFromGesture() {
    try {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return null;
      const context = audioContextRef.current ?? new AudioContextConstructor();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      return context;
    } catch { return null; }
  }

  function playReplySound() {
    const context = audioContextRef.current;
    if (!context) return;
    playChatNotificationSound(context);
  }

  function onScroll() {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }

  function startNew() {
    setMessages([welcome]); setShowResume(false); setInput(''); setAtBottom(true);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* abaikan */ }
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || pendingRef.current) return;
    pendingRef.current = true;
    const requestId = ++requestSequenceRef.current;
    // Sending a message is a user gesture, so initialize/unlock Web Audio here.
    activateAudioFromGesture();
    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next); setInput(''); setPending(true); setShowResume(false); setAtBottom(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale, messages: next }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t('chat', 'unavailable'));
      if (typeof data.text !== 'string' || !data.text.trim()) throw new Error(t('chat', 'unavailable'));
      setMessages((current) => [...current, { role: 'model', text: data.text }]);
      if (shouldNotifyChatReply({ responseOk: response.ok, replyText: data.text, alreadyNotified: notifiedRequestsRef.current.has(requestId) })) {
        notifiedRequestsRef.current.add(requestId);
        playReplySound();
      }
    } catch (error) {
      setMessages((current) => [...current, { role: 'model', text: error instanceof Error ? error.message : t('chat', 'unavailable') }]);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  const showSuggestions = messages.length === 1 && !pending;
  const lastIndex = messages.length - 1;

  return (
    <div className="fixed bottom-4 right-4 z-[60] sm:bottom-5 sm:right-5">
      <button aria-label={open ? t('common', 'close') : t('chat', 'label')} onClick={() => setOpen(!open)} className="grid h-12 w-12 place-items-center rounded-full bg-ink text-ivory shadow-paper transition hover:bg-moss">
        {open ? <X size={19} /> : <MessageCircle size={19} />}
      </button>
      {open && (
        <div className="absolute bottom-16 right-0 flex h-[min(68dvh,500px)] w-[min(92vw,350px)] flex-col overflow-hidden rounded-3xl border border-line bg-paper shadow-paper sm:h-[min(78vh,660px)] sm:w-[460px] sm:rounded-[28px]">
          <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-3 sm:px-5 sm:py-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage text-moss sm:h-11 sm:w-11"><Sparkles size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base leading-tight text-ink sm:text-xl">{t('chat', 'label')}</p>
              <p className="truncate text-[11px] text-ink/50 sm:text-xs">{t('chat', 'subtitle')}</p>
            </div>
            <button type="button" aria-label={copy.newChat} title={copy.newChat} onClick={startNew} className="grid h-8 w-8 place-items-center rounded-full text-ink/55 transition hover:bg-ivory hover:text-moss sm:h-9 sm:w-9"><SquarePen size={16} /></button>
            <a href={waHref} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp" className="grid h-8 w-8 place-items-center rounded-full bg-[#25D366] text-white transition hover:brightness-95 sm:h-9 sm:w-9"><WhatsAppIcon size={19} /></a>
            <button type="button" aria-label={t('common', 'close')} onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full text-ink/55 transition hover:bg-ivory hover:text-moss sm:h-9 sm:w-9"><X size={17} /></button>
          </div>

          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={onScroll} className="h-full space-y-4 overflow-y-auto overscroll-contain px-3.5 py-4 sm:space-y-5 sm:px-5 sm:py-5">
              {messages.map((message, index) => {
                const cta = message.role === 'model' && index === lastIndex && index > 0 ? pickCta(message.text) : null;
                return message.role === 'user' ? (
                  <div key={index} className="ml-auto w-fit max-w-[85%] whitespace-pre-line break-words rounded-2xl rounded-br-md bg-moss px-3.5 py-2 text-[14px] leading-6 text-ivory sm:px-4 sm:py-2.5 sm:text-[15px]">{message.text}</div>
                ) : (
                  <div key={index} className="space-y-2.5">
                    <div className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-full bg-sage text-moss"><Sparkles size={13} /></span><span className="font-display text-base text-ink">Bloomora</span></div>
                    <div className="space-y-2.5 break-words text-[14px] leading-[1.65] text-ink/85 sm:space-y-3 sm:text-[15px]">{renderText(message.text)}</div>
                    {cta && <Link href={cta.href} onClick={() => setOpen(false)} className="inline-flex items-center gap-2 rounded-full bg-moss px-4 py-2.5 text-[13px] font-semibold text-ivory transition hover:bg-ink sm:px-5 sm:py-3 sm:text-sm">{cta.label}<ChevronRight size={15} /></Link>}
                  </div>
                );
              })}
              {showSuggestions && <div className="flex flex-wrap gap-2">{copy.suggestions.map((item) => <button key={item} type="button" onClick={() => void send(item)} className="rounded-full border border-moss/30 bg-paper px-3 py-1.5 text-left text-[12.5px] font-medium text-moss transition hover:border-moss hover:bg-sage sm:px-3.5 sm:py-2 sm:text-[13px]">{item}</button>)}</div>}
              {pending && <div className="space-y-2.5" aria-label={t('chat', 'thinking')}><div className="flex items-center gap-2.5"><span className="grid h-7 w-7 place-items-center rounded-full bg-sage text-moss"><Sparkles size={13} /></span><span className="font-display text-base text-ink">Bloomora</span></div><div className="flex items-center gap-1.5 py-1"><span className="h-2 w-2 animate-bounce rounded-full bg-rose/70 [animation-delay:-0.3s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-rose/70 [animation-delay:-0.15s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-rose/70" /></div></div>}
              <div ref={endRef} />
            </div>
            {!atBottom && <button type="button" aria-label={copy.down} onClick={() => { setAtBottom(true); endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }} className="absolute bottom-3 left-1/2 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border border-line bg-paper text-ink shadow-soft transition hover:bg-ivory"><ArrowDown size={16} /></button>}
          </div>

          {showResume && <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-2xl bg-rose/15 px-3.5 py-3 sm:mx-4 sm:gap-3 sm:px-4"><p className="flex-1 text-[13px] leading-5 text-ink/70">{copy.resume}</p><button type="button" onClick={startNew} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-ivory transition hover:bg-moss"><SquarePen size={14} />{copy.fresh}</button><button type="button" aria-label={t('common', 'close')} onClick={() => setShowResume(false)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink/45 hover:text-ink"><X size={16} /></button></div>}

          <form className="px-3 pb-1 sm:px-4 sm:pb-2" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
            <div className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-4 pr-1 shadow-soft focus-within:border-moss sm:py-1.5 sm:pl-5 sm:pr-1.5">
              <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder={copy.reply} className="min-w-0 flex-1 bg-transparent py-2 text-[16px] outline-none placeholder:text-ink/40" />
              <button type="submit" aria-label={t('common', 'send')} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-moss text-ivory transition disabled:bg-sage disabled:text-moss/40 sm:h-10 sm:w-10" disabled={!input.trim() || pending}><ArrowDown size={17} className="rotate-180" /></button>
            </div>
          </form>
          <p className="pb-2.5 text-center text-[11px] text-ink/40">{copy.privacy}</p>
        </div>
      )}
    </div>
  );
}
