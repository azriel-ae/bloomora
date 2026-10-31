'use client';

import { AlertCircle, Check, LoaderCircle, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GiftView } from '@/components/gift/gift-view';
import { giftLabels } from '@/components/gift/labels';
import { useLocale } from './locale-provider';
import { DraftAutosaver, type AutosaveStatus } from '@/lib/editor/autosave';
import { blankContent } from '@/lib/engine/resolve';
import { getActiveTemplate, getTemplateForRender, listCatalog } from '@/lib/engine/registry';
import type { FieldDef, ListDef, SectionDef, TemplateConfig } from '@/lib/engine/types';
import type { GiftContent } from '@/lib/model/types';

type GiftDraftResponse = {
  giftId: string;
  templateId: string | null;
  templateVersion: number;
  status: string;
  draft: { content: GiftContent; version: number; updatedAtMs: number };
  editable: boolean;
  reason: string | null;
  entitlement: { state: 'active' | 'expired' | 'none'; expiresAtMs: number | null };
};

type ApiResponse = { ok?: boolean; code?: string; version?: number; giftId?: string; currentVersion?: number; slug?: string };

function localizedSectionName(section: SectionDef, locale: 'id' | 'en') {
  const labels = giftLabels(locale);
  const key = `section${section.type[0].toUpperCase()}${section.type.slice(1)}` as keyof typeof labels;
  return String(labels[key] ?? section.type);
}

function errorKey(code: string | null): string {
  switch (code) {
    case 'subscription_expired': return 'subscriptionExpired';
    case 'no_subscription': return 'noSubscription';
    case 'quota_reached': return 'quotaReached';
    case 'template_not_in_package': return 'templateNotInPackage';
    case 'version_conflict': return 'versionConflict';
    case 'incomplete_content': return 'incompleteContent';
    case 'media_unavailable': return 'mediaUnavailable';
    case 'server_not_configured': return 'serverNotConfigured';
    case 'sign_in_required': return 'signInRequired';
    case 'not_owner': return 'notOwner';
    case 'gift_not_found': return 'giftNotFound';
    case 'gift_archived': return 'giftArchived';
    case 'template_unavailable': return 'templateUnavailable';
    case 'network_error': return 'networkError';
    default: return 'saveFailed';
  }
}

async function readJson(response: Response): Promise<ApiResponse> {
  return response.json().catch(() => ({})) as Promise<ApiResponse>;
}

