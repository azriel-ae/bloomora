'use client';

import { useMemo, type ReactNode } from 'react';
import type { GiftContent, Locale } from '@/lib/engine/types';
import { getTemplateForRender } from '@/lib/engine/registry';
import { attachMomentImages } from '@/lib/engine/photo-bindings';
import { resolveRenderModel } from '@/lib/engine/resolve';
import { GiftExperience, type GiftMode } from './gift-experience';
import { giftLabels } from './labels';

/**
 * The one entry point for showing a gift. The demo, the editor preview and the public gift page all
 * render through this, so they cannot drift apart.
 *
 * - demo:    pass the template's sample content
 * - preview: sample text fills fields the owner has not written yet (never used for real gifts)
 * - public:  exactly what the owner saved, nothing substituted
 */
export function GiftView(props: {
  templateId: string; templateVersion: number; content: GiftContent; locale: Locale; mode: GiftMode;
  navActions?: ReactNode; footer?: ReactNode; audioSrc?: string; mediaUrls?: Record<string, string>;
}) {
  const { templateId, templateVersion, content, locale, mode, navActions, footer, audioSrc, mediaUrls = {} } = props;
  const config = useMemo(() => getTemplateForRender(templateId, templateVersion), [templateId, templateVersion]);
  const model = useMemo(
    () => {
      if (!config) return null;
      const resolved = resolveRenderModel(config, content, { fillEmptyFrom: mode === 'preview' ? locale : null });
      const photos = content.media.filter((media) => media.kind === 'image' && media.placement !== 'hero');
      const memorySection = resolved.sections.find((section) => section.lists.moments);
      if (memorySection?.lists.moments) {
        memorySection.lists.moments = attachMomentImages(memorySection.lists.moments, mediaUrls, photos.map((photo) => photo.id));
      }
      return resolved;
    },
    [config, content, mode, locale, mediaUrls],
  );
  const labels = giftLabels(locale);
  if (!config || !model) return <div className="bl-root"><p className="bl-empty">{labels.emptyGift}</p></div>;
  const resolvedAudioSrc = audioSrc ?? (() => {
    const audio = content.media.find((media) => media.kind === 'audio');
    if (audio) return mediaUrls[audio.id];
    // The public demo uses an original Bloomora instrumental, never an unlicensed commercial recording.
    if (mode === 'demo' && templateId === 'for-you-scrapbook') return '/audio/bloomora-demo-original.mp3';
    return undefined;
  })();
  const heroMedia = content.media.find((media) => media.kind === 'image' && media.placement === 'hero');
  return (
    <GiftExperience
      model={model} labels={labels} mode={mode} locale={locale} title={config.name[locale]}
      navActions={navActions} footer={footer} audioSrc={resolvedAudioSrc}
      coverImage={heroMedia ? mediaUrls[heroMedia.id] : undefined}
    />
  );
}
