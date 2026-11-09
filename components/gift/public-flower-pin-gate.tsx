'use client';

import { useState, type FormEvent } from 'react';
import type { GiftContent } from '@/lib/model/types';
import type { Locale } from '@/lib/engine/types';
import { GiftView } from './gift-view';
import './interactive-flower-adventure.css';

type UnlockResult = {
  templateId: string;
  templateVersion: number;
  content: GiftContent;
  mediaUrls?: Record<string, string>;
};

export function PublicFlowerPinGate({ giftSlug, templateId, templateVersion, title, locale, style }: {
  giftSlug: string;
  templateId: string;
  templateVersion: number;
  title: string;
  locale: Locale;
  style?: React.CSSProperties;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [unlocked, setUnlocked] = useState<UnlockResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d{4,6}$/.test(pin)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/public/gifts/${encodeURIComponent(giftSlug)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ pin }),
      });
      const payload = await response.json().catch(() => null) as (UnlockResult & { error?: string }) | null;
      if (!response.ok || !payload?.content || payload.templateId !== templateId || payload.templateVersion !== templateVersion) {
        setError(response.status === 429
          ? (locale === 'id' ? 'Terlalu banyak percobaan. Coba lagi beberapa saat.' : 'Too many attempts. Please try again later.')
          : (locale === 'id' ? 'PIN belum cocok. Periksa kembali lalu coba lagi.' : 'That PIN does not match. Check it and try again.'));
        setPin('');
        return;
      }
      setUnlocked(payload);
    } catch {
      setError(locale === 'id' ? 'Hadiah belum dapat dibuka. Periksa koneksi lalu coba lagi.' : 'The gift could not be opened. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (unlocked) return <GiftView
    templateId={unlocked.templateId}
    templateVersion={unlocked.templateVersion}
    content={unlocked.content}
    locale={locale}
    mode="public"
    mediaUrls={unlocked.mediaUrls ?? {}}
  />;

  return <div className="ifa-root ifa-pin-gate-root" style={style} data-template-id="interactive-flower-adventure" data-mode="public">
    <main className="ifa-pin-gate" aria-labelledby="ifa-pin-gate-title">
      <div className="ifa-pin-gate-card">
        <p className="ifa-eyebrow">{locale === 'id' ? 'SEBUAH TAMAN MENUNGGUMU' : 'A GARDEN IS WAITING'}</p>
        <span className="ifa-pin-gate-mark" aria-hidden="true"><i /><i /><i /><b /></span>
        <h1 id="ifa-pin-gate-title">{locale === 'id' ? 'Masukkan PIN untuk masuk' : 'Enter the PIN to enter'}</h1>
        <p className="ifa-pin-gate-copy">{locale === 'id' ? 'PIN ini diberikan oleh pembuat hadiah. Masukkan 4–6 angka untuk membuka taman.' : 'The gift maker shared this PIN with you. Enter 4–6 digits to open the garden.'}</p>
        <form onSubmit={submit} noValidate>
          <label className="ifa-pin-gate-label" htmlFor="ifa-public-pin">{locale === 'id' ? 'PIN hadiah' : 'Gift PIN'}</label>
          <input
            id="ifa-public-pin"
            className="ifa-pin-gate-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4,6}"
            maxLength={6}
            value={pin}
            onChange={(event) => { setPin(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
            aria-describedby={error ? 'ifa-public-pin-error' : 'ifa-public-pin-hint'}
            aria-invalid={Boolean(error)}
            required
            autoFocus
          />
          <p className="ifa-pin-gate-hint" id="ifa-public-pin-hint">{locale === 'id' ? 'Gunakan angka saja.' : 'Numbers only.'}</p>
          {error && <p className="ifa-error" id="ifa-public-pin-error" role="alert">{error}</p>}
          <button className="ifa-primary ifa-pin-gate-submit" type="submit" disabled={busy || !/^\d{4,6}$/.test(pin)}>{busy ? (locale === 'id' ? 'Memeriksa…' : 'Checking…') : (locale === 'id' ? 'Buka taman' : 'Open the garden')}</button>
        </form>
        <p className="ifa-pin-gate-title-note">{title}</p>
      </div>
    </main>
  </div>;
}
