import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasGeminiConfig } from '@/lib/env';
import { isLocale } from '@/lib/i18n';
import { listCatalog } from '@/lib/engine/registry';

export const runtime = 'nodejs';
export const maxDuration = 30;

const bodySchema = z.object({
  locale: z.string(),
  messages: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string().trim().min(1).max(2000) })).min(1).max(20),
});

// Model Gemini 1.x dan 2.0 sudah dimatikan Google (API balas 404), jadi dilewati otomatis.
const RETIRED_MODEL = /^(models\/)?gemini-(1\.|2\.0)/i;
// Urutan: paling hemat token & kuota harian paling besar (Flash-Lite) dulu, baru Flash biasa.
const FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
// Hemat token: kirim riwayat terbatas & batasi panjang jawaban.
const MAX_HISTORY = 8;
const MAX_OUTPUT_TOKENS = 400;

function modelCandidates() {
  const configured = (process.env.GEMINI_MODEL ?? '').trim();
  const list = [configured, ...FALLBACK_MODELS].filter((name) => name && !RETIRED_MODEL.test(name));
  return Array.from(new Set(list));
}


const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

const KNOWLEDGE = `
ABOUT BLOOMORA
Bloomora turns memories, messages, and small details into interactive DIGITAL gifts: a private web link (and QR code) the recipient opens on their phone. No code, no blank canvas. It is NOT a physical product: there are no frames, prints, dried flowers, or shipping. Never mention physical items.

TEMPLATES (real, do not invent others)
${listCatalog().map((template) => `- ${template.name.en} (${template.category}, ${template.tier} tier): ${template.description.en} Sections: ${template.sections.map((section) => section.type).join(', ')}.${template.hasDemo ? ' A real interactive demo is available.' : ' No interactive demo is available yet.'}`).join('\n')}

PLANS (real prices, do not invent others)
- Basic ${rupiah(19000)}: active 3 days, 1 gift, up to 8 photos, core scenes, private link.
- Plus ${rupiah(39000)}: active 14 days, up to 20 photos, all approved scenes, optional music, private link. Most chosen.
- Premium ${rupiah(69000)}: active 30 days, up to 40 photos, all approved scenes, optional music, priority review queue, private link.

HOW IT WORKS
1. Pick a template and build the gift in the editor (title, recipient, message, photos, scenes). A preview is available before paying.
2. Pay via the active QRIS image, then upload the payment proof.
3. An admin verifies manually. After verification the gift can be published and shared by private link.
Final price is always calculated by the server from the active plan at checkout. For anything not listed here (refunds, extensions, exact deadlines, contact details), say it follows the owner's current configuration and point to the Refunds, FAQ, or Contact page. Never guess.
`;

const STYLE = `
VOICE AND FORMAT (strict)
- Chat like a friendly person on WhatsApp: casual, warm, simple words. In Indonesian use "kak" or "kamu", short sentences, lowercase openings are fine.
- Be VERY short. Usually 1 to 3 short sentences, about 40 words max. Answer the question directly first. Skip greetings, skip recaps, never repeat what the user said, no long explanations.
- For lists (plans, templates, steps) use at most 3 or 4 lines, each starting with "- " followed by one short line. Nothing else decorates the list.
- When the user asks you to write a message or caption, give one ready-to-use version of about 50 words, then one short line offering to change the tone.
- Plain text only. NEVER use markdown: no asterisks, no bold, no headings, no hashtags, no backticks, no tables. At most one emoji in a whole reply, only at the very end, and only if it feels natural (a flower is fine). Often use none.
- Ask at most one short question, only when you really need it, otherwise just suggest the next step.
- Never ask for passwords, payment credentials, or private media.
`;

// Bersihkan sisa markdown/emoji supaya jawaban tampil rapi sebagai teks biasa.
const EMOJI = new RegExp('[\\p{Extended_Pictographic}\\uFE0F\\u200D]', 'gu');
function cleanReply(text: string) {
  let kept = 0;
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, ''))
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?:;]|$)/g, '$1$2')
    .replace(/^\s*[*•·–-]\s+/gm, '- ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*/g, '')
    .replace(EMOJI, (m) => (kept++ === 0 ? m : ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Gemini butuh percakapan dimulai dari 'user' dan selang-seling user/model.
function normalizeContents(messages: { role: 'user' | 'model'; text: string }[]) {
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const message of messages) {
    if (contents.length === 0 && message.role === 'model') continue; // buang sapaan awal dari bot
    const last = contents[contents.length - 1];
    if (last && last.role === message.role) last.parts.push({ text: message.text });
    else contents.push({ role: message.role, parts: [{ text: message.text }] });
  }
  return contents;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please send a short, valid message.' }, { status: 400 });
  if (!isLocale(parsed.data.locale)) return NextResponse.json({ error: 'Unsupported locale.' }, { status: 400 });
  const isId = parsed.data.locale === 'id';
  if (!hasGeminiConfig()) {
    return NextResponse.json({ error: isId ? 'Panduan Bloomora belum terhubung. Tambahkan konfigurasi Gemini server untuk mengaktifkan chat.' : 'The Bloomora guide is not connected yet. Add the Gemini server configuration to enable chat.' }, { status: 503 });
  }

  const contents = normalizeContents(parsed.data.messages.slice(-MAX_HISTORY));
  while (contents.length > 0 && contents[0].role === 'model') contents.shift();
  if (contents.length === 0) return NextResponse.json({ error: 'Please send a short, valid message.' }, { status: 400 });

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const systemInstruction = `You are Bloomora’s gift guide. Reply in ${isId ? 'Indonesian (casual, friendly, use "kamu")' : 'English'} by default, while following the user’s explicit requested language for generated gift content.
${KNOWLEDGE}
${STYLE}`;

  let lastError: unknown;
  for (const model of modelCandidates()) {
    try {
      const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, maxOutputTokens: MAX_OUTPUT_TOKENS } });
      const text = cleanReply(response.text ?? '');
      if (text) return NextResponse.json({ text });
      lastError = new Error(`Empty response from ${model}`);
    } catch (error) {
      lastError = error;
      console.error(`[chat] Gemini call failed for model "${model}":`, error instanceof Error ? error.message : error);
    }
  }

  console.error('[chat] All Gemini models failed:', lastError instanceof Error ? lastError.message : lastError);
  return NextResponse.json({ error: isId ? 'Panduan sedang istirahat sebentar. Coba lagi ya.' : 'The guide is taking a quiet moment. Please try again.' }, { status: 502 });
}
