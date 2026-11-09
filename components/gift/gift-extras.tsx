'use client';

/* eslint-disable @next/next/no-img-element -- local blob previews must feed the same filtered image to canvas export. */

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import './gift-extras.css';

export type GiftExtrasVariant = 'scrapbook' | 'garden' | 'pages';
export type GiftExtrasLocale = 'id' | 'en';
export type GiftExtrasMotion = 'none' | 'subtle' | 'standard';
type GameState = 'ready' | 'playing' | 'won';
type GamePhase = 'aim' | 'drop' | 'grab' | 'lift' | 'return';
type FilterName = 'soft' | 'warm' | 'monochrome';

const copy = {
  en: {
    gameKicker: 'A LITTLE EXTRA', gameTitle: 'A tiny prize, just for you', gameIntro: 'Steer the claw to a little keepsake and bring it home.',
    ready: 'Ready when you are. Start a round to reach for a surprise.', start: 'Start the game',
    aim: 'Move the claw left or right, then lower it to pick a prize.', left: 'Move claw left', right: 'Move claw right', grab: 'Lower the claw',
    drop: 'Down it goes…', caught: 'A little something is caught!', lift: 'Lifting your keepsake…', returning: 'Bringing your prize home…',
    wonPrefix: 'You won:', replay: 'Play again', machine: 'Prize machine', position: 'Claw position', compartment: 'Prize compartment',
    photoKicker: 'KEEP THIS MOMENT', photoTitle: 'A little Photo Studio', photoIntro: 'Choose a photo, make it yours, and save a lovely keepsake.',
    choosePhoto: 'Choose a photo', photoHelp: 'JPEG, PNG, or WebP · up to 10 MB. Your photo stays on this device.',
    noPhoto: 'Your photo will appear here', caption: 'Caption', captionPlaceholder: 'Add a little note…', filter: 'Choose a finish',
    soft: 'Soft', warm: 'Warm', monochrome: 'Monochrome', save: 'Save your keepsake',
    errorType: 'Please choose a JPEG, PNG, or WebP image.', errorSize: 'This image is larger than 10 MB. Please choose a smaller one.',
    errorLoad: 'We could not open that image. Please try another file.', saving: 'Preparing your keepsake…', saved: 'Your keepsake is ready and has been downloaded.',
    errorSave: 'We could not save this image. Please try again.', previewAlt: 'Your photo preview',
  },
  id: {
    gameKicker: 'HADIAH KECIL TAMBAHAN', gameTitle: 'Hadiah mungil untukmu', gameIntro: 'Arahkan capit ke kenang-kenangan dan bawa pulang.',
    ready: 'Siap kapan saja. Mulai permainan untuk meraih kejutan.', start: 'Mulai permainan',
    aim: 'Gerakkan capit ke kiri atau kanan, lalu turunkan untuk mengambil hadiah.', left: 'Gerakkan capit ke kiri', right: 'Gerakkan capit ke kanan', grab: 'Turunkan capit',
    drop: 'Capit sedang turun…', caught: 'Ada hadiah kecil yang tertangkap!', lift: 'Mengangkat kenang-kenanganmu…', returning: 'Membawa hadiahmu pulang…',
    wonPrefix: 'Kamu mendapatkan:', replay: 'Main lagi', machine: 'Mesin hadiah', position: 'Posisi capit', compartment: 'Kompartemen hadiah',
    photoKicker: 'ABADIKAN SAAT INI', photoTitle: 'Studio Foto mungil', photoIntro: 'Pilih foto, hias sesuai gayamu, lalu simpan kenangan manis.',
    choosePhoto: 'Pilih foto', photoHelp: 'JPEG, PNG, atau WebP · maksimal 10 MB. Fotomu tetap di perangkat ini.',
    noPhoto: 'Pratinjau fotomu akan tampil di sini', caption: 'Keterangan', captionPlaceholder: 'Tambahkan catatan kecil…', filter: 'Pilih nuansa',
    soft: 'Lembut', warm: 'Hangat', monochrome: 'Monokrom', save: 'Simpan kenanganmu',
    errorType: 'Pilih gambar JPEG, PNG, atau WebP.', errorSize: 'Ukuran gambar lebih dari 10 MB. Pilih gambar yang lebih kecil.',
    errorLoad: 'Gambar tidak dapat dibuka. Silakan coba berkas lain.', saving: 'Menyiapkan kenanganmu…', saved: 'Kenanganmu siap dan sudah diunduh.',
    errorSave: 'Gambar tidak dapat disimpan. Silakan coba lagi.', previewAlt: 'Pratinjau fotomu',
  },
} as const;