export function GiftEditor({ giftId, initialTemplateId, devMode = false }: {
  giftId?: string;
  initialTemplateId?: string;
  devMode?: boolean;
}) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const catalog = useMemo(() => listCatalog(), []);
  const [activeGiftId, setActiveGiftId] = useState<string | null>(giftId ?? null);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? '');
  const [templateVersion, setTemplateVersion] = useState<number | null>(null);
  const [content, setContent] = useState<GiftContent | null>(null);
  const [dataLoaded, setDataLoaded] = useState(!giftId);
  const [editable, setEditable] = useState(true);
  const [readOnlyReason, setReadOnlyReason] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>('saved');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [hasNewChanges, setHasNewChanges] = useState(false);
  const [creating, setCreating] = useState(false);
  const autosaverRef = useRef<DraftAutosaver | null>(null);
  const versionRef = useRef(0);
  const contentRef = useRef<GiftContent | null>(content);
  const baselineRef = useRef<GiftContent | null>(null);
  const templateIdRef = useRef(templateId);
  contentRef.current = content;
  templateIdRef.current = templateId;

  const template = useMemo<TemplateConfig | null>(() => {
    if (!templateId) return null;
    return templateVersion === null
      ? getActiveTemplate(templateId)
      : getTemplateForRender(templateId, templateVersion) ?? getActiveTemplate(templateId);
  }, [templateId, templateVersion]);

  useEffect(() => {
    if (!activeGiftId) {
      const selected = initialTemplateId ? getActiveTemplate(initialTemplateId) : null;
      if (selected && !contentRef.current) {
        setTemplateVersion(selected.version);
        setContent(blankContent(selected));
      }
      return;
    }
    let live = true;
    setDataLoaded(false);
    setErrorCode(null);
    void fetch(`/api/gifts/${encodeURIComponent(activeGiftId)}`, { cache: 'no-store' })
      .then(async (response) => ({ response, data: await readJson(response) }))
      .then(({ response, data }) => {
        if (!live) return;
        if (!response.ok || !data.ok) {
          setErrorCode(data.code ?? 'network_error');
          setContent(null);
          setDataLoaded(true);
          return;
        }
        const draft = data as unknown as GiftDraftResponse;
        setTemplateId(draft.templateId ?? '');
        setTemplateVersion(draft.templateVersion);
        setContent(draft.draft.content);
        contentRef.current = draft.draft.content;
        baselineRef.current = draft.draft.content;
        versionRef.current = draft.draft.version;
        setDraftVersion(draft.draft.version);
        setEditable(draft.editable);
        setReadOnlyReason(draft.reason);
        setSaveStatus('saved');
        setDataLoaded(true);
      })
      .catch(() => {
        if (!live) return;
        setErrorCode('network_error');
        setDataLoaded(true);
      });
    return () => { live = false; };
  }, [activeGiftId, initialTemplateId]);

  useEffect(() => {
    if (template && templateVersion === null) setTemplateVersion(template.version);
  }, [template, templateVersion]);

  useEffect(() => {
    if (!activeGiftId || !dataLoaded || !editable || !content) {
      autosaverRef.current?.dispose();
      autosaverRef.current = null;
      return;
    }
    const saver = new DraftAutosaver({
      initialVersion: versionRef.current,
      delayMs: 650,
      save: async (draft, expectedVersion) => {
        try {
          const response = await fetch(`/api/gifts/${encodeURIComponent(activeGiftId)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ expectedVersion, content: draft, ...(templateIdRef.current ? { templateId: templateIdRef.current } : {}) }),
          });
          const data = await readJson(response);
          return response.ok && data.ok && Number.isInteger(data.version)
            ? { ok: true as const, version: data.version! }
            : { ok: false as const, code: data.code ?? 'network_error' };
        } catch {
          return { ok: false as const, code: 'network_error' };
        }
      },
      onStatus: (status, code) => {
        setSaveStatus(status);
        if (code) {
          setErrorCode(code);
          if (code === 'subscription_expired' || code === 'no_subscription') {
            setEditable(false);
            setReadOnlyReason(code);
          }
        } else if (status === 'dirty' || status === 'saving' || status === 'saved') {
          setErrorCode(null);
        }
      },
      onVersion: (version) => { versionRef.current = version; setDraftVersion(version); },
    });
    autosaverRef.current = saver;
    baselineRef.current = content;
    return () => {
      saver.dispose();
      if (autosaverRef.current === saver) autosaverRef.current = null;
    };
    // The autosaver is initialized once per gift/load permission. Its version is maintained by onVersion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGiftId, dataLoaded, editable]);

  useEffect(() => {
    if (!activeGiftId || !dataLoaded || !editable || !content || !autosaverRef.current) return;
    if (baselineRef.current === content) { baselineRef.current = null; return; }
    autosaverRef.current.update(content);
    setHasNewChanges(true);
  }, [activeGiftId, content, dataLoaded, editable]);

  const hasUnsaved = hasNewChanges || saveStatus === 'dirty' || saveStatus === 'saving' || saveStatus === 'error' || saveStatus === 'conflict';
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  const updateField = (field: FieldDef, value: string) => {
    setContent((current) => current ? { ...current, fields: { ...current.fields, [field.key]: value.slice(0, field.maxLength) } } : current);
    if (!activeGiftId) setHasNewChanges(true);
  };
  const updateListField = (list: ListDef, index: number, field: FieldDef, value: string) => {
    setContent((current) => {
      if (!current) return current;
      const items = Array.isArray(current.data[list.key]) ? [...current.data[list.key] as Record<string, string>[]] : [];
      items[index] = { ...(items[index] ?? {}), [field.key]: value.slice(0, field.maxLength) };
      return { ...current, data: { ...current.data, [list.key]: items } };
    });
    if (!activeGiftId) setHasNewChanges(true);
  };
  const addListItem = (list: ListDef) => {
    setContent((current) => {
      if (!current) return current;
      const items = Array.isArray(current.data[list.key]) ? [...current.data[list.key] as Record<string, string>[]] : [];
      if (items.length >= list.maxItems) return current;
      items.push({});
      return { ...current, data: { ...current.data, [list.key]: items } };
    });
    if (!activeGiftId) setHasNewChanges(true);
  };
  const removeListItem = (list: ListDef, index: number) => {
    setContent((current) => {
      if (!current) return current;
      const items = Array.isArray(current.data[list.key]) ? [...current.data[list.key] as Record<string, string>[]] : [];
      if (items.length <= list.minItems) return current;
      items.splice(index, 1);
      return { ...current, data: { ...current.data, [list.key]: items } };
    });
    if (!activeGiftId) setHasNewChanges(true);
  };
  const toggleSection = (section: SectionDef, enabled: boolean) => {
    if (!template || !section.optional) return;
    setContent((current) => {
      if (!current) return current;
      const selected = new Set(current.sections);
      if (enabled) selected.add(section.id); else selected.delete(section.id);
      return { ...current, sections: template.sections.filter((item) => selected.has(item.id)).map((item) => item.id) };
    });
    if (!activeGiftId) setHasNewChanges(true);
  };

  const createDraft = async () => {
    if (!template || !content || creating) return;
    setCreating(true); setSaveStatus('saving'); setErrorCode(null);
    try {
      const response = await fetch('/api/gifts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId: template.id, content }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok || typeof data.giftId !== 'string' || !Number.isInteger(data.version)) {
        setErrorCode(data.code ?? 'network_error'); setSaveStatus('error'); return;
      }
      versionRef.current = data.version!;
      setDraftVersion(data.version!);
      baselineRef.current = content;
      setHasNewChanges(false);
      setActiveGiftId(data.giftId);
      setSaveStatus('saved');
      router.replace(`/editor/g/${encodeURIComponent(data.giftId)}`);
    } catch {
      setErrorCode('network_error'); setSaveStatus('error');
    } finally {
      setCreating(false);
    }
  };

  const reloadFromServer = useCallback(async () => {
    if (!activeGiftId) return;
    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/gifts/${encodeURIComponent(activeGiftId)}`, { cache: 'no-store' });
      const data = await readJson(response);
      if (!response.ok || !data.ok) { setErrorCode(data.code ?? 'network_error'); setSaveStatus('error'); return; }
      const draft = data as unknown as GiftDraftResponse;
      autosaverRef.current?.reset(draft.draft.version);
      versionRef.current = draft.draft.version;
      setDraftVersion(draft.draft.version);
      setContent(draft.draft.content);
      contentRef.current = draft.draft.content;
      baselineRef.current = draft.draft.content;
      setTemplateId(draft.templateId ?? '');
      setTemplateVersion(draft.templateVersion);
      setEditable(draft.editable);
      setReadOnlyReason(draft.reason);
      setErrorCode(null);
      setHasNewChanges(false);
      setSaveStatus('saved');
    } catch {
      setErrorCode('network_error'); setSaveStatus('error');
    }
  }, [activeGiftId]);

  const chooseTemplate = (id: string) => {
    const selected = getActiveTemplate(id);
    if (!selected) return;
    setTemplateId(id);
    setTemplateVersion(selected.version);
    setContent(blankContent(selected));
    setErrorCode(null);
    setHasNewChanges(true);
  };

  if (activeGiftId && !dataLoaded) {
    return <div className="mx-auto max-w-5xl px-5 py-16" role="status">{t('editor', 'loadingDraft')}</div>;
  }
  if (activeGiftId && errorCode && !content) {
    return <div className="mx-auto max-w-3xl px-5 py-16"><div className="rounded-3xl border border-line bg-paper p-7"><p role="alert" className="text-sm leading-6">{t('errors', errorKey(errorCode))}</p><button type="button" onClick={() => router.refresh()} className="mt-5 rounded-full border border-line px-4 py-2 text-sm">{t('editor', 'retry')}</button></div></div>;
  }
  if (!template || !content) {
    return <div className="mx-auto max-w-3xl px-5 py-16"><h1 className="font-display text-3xl">{t('editor', 'chooseTemplate')}</h1><p className="mt-2 text-sm text-ink/60">{t('editor', 'chooseTemplateHelp')}</p><div className="mt-5 grid gap-2">{catalog.map((item) => <button key={item.id} type="button" onClick={() => chooseTemplate(item.id)} className="rounded-xl border border-line bg-paper px-4 py-3 text-left text-sm hover:border-moss">{item.name[locale]}</button>)}</div></div>;
  }

  const statusText = saveStatus === 'saving' ? t('editor', 'statusSaving')
    : saveStatus === 'dirty' ? t('editor', 'statusUnsaved')
      : saveStatus === 'error' ? t('editor', 'statusFailed')
        : saveStatus === 'conflict' ? t('editor', 'statusConflict')
          : t('editor', 'statusSaved');
  const canEditContent = editable && !readOnlyReason;
  return (
    <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8" data-editor-form data-editor-gift-id={activeGiftId ?? ''} data-editor-status={saveStatus} data-dev-mode={devMode ? 'in-memory' : undefined}>
      {devMode && <aside className="mb-5 rounded-2xl border border-[#d4b875] bg-[#faf2dc] px-4 py-3 text-sm leading-6 text-ink/75" data-dev-warning="true">{t('editor', 'devNotice')}</aside>}
      {readOnlyReason && <aside className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d4b875] bg-[#faf2dc] px-4 py-3 text-sm leading-6" role="status" data-readonly-reason={readOnlyReason}><span>{t('errors', errorKey(readOnlyReason))}</span><Link href="/pricing" className="font-semibold text-moss underline underline-offset-4">{t('editor', 'renew')}</Link></aside>}
      {errorCode && content && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d4b875] bg-[#faf2dc] px-4 py-3 text-sm leading-6" role="alert"><span>{t('errors', errorKey(errorCode))}</span>{errorCode === 'version_conflict' && <button type="button" data-reload-server onClick={() => void reloadFromServer()} className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold">{t('editor', 'reloadServer')}</button>}{saveStatus === 'error' && !['subscription_expired', 'no_subscription'].includes(errorCode) && <button type="button" onClick={() => activeGiftId ? void autosaverRef.current?.retry() : void createDraft()} className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold">{t('editor', 'retry')}</button>}</div>}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-moss">{t('editor', 'eyebrow')} / {template.name[locale]}</p>
          <h1 className="mt-2 font-display text-3xl">{template.name[locale]}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 text-xs text-ink/60" role="status" aria-live="polite" data-save-status={saveStatus}>
            {saveStatus === 'saving' ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : saveStatus === 'saved' ? <Check size={15} className="text-moss" aria-hidden="true" /> : saveStatus === 'error' || saveStatus === 'conflict' ? <AlertCircle size={15} className="text-rose" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {statusText}{activeGiftId && draftVersion ? ` · v${draftVersion}` : ''}
          </span>
          {!activeGiftId && <button type="button" disabled={!canEditContent || creating} onClick={() => void createDraft()} className="rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-ivory disabled:cursor-not-allowed disabled:opacity-50" data-create-draft>{creating ? t('editor', 'statusSaving') : t('editor', 'createDraft')}</button>}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,.9fr)_minmax(480px,1.1fr)]">
        <section className="space-y-4" aria-label={t('editor', 'details')}>
          {template.sections.map((section) => {
            const sectionEnabled = content.sections.includes(section.id);
            const audioSection = section.requiresMedia === 'audio';
            return (
              <fieldset key={section.id} disabled={!canEditContent} className="rounded-3xl border border-line bg-paper p-5 shadow-soft disabled:opacity-90" data-editor-section={section.id}>
                <legend className="sr-only">{localizedSectionName(section, locale)}</legend>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <h2 className="font-display text-xl">{localizedSectionName(section, locale)}</h2>
                  {audioSection
                    ? <span className="rounded-full bg-[#f2dfd8] px-3 py-1 text-xs text-ink/65">{t('editor', 'notAvailable')}</span>
                    : section.optional ? <label className="flex items-center gap-2 text-xs font-semibold text-ink/65"><input type="checkbox" checked={sectionEnabled} onChange={(event) => toggleSection(section, event.target.checked)} aria-label={`${t('editor', 'includeSection')} ${localizedSectionName(section, locale)}`} />{t('editor', 'includeSection')}</label>
                      : <span className="rounded-full bg-sage px-3 py-1 text-xs text-moss">{t('editor', 'requiredSection')}</span>}
                </div>
                {audioSection && <p className="mb-4 text-sm leading-6 text-ink/60">{t('editor', 'musicDisabled')}</p>}
                {section.fields.map((field) => <FieldInput key={field.key} field={field} value={content.fields[field.key] ?? ''} locale={locale} disabled={!canEditContent || (section.optional && !sectionEnabled) || audioSection} onChange={(value) => updateField(field, value)} />)}
                {section.lists.map((list) => {
                  const items = Array.isArray(content.data[list.key]) ? content.data[list.key] as Record<string, string>[] : [];
                  return <div key={list.key} className="mt-5 border-t border-line pt-4" data-editor-list={list.key}>
                    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{list.label[locale]}</h3><span className="text-xs text-ink/45">{items.length}/{list.maxItems}</span></div>
                    {items.map((item, index) => <div key={`${list.key}-${index}`} className="mt-3 rounded-2xl bg-ivory p-3" data-list-item={index}>
                      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-moss">{list.itemLabel[locale]} {index + 1}</span><button type="button" disabled={!canEditContent || items.length <= list.minItems} onClick={() => removeListItem(list, index)} className="text-xs font-semibold text-rose underline underline-offset-4 disabled:opacity-40">{t('editor', 'removeItem')}</button></div>
                      {list.itemFields.map((field) => <FieldInput key={field.key} field={field} value={item[field.key] ?? ''} locale={locale} disabled={!canEditContent || (!!section.optional && !sectionEnabled)} onChange={(value) => updateListField(list, index, field, value)} idPrefix={`${list.key}-${index}`} compact />)}
                    </div>)}
                    <button type="button" disabled={!canEditContent || items.length >= list.maxItems || (section.optional && !sectionEnabled)} onClick={() => addListItem(list)} className="mt-3 rounded-full border border-dashed border-moss px-4 py-2 text-xs font-semibold text-moss disabled:cursor-not-allowed disabled:opacity-40">{list.itemLabel[locale]} · {t('editor', 'addItem')}</button>
                  </div>;
                })}
              </fieldset>
            );
          })}
          <fieldset disabled={!canEditContent} className="rounded-3xl border border-line bg-paper p-5 disabled:opacity-80">
            <legend className="font-display text-xl">{t('editor', 'media')}</legend>
            <p className="mt-2 text-sm leading-6 text-ink/60">{t('editor', 'mediaDisabled')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled aria-describedby="media-disabled-note" className="rounded-xl border border-line px-3 py-3 text-left text-sm opacity-55">{t('editor', 'photos')} · {t('editor', 'notAvailable')}</button>
              <button type="button" disabled aria-describedby="media-disabled-note" className="rounded-xl border border-line px-3 py-3 text-left text-sm opacity-55">{t('editor', 'music')} · {t('editor', 'notAvailable')}</button>
            </div>
            <p id="media-disabled-note" className="mt-3 text-xs leading-5 text-ink/50">{t('editor', 'mediaDisabled')}</p>
          </fieldset>
          {!activeGiftId && <div className="flex justify-end"><button type="button" disabled={!canEditContent || creating} onClick={() => void createDraft()} className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{creating ? t('editor', 'statusSaving') : t('editor', 'createDraft')}</button></div>}
        </section>

        <section className="min-h-[560px] rounded-3xl border border-line bg-[#e9e8df] p-3 shadow-soft sm:p-5 xl:sticky xl:top-24" aria-label={t('common', 'preview')} data-editor-preview>
          <div className="mb-3 flex items-center justify-between px-1"><h2 className="font-display text-xl">{t('common', 'preview')}</h2><span className="text-xs text-ink/50">{template.name[locale]}</span></div>
          <div className="h-[min(78svh,860px)] min-h-[500px] overflow-hidden rounded-2xl border border-line bg-paper shadow-paper">
            <GiftView templateId={template.id} templateVersion={template.version} content={content} locale={locale} mode="preview" />
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-ink/50">{t('editor', 'previewNote')}</p>
        </section>
      </div>
    </main>
  );
}

function FieldInput({ field, value, locale, disabled, onChange, compact = false, idPrefix = 'root' }: {
  field: FieldDef;
  value: string;
  locale: 'id' | 'en';
  disabled: boolean;
  onChange: (value: string) => void;
  compact?: boolean;
  idPrefix?: string;
}) {
  const id = `field-${idPrefix}-${field.key}`;
  const base = `mt-2 w-full rounded-xl border border-line bg-ivory px-3 py-2.5 text-sm outline-none focus:border-moss disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'text-xs' : ''}`;
  return <label htmlFor={id} className={`mt-4 block text-sm font-semibold ${compact ? 'text-xs' : ''}`} data-field-key={field.key}>
    {field.label[locale]}{field.required ? <span className="ml-1 text-rose" aria-label={locale === 'id' ? 'wajib' : 'required'}>*</span> : null}
    {field.kind === 'textarea'
      ? <textarea id={id} value={value} maxLength={field.maxLength} rows={compact ? 2 : 4} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={`${base} resize-y leading-6`} />
      : <input id={id} type={field.kind === 'date' ? 'date' : 'text'} value={value} maxLength={field.maxLength} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={base} />}
    {field.hint && <span className="mt-1 block text-xs font-normal leading-5 text-ink/45">{field.hint[locale]}</span>}
  </label>;
}
