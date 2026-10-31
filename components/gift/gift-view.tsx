'use client';

import { useMemo, type ReactNode } from 'react';
import type { GiftContent, Locale } from '@/lib/engine/types';
import { getTemplateForRender } from '@/lib/engine/registry';
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
  navActions?: ReactNode; footer?: ReactNode; audioSrc?: string;
}) {
  const { templateId, templateVersion, content, locale, mode, navActions, footer, audioSrc } = props;
  const config = useMemo(() => getTemplateForRender(templateId, templateVersion), [templateId, templateVersion]);
  const model = useMemo(
    () => (config ? resolveRenderModel(config, content, { fillEmptyFrom: mode === 'preview' ? locale : null }) : null),
    [config, content, mode, locale],
  );
  const labels = giftLabels(locale);
  if (!config || !model) return <div className="bl-root"><p className="bl-empty">{labels.emptyGift}</p></div>;
  return (
    <GiftExperience
      model={model} labels={labels} mode={mode} title={config.name[locale]}
      navActions={navActions} footer={footer} audioSrc={audioSrc}
    />
  );
}
