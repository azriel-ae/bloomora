'use client';

import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export function QrDesigner({ value, closeLabel, onClose }: { value: string; closeLabel: string; onClose: () => void }) {
  const [foreground, setForeground] = useState('#27352b');
  const [background, setBackground] = useState('#fffdf8');
  const svgRef = useRef<HTMLDivElement>(null);

  function downloadSvg() {
    const svg = svgRef.current?.querySelector('svg');
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'bloomora-qr.svg'; link.click(); URL.revokeObjectURL(link.href);
  }

  function downloadPng() {
    const svg = svgRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = 880; canvas.height = 880;
      const context = canvas.getContext('2d'); if (!context) return;
      context.drawImage(image, 0, 0, 880, 880);
      const link = document.createElement('a'); link.download = 'bloomora-qr.png'; link.href = canvas.toDataURL('image/png'); link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }

  return <div className="w-full max-w-sm rounded-3xl bg-paper p-6 text-center shadow-paper">
    <div ref={svgRef} className="mx-auto w-fit rounded-xl p-2" style={{ backgroundColor: background }}>
      <QRCodeSVG value={value} size={260} bgColor={background} fgColor={foreground} includeMargin level="H" />
    </div>
    <p className="mt-4 text-xs leading-5 text-ink/55">QR ini hanya mengarah ke URL publik undangan.</p>
    <div className="mt-4 grid grid-cols-2 gap-3 text-left text-xs">
      <label className="rounded-xl border border-line p-3">Warna titik<input className="mt-2 h-8 w-full" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></label>
      <label className="rounded-xl border border-line p-3">Warna latar<input className="mt-2 h-8 w-full" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
    </div>
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={downloadPng} className="rounded-full bg-moss px-4 py-2 text-xs font-semibold text-ivory">Download PNG</button>
      <button type="button" onClick={downloadSvg} className="rounded-full border border-line px-4 py-2 text-xs font-semibold">Download SVG</button>
      <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-xs font-semibold">{closeLabel}</button>
    </div>
  </div>;
}
