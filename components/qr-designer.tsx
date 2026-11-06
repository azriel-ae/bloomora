'use client';

import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Labels = { description: string; foreground: string; background: string; downloadPng: string; downloadSvg: string; close: string };

export function QrDesigner({ value, labels, onClose }: { value: string; labels: Labels; onClose: () => void }) {
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
    <p className="mt-4 text-xs leading-5 text-ink/55">{labels.description}</p>
    <div className="mt-4 grid grid-cols-2 gap-3 text-left text-xs">
      <label className="rounded-xl border border-line p-3">{labels.foreground}<input className="mt-2 h-8 w-full" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} /></label>
      <label className="rounded-xl border border-line p-3">{labels.background}<input className="mt-2 h-8 w-full" type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
    </div>
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={downloadPng} className="rounded-full bg-moss px-4 py-2 text-xs font-semibold text-ivory">{labels.downloadPng}</button>
      <button type="button" onClick={downloadSvg} className="rounded-full border border-line px-4 py-2 text-xs font-semibold">{labels.downloadSvg}</button>
      <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-xs font-semibold">{labels.close}</button>
    </div>
  </div>;
}