const prizeCopy: Record<GiftExtrasVariant, Record<GiftExtrasLocale, readonly string[]>> = {
  scrapbook: {
    en: ['A tiny pressed-flower bookmark', 'A page of golden-hour memories', 'A handwritten note for later', 'A little pocket of confetti', 'A keepsake sticker sheet'],
    id: ['Pembatas buku bunga kering mungil', 'Selembar kenangan senja keemasan', 'Catatan tulisan tangan untuk nanti', 'Kantong kecil penuh konfeti', 'Lembar stiker kenang-kenangan'],
  },
  garden: {
    en: ['A packet of moonflower seeds', 'A tiny glasshouse charm', 'A soft green garden ribbon', 'A note from the wildflowers', 'A little pocket of sunshine'],
    id: ['Sebungkus benih bunga bulan', 'Hiasan rumah kaca mungil', 'Pita taman hijau yang lembut', 'Pesan dari bunga-bunga liar', 'Kantong kecil berisi cahaya matahari'],
  },
  pages: {
    en: ['A secret tucked between pages', 'A little story to keep', 'A bookmark from another chapter', 'A line of poetry, just for you', 'A note from the next page'],
    id: ['Rahasia terselip di antara halaman', 'Cerita kecil untuk disimpan', 'Pembatas dari bab yang lain', 'Sepenggal puisi khusus untukmu', 'Pesan dari halaman berikutnya'],
  },
};

const FILTERS: Record<FilterName, string> = {
  soft: 'brightness(1.04) contrast(.93) saturate(.86)',
  warm: 'sepia(.23) saturate(1.15) brightness(1.02)',
  monochrome: 'grayscale(1) contrast(1.04)',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function GiftExtras({ variant, locale, motion }: { variant: GiftExtrasVariant; locale: GiftExtrasLocale; motion: GiftExtrasMotion }) {
  const t = copy[locale];
  const [gameState, setGameState] = useState<GameState>('ready');
  const [phase, setPhase] = useState<GamePhase>('aim');
  const [clawPosition, setClawPosition] = useState(50);
  const [prize, setPrize] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const photoUrlRef = useRef('');
  const imageRef = useRef<HTMLImageElement>(null);
  const [caption, setCaption] = useState('');
  const [filter, setFilter] = useState<FilterName>('soft');
  const [photoError, setPhotoError] = useState('');
  const [photoStatus, setPhotoStatus] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
  }, []);

  const schedule = (delay: number, callback: () => void) => {
    const timer = setTimeout(callback, motion === 'none' ? Math.min(delay, 90) : delay);
    timers.current.push(timer);
  };

  const clearGameTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const startGame = () => {
    clearGameTimers();
    setPrize(prizeCopy[variant][locale][Math.floor(Math.random() * prizeCopy[variant][locale].length)]);
    setClawPosition(50);
    setPhase('aim');
    setGameState('playing');
  };

  const moveClaw = (direction: -1 | 1) => setClawPosition((position) => Math.max(8, Math.min(92, position + direction * 12)));

  const grabPrize = () => {
    if (gameState !== 'playing' || phase !== 'aim') return;
    setPhase('drop');
    schedule(520, () => setPhase('grab'));
    schedule(1040, () => setPhase('lift'));
    schedule(1600, () => setPhase('return'));
    schedule(2240, () => { setGameState('won'); setPhase('aim'); });
  };

  const onGameKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (gameState !== 'playing' || phase !== 'aim') return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveClaw(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target as HTMLElement;
      if (target.tagName !== 'BUTTON') { event.preventDefault(); grabPrize(); }
    }
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setPhotoError('');
    setPhotoStatus('');
    if (!file) return;
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
    photoUrlRef.current = '';
    setPhotoUrl('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError(t.errorType);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setPhotoError(t.errorSize);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    photoUrlRef.current = nextUrl;
    setPhotoUrl(nextUrl);
  };

  const savePhoto = async () => {
    const image = imageRef.current;
    if (!photoUrl || !image || !image.complete || image.naturalWidth === 0) {
      setPhotoError(t.errorLoad);
      setPhotoStatus('');
      return;
    }
    setIsSaving(true);
    setPhotoError('');
    setPhotoStatus(t.saving);
    try {
      const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable');
      context.filter = FILTERS[filter];
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      context.filter = 'none';
      if (caption.trim()) {
        const base = Math.max(18, Math.round(canvas.width * 0.035));
        const padding = Math.round(base * 0.8);
        const lineHeight = Math.round(base * 1.28);
        const maxTextWidth = canvas.width - padding * 2;
        context.font = `600 ${base}px ui-sans-serif, system-ui, sans-serif`;
        const words = caption.trim().split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (line && context.measureText(candidate).width > maxTextWidth) { lines.push(line); line = word; }
          else line = candidate;
        }
        if (line) lines.push(line);
        const visibleLines = lines.slice(-5);
        const stripHeight = padding * 2 + visibleLines.length * lineHeight;
        const gradient = context.createLinearGradient(0, canvas.height - stripHeight, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(25, 35, 30, 0.02)');
        gradient.addColorStop(1, 'rgba(25, 35, 30, 0.76)');
        context.fillStyle = gradient;
        context.fillRect(0, canvas.height - stripHeight, canvas.width, stripHeight);
        context.fillStyle = '#fffdf8';
        context.textBaseline = 'top';
        visibleLines.forEach((text, index) => context.fillText(text, padding, canvas.height - padding - visibleLines.length * lineHeight + index * lineHeight, maxTextWidth));
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Image export failed')), 'image/png'));
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = 'bloomora-keepsake.png';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setPhotoStatus(t.saved);
    } catch {
      setPhotoStatus('');
      setPhotoError(t.errorSave);
    } finally {
      setIsSaving(false);
    }
  };

  return <section className={`gift-extras gift-extras--${variant}`} data-variant={variant} data-motion={motion} lang={locale} aria-label={locale === 'en' ? 'Gift extras' : 'Hadiah tambahan'}>
    <section className="gift-extras__panel gift-extras__game" aria-labelledby="gift-extras-game-title">
      <header className="gift-extras__heading"><p className="gift-extras__eyebrow">{t.gameKicker}</p><h2 id="gift-extras-game-title">{t.gameTitle}</h2><p>{t.gameIntro}</p></header>
      <div className="gift-extras__machine" role="group" aria-label={t.machine} onKeyDown={onGameKeyDown} tabIndex={gameState === 'playing' && phase === 'aim' ? 0 : -1}>
        <div className={`gift-extras__machine-window gift-extras__machine-window--${phase}`}>
          <div className="gift-extras__machine-top"><span /><span /><span /></div>
          <div className="gift-extras__track"><span className="gift-extras__track-line" />
            <div className={`gift-extras__claw gift-extras__claw--${phase}`} style={{ left: `${clawPosition}%` }} aria-hidden="true"><span className="gift-extras__claw-cable" /><span className="gift-extras__claw-head" /><span className="gift-extras__claw-finger gift-extras__claw-finger--left" /><span className="gift-extras__claw-finger gift-extras__claw-finger--right" /></div>
            <div className={`gift-extras__prizes gift-extras__prizes--${phase}`} aria-hidden="true">{[0, 1, 2, 3, 4].map((item) => <span key={item} className={`gift-extras__prize gift-extras__prize--${item + 1}`}><i /></span>)}</div>
            {phase === 'grab' || phase === 'lift' || phase === 'return' ? <span className={`gift-extras__caught gift-extras__caught--${phase}`} aria-hidden="true"><i /></span> : null}
          </div>
          <div className="gift-extras__machine-slot"><span /></div>
        </div>
        <div className="gift-extras__machine-controls" aria-hidden="true"><span /><span /><span /></div>
      </div>
      <div className="gift-extras__game-status" role="status" aria-live="polite" aria-atomic="true">
        {gameState === 'ready' && t.ready}
        {gameState === 'playing' && phase === 'aim' && t.aim}
        {gameState === 'playing' && phase === 'drop' && t.drop}
        {gameState === 'playing' && phase === 'grab' && t.caught}
        {gameState === 'playing' && phase === 'lift' && t.lift}
        {gameState === 'playing' && phase === 'return' && t.returning}
        {gameState === 'won' && <span className="gift-extras__reward"><span>{t.wonPrefix}</span> <strong>{prize}</strong></span>}
      </div>
      {gameState === 'playing' && phase === 'aim' ? <div className="gift-extras__controls">
        <div className="gift-extras__arrows"><button type="button" onClick={() => moveClaw(-1)} aria-label={t.left}>←</button><span>{t.position}</span><button type="button" onClick={() => moveClaw(1)} aria-label={t.right}>→</button></div>
        <button className="gift-extras__button" type="button" onClick={grabPrize}>{t.grab}</button>
      </div> : <div className="gift-extras__actions">{gameState === 'won' ? <button type="button" className="gift-extras__button" onClick={startGame}>{t.replay}</button> : gameState === 'ready' ? <button type="button" className="gift-extras__button" onClick={startGame}>{t.start}</button> : <span className="gift-extras__button gift-extras__button--waiting" aria-hidden="true">{t.returning}</span>}</div>}
    </section>

    <section className="gift-extras__panel gift-extras__studio" aria-labelledby="gift-extras-studio-title">
      <header className="gift-extras__heading"><p className="gift-extras__eyebrow">{t.photoKicker}</p><h2 id="gift-extras-studio-title">{t.photoTitle}</h2><p>{t.photoIntro}</p></header>
      <div className={`gift-extras__preview gift-extras__preview--${filter}`}>
        {photoUrl ? <img ref={imageRef} src={photoUrl} alt={t.previewAlt} onError={() => setPhotoError(t.errorLoad)} style={{ filter: FILTERS[filter] }} /> : <div className="gift-extras__placeholder" aria-hidden="true"><span className="gift-extras__placeholder-sun" /><span className="gift-extras__placeholder-hill" /><span className="gift-extras__placeholder-flower" /></div>}
        {!photoUrl && <span className="gift-extras__placeholder-label">{t.noPhoto}</span>}
        {photoUrl && caption.trim() && <span className="gift-extras__caption-preview">{caption}</span>}
        <span className="gift-extras__preview-frame" aria-hidden="true" />
      </div>
      <div className="gift-extras__photo-fields">
        <label className="gift-extras__upload">{t.choosePhoto}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} aria-describedby="gift-extras-photo-help" /></label>
        <p className="gift-extras__help" id="gift-extras-photo-help">{t.photoHelp}</p>
        {photoError && <p className="gift-extras__alert" id="gift-extras-photo-alert" role="alert">{photoError}</p>}
        <label className="gift-extras__caption-label" htmlFor="gift-extras-caption">{t.caption}</label>
        <input id="gift-extras-caption" className="gift-extras__caption-input" type="text" value={caption} maxLength={180} placeholder={t.captionPlaceholder} onChange={(event) => setCaption(event.target.value)} />
        <fieldset className="gift-extras__filter-fieldset"><legend>{t.filter}</legend><div className="gift-extras__filters">{(['soft', 'warm', 'monochrome'] as const).map((option) => <button type="button" key={option} className={`gift-extras__filter-button gift-extras__filter-button--${option}`} aria-pressed={filter === option} onClick={() => { setFilter(option); setPhotoStatus(''); }}><span aria-hidden="true" />{t[option]}</button>)}</div></fieldset>
        <button type="button" className="gift-extras__button gift-extras__save" onClick={savePhoto} disabled={!photoUrl || isSaving}>{isSaving ? t.saving : t.save}</button>
        {photoStatus && <p className="gift-extras__photo-status" role="status" aria-live="polite">{photoStatus}</p>}
      </div>
    </section>
  </section>;
}

export default GiftExtras;
