'use client';

import { AlertCircle, Check, ImagePlus, LoaderCircle, Monitor, Music2, Save, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { GiftView } from '@/components/gift/gift-view';
import { giftLabels } from '@/components/gift/labels';
import { useLocale } from './locale-provider';
import { DraftAutosaver, type AutosaveStatus } from '@/lib/editor/autosave';
import { blankContent } from '@/lib/engine/resolve';
import { getActiveTemplate, getTemplateForRender, listCatalog } from '@/lib/engine/registry';
import { siteUrl } from '@/lib/site-url';
import type { FieldDef, ListDef, SectionDef, TemplateConfig } from '@/lib/engine/types';
import type { GiftContent } from '@/lib/model/types';

type GiftDraftResponse = {
  giftId: string;
  slug: string;
  templateId: string | null;
  templateVersion: number;
  status: string;
  publishedRevision: number | null;
  publication: { canPublish: boolean; waitingForSubscription: boolean };
  draft: { content: GiftContent; version: number; updatedAtMs: number };
  mediaUrls?: Record<string, string>;
  editable: boolean;
  reason: string | null;
  entitlement: { state: 'active' | 'expired' | 'none'; expiresAtMs: number | null };
};

type ApiResponse = { ok?: boolean; code?: string; version?: number; revision?: number; giftId?: string; currentVersion?: number; slug?: string; editToken?: string; media?: GiftContent['media'][number]; mediaId?: string; signedUrl?: string; mediaUrls?: Record<string, string> };

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
    case 'media_not_found': return 'mediaDeleteFailed';
    case 'media_storage_delete_failed': return 'mediaDeleteFailed';
    case 'invalid_media_type': return 'invalidMediaType';
    case 'media_signature_mismatch': return 'invalidMediaType';
    case 'invalid_media_size': return 'invalidMediaSize';
    case 'guest_media_limit': return 'mediaLimitReached';
    case 'guest_audio_limit': return 'audioLimitReached';
    case 'edit_link_invalid': return 'editLinkInvalid';
    case 'edit_link_expired': return 'editLinkExpired';
    case 'rate_limited': return 'uploadRateLimited';
    case 'publish_failed': return 'saveFailed';
    case 'network_error': return 'networkError';
    default: return 'saveFailed';
  }
}

async function readJson(response: Response): Promise<ApiResponse> {
  return response.json().catch(() => ({})) as Promise<ApiResponse>;
}

function guestHeaders(giftId?: string): HeadersInit {
  if (typeof window === 'undefined') return {};
  const token = (giftId ? window.sessionStorage.getItem(`bloomora_edit_token:${giftId}`) : null) ?? window.sessionStorage.getItem('bloomora_edit_token');
  return token ? { 'x-bloomora-edit-token': token } : {};
}

export function GiftEditor({ giftId, initialTemplateId, initialEditToken, devMode = false }: {
  giftId?: string;
  initialTemplateId?: string;
  initialEditToken?: string;
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
  const [publishing, setPublishing] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [waitingForSubscription, setWaitingForSubscription] = useState(false);
  const [publishedRevision, setPublishedRevision] = useState<number | null>(null);
  const [giftSlug, setGiftSlug] = useState('');
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [editLinkCopied, setEditLinkCopied] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaDeleting, setMediaDeleting] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetMomentRef = useRef<number | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
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
    if (!giftId || !initialEditToken) return;
    try {
      window.sessionStorage.setItem(`bloomora_edit_token:${giftId}`, initialEditToken);
      window.sessionStorage.setItem('bloomora_edit_token', initialEditToken);
    } catch { /* Guest editing still relies on the request header from this session. */ }
  }, [giftId, initialEditToken]);

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
    void fetch(`/api/guest/gifts/${encodeURIComponent(activeGiftId)}`, { cache: 'no-store', headers: guestHeaders(activeGiftId) })
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
        setGiftSlug(draft.slug);
        setPublishedRevision(draft.publishedRevision);
        setCanPublish(draft.publication?.canPublish === true);
        setWaitingForSubscription(draft.publication?.waitingForSubscription === true);
        setTemplateId(draft.templateId ?? '');
        setTemplateVersion(draft.templateVersion);
        setContent(draft.draft.content);
        setMediaUrls(draft.mediaUrls ?? {});
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
    if (!activeGiftId || !dataLoaded || !content?.media.length) { setMediaUrls({}); return; }
    let live = true;
    void fetch(`/api/guest/gifts/${encodeURIComponent(activeGiftId)}/media`, { cache: 'no-store', headers: guestHeaders(activeGiftId) })
      .then(async (response) => ({ response, data: await readJson(response) }))
      .then(({ response, data }) => { if (live && response.ok && data.ok && data.mediaUrls) setMediaUrls(data.mediaUrls); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [activeGiftId, dataLoaded, content?.media.length]);

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
          const response = await fetch(`/api/guest/gifts/${encodeURIComponent(activeGiftId)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json', ...guestHeaders(activeGiftId) },
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
          if (status === 'saved') setHasNewChanges(false);
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

  const copyEditLink = async () => {
    if (!activeGiftId) return;
    const token = window.sessionStorage.getItem(`bloomora_edit_token:${activeGiftId}`) ?? window.sessionStorage.getItem('bloomora_edit_token');
    if (!token) { setErrorCode('network_error'); return; }
    const url = siteUrl(`/edit/${encodeURIComponent(token)}`);
    try { await navigator.clipboard.writeText(url); }
    catch {
      const input = document.createElement('input'); input.value = url; input.select(); document.execCommand('copy'); input.remove();
    }
    setEditLinkCopied(true);
    window.setTimeout(() => setEditLinkCopied(false), 1800);
  };

  const createDraftForMedia = async (): Promise<{ giftId: string; version: number }> => {
    if (!template || !content) throw new Error('draft_content_missing');
    const response = await fetch('/api/guest/gifts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, content }),
    });
    const data = await readJson(response);
    const version = Number(data.version);
    if (!response.ok || !data.ok || typeof data.giftId !== 'string' || !Number.isInteger(version) || typeof data.editToken !== 'string') {
      throw new Error(data.code ?? 'draft_create_failed');
    }
    window.sessionStorage.setItem(`bloomora_edit_token:${data.giftId}`, data.editToken);
    window.sessionStorage.setItem('bloomora_edit_token', data.editToken);
    versionRef.current = version;
    setDraftVersion(version);
    setActiveGiftId(data.giftId);
    baselineRef.current = content;
    setHasNewChanges(false);
    setSaveStatus('saved');
    return { giftId: data.giftId, version };
  };

  const uploadMedia = async (kind: 'image' | 'audio', file?: File, momentIndex?: number) => {
    if (!file || mediaUploading) return;
    setMediaUploading(true); setMediaError('');
    try {
      let targetGiftId = activeGiftId;
      const saver = autosaverRef.current;
      await saver?.flush();
      if (saver?.hasPendingChanges) { setMediaError(t('editor', 'mediaUploadFailed')); return; }
      let expectedVersion = saver?.currentVersion ?? versionRef.current;
      if (!targetGiftId) {
        const created = await createDraftForMedia();
        targetGiftId = created.giftId;
        expectedVersion = created.version;
      }
      const form = new FormData();
      form.set('file', file);
      form.set('kind', kind);
      form.set('expectedVersion', String(expectedVersion));
      const response = await fetch(`/api/guest/gifts/${encodeURIComponent(targetGiftId)}/media`, {
        method: 'POST', headers: guestHeaders(targetGiftId), body: form,
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok || !data.media || !Number.isInteger(data.version) || typeof data.signedUrl !== 'string') {
        if (data.code === 'photo_limit_reached' || data.code === 'guest_media_limit') setMediaError(t('editor', 'photoLimitReached'));
        else if (data.code === 'media_not_in_package') setMediaError(t('editor', 'musicNotIncluded'));
        else if (data.code === 'media_unavailable' || data.code === 'storage_not_configured' || data.code === 'server_not_configured') setMediaError(t('editor', 'mediaDisabled'));
        else if (data.code === 'no_subscription' || data.code === 'subscription_expired') setMediaError(t('errors', data.code === 'no_subscription' ? 'noSubscription' : 'subscriptionExpired'));
        else if (data.code === 'invalid_media_type' || data.code === 'media_signature_mismatch') setMediaError(t('errors', 'invalidMediaType'));
        else if (data.code === 'invalid_media_size') setMediaError(t('errors', 'invalidMediaSize'));
        else if (data.code === 'guest_audio_limit') setMediaError(t('errors', 'audioLimitReached'));
        else if (data.code === 'rate_limited') setMediaError(t('errors', 'uploadRateLimited'));
        else setMediaError(t('editor', 'mediaUploadFailed'));
        return;
      }
      const current = contentRef.current ?? content!;
      const next = { ...current, media: [...current.media, data.media] };
      if (kind === 'image' && Number.isInteger(momentIndex)) {
        const moments = Array.isArray(next.data.moments) ? [...next.data.moments as Record<string, string>[]] : [];
        moments[momentIndex!] = { ...(moments[momentIndex!] ?? {}), photoId: data.media.id };
        next.data = { ...next.data, moments };
      }
      let savedVersion = data.version!;
      if (kind === 'image' && Number.isInteger(momentIndex) && !activeGiftId) {
        const saveResponse = await fetch(`/api/guest/gifts/${encodeURIComponent(targetGiftId)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', ...guestHeaders(targetGiftId) },
          body: JSON.stringify({ expectedVersion: savedVersion, content: next, ...(templateIdRef.current ? { templateId: templateIdRef.current } : {}) }),
        });
        const saveData = await readJson(saveResponse);
        if (!saveResponse.ok || !saveData.ok || !Number.isInteger(saveData.version)) throw new Error(saveData.code ?? 'moment_photo_save_failed');
        savedVersion = saveData.version!;
      }
      contentRef.current = next;
      baselineRef.current = kind === 'image' && Number.isInteger(momentIndex) ? null : next;
      versionRef.current = savedVersion;
      setDraftVersion(savedVersion);
      saver?.reset(savedVersion);
      setContent(next);
      setMediaUrls((current) => ({ ...current, [data.media!.id]: data.signedUrl! }));
      setHasNewChanges(false);
      setMediaError('');
      if (!activeGiftId && targetGiftId) router.replace(`/editor/g/${encodeURIComponent(targetGiftId)}`);
    } catch {
      setMediaError(t('editor', 'mediaUploadFailed'));
    } finally {
      setMediaUploading(false);
    }
  };

  const deleteMedia = async (mediaId: string) => {
    if (!activeGiftId || !contentRef.current || mediaDeleting || !canEditContent) return;
    setMediaDeleting(mediaId); setMediaError('');
    try {
      const saver = autosaverRef.current;
      await saver?.flush();
      if (saver?.hasPendingChanges) { setMediaError(t('editor', 'mediaDeleteFailed')); return; }
      const expectedVersion = saver?.currentVersion ?? versionRef.current;
      const response = await fetch(`/api/guest/gifts/${encodeURIComponent(activeGiftId)}/media`, {
        method: 'DELETE', headers: { 'content-type': 'application/json', ...guestHeaders(activeGiftId) },
        body: JSON.stringify({ mediaId, expectedVersion }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok || data.mediaId !== mediaId || !Number.isInteger(data.version)) {
        setMediaError(data.code === 'version_conflict' ? t('errors', 'versionConflict') : t('editor', 'mediaDeleteFailed'));
        return;
      }
      const current = contentRef.current ?? content!;
      const moments = Array.isArray(current.data.moments) ? current.data.moments as Record<string, string>[] : [];
      const clearsMomentPhoto = moments.some((moment) => moment.photoId === mediaId);
      const next = {
        ...current,
        media: current.media.filter((item) => item.id !== mediaId),
        data: { ...current.data, moments: moments.map((moment) => moment.photoId === mediaId ? { ...moment, photoId: '' } : moment) },
      };
      contentRef.current = next; baselineRef.current = clearsMomentPhoto ? null : next; versionRef.current = data.version!;
      setDraftVersion(data.version!); saver?.reset(data.version!); setContent(next);
      setMediaUrls((current) => { const copy = { ...current }; delete copy[mediaId]; return copy; });
      setMediaError('');
    } catch {
      setMediaError(t('editor', 'mediaDeleteFailed'));
    } finally { setMediaDeleting(null); }
  };

  const createDraft = async () => {
    if (!template || !content || creating) return;
    setCreating(true); setSaveStatus('saving'); setErrorCode(null);
    try {
      const response = await fetch('/api/guest/gifts', {
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
      if (typeof window !== 'undefined' && typeof data.editToken === 'string') {
        window.sessionStorage.setItem(`bloomora_edit_token:${data.giftId}`, data.editToken);
        window.sessionStorage.setItem('bloomora_edit_token', data.editToken);
      }
      setSaveStatus('saved');
      router.replace(`/editor/g/${encodeURIComponent(data.giftId)}`);
    } catch {
      setErrorCode('network_error'); setSaveStatus('error');
    } finally {
      setCreating(false);
    }
  };

  const publishDraft = async () => {
    if (!activeGiftId || !canPublish || publishing) return;
    if (!window.confirm(`${t('editor', 'publishConfirm')}\n\n${t('editor', 'publishBody')}`)) return;
    setPublishing(true); setErrorCode(null);
    try {
      const saver = autosaverRef.current;
      await saver?.flush();
      if (saver?.hasPendingChanges) { setErrorCode('publish_failed'); return; }
      const expectedVersion = saver?.currentVersion ?? versionRef.current;
      const response = await fetch(`/api/guest/gifts/${encodeURIComponent(activeGiftId)}/publish`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...guestHeaders(activeGiftId) },
        body: JSON.stringify({ expectedVersion }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.ok || !Number.isInteger(data.revision) || typeof data.slug !== 'string') {
        setErrorCode(data.code ?? 'publish_failed'); return;
      }
      setGiftSlug(data.slug);
      setPublishedRevision(data.revision!);
      setCanPublish(true); setWaitingForSubscription(false);
      setHasNewChanges(false); setSaveStatus('saved');
    } catch {
      setErrorCode('network_error');
    } finally {
      setPublishing(false);
    }
  };

  const reloadFromServer = useCallback(async () => {
    if (!activeGiftId) return;
    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/guest/gifts/${encodeURIComponent(activeGiftId)}`, { cache: 'no-store', headers: guestHeaders(activeGiftId) });
      const data = await readJson(response);
      if (!response.ok || !data.ok) { setErrorCode(data.code ?? 'network_error'); setSaveStatus('error'); return; }
      const draft = data as unknown as GiftDraftResponse;
      setGiftSlug(draft.slug);
      setPublishedRevision(draft.publishedRevision);
      setCanPublish(draft.publication?.canPublish === true);
      setWaitingForSubscription(draft.publication?.waitingForSubscription === true);
      autosaverRef.current?.reset(draft.draft.version);
      versionRef.current = draft.draft.version;
      setDraftVersion(draft.draft.version);
      setContent(draft.draft.content);
      setMediaUrls(draft.mediaUrls ?? {});
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
  const hasAudio = content.media.some((item) => item.kind === 'audio');
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
          {activeGiftId && canEditContent && <Link href={`/checkout?giftId=${encodeURIComponent(activeGiftId)}`} className="rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-ivory">Lanjut ke checkout</Link>}
          {activeGiftId && canPublish && <button type="button" disabled={publishing || !editable || hasUnsaved || saveStatus !== 'saved'} onClick={() => void publishDraft()} className="rounded-full border border-moss px-5 py-2.5 text-sm font-semibold text-moss disabled:cursor-not-allowed disabled:opacity-50">{publishing ? t('editor', 'statusSaving') : t('editor', 'publish')}</button>}
          {activeGiftId && waitingForSubscription && <span className="max-w-xs text-xs leading-5 text-ink/55">{t('editor', 'publishWaiting')}</span>}
          {activeGiftId && publishedRevision !== null && giftSlug && <Link href={`/g/${encodeURIComponent(giftSlug)}`} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold">{t('editor', 'openGift')}</Link>}
          {!activeGiftId && <button type="button" disabled={!canEditContent || creating} onClick={() => void createDraft()} className="rounded-full bg-moss px-5 py-2.5 text-sm font-semibold text-ivory disabled:cursor-not-allowed disabled:opacity-50" data-create-draft>{creating ? t('editor', 'statusSaving') : t('editor', 'createDraft')}</button>}
        </div>
      </div>

      {activeGiftId && <aside className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d4b875] bg-[#faf2dc] px-4 py-3" aria-label={t('editor', 'editLinkLabel')}><div><p className="text-sm font-semibold">{t('editor', 'editLinkLabel')}</p><p className="mt-1 text-xs leading-5 text-ink/60">{t('editor', 'editLinkWarning')}</p></div><button type="button" onClick={() => void copyEditLink()} className="rounded-full border border-line bg-paper px-4 py-2 text-sm font-semibold">{editLinkCopied ? t('editor', 'editLinkCopied') : t('editor', 'copyEditLink')}</button></aside>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(360px,.9fr)_minmax(480px,1.1fr)]">
        <section className="space-y-4" aria-label={t('editor', 'details')}>
          {template.sections.map((section) => {
            const sectionEnabled = content.sections.includes(section.id);
            const audioSection = section.requiresMedia === 'audio';
            return (
              <fieldset key={section.id} disabled={!canEditContent || mediaUploading} className="rounded-3xl border border-line bg-paper p-5 shadow-soft disabled:opacity-90" data-editor-section={section.id}>
                <legend className="sr-only">{localizedSectionName(section, locale)}</legend>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <h2 className="font-display text-xl">{localizedSectionName(section, locale)}</h2>
                  {audioSection
                    ? <span className="rounded-full bg-sage/30 px-3 py-1 text-xs text-moss">{hasAudio ? t('editor', 'uploadedMusic') : t('editor', 'music')}</span>
                    : section.optional ? <label className="flex items-center gap-2 text-xs font-semibold text-ink/65"><input type="checkbox" checked={sectionEnabled} onChange={(event) => toggleSection(section, event.target.checked)} aria-label={`${t('editor', 'includeSection')} ${localizedSectionName(section, locale)}`} />{t('editor', 'includeSection')}</label>
                      : <span className="rounded-full bg-sage px-3 py-1 text-xs text-moss">{t('editor', 'requiredSection')}</span>}
                </div>
                {section.fields.map((field) => <FieldInput key={field.key} field={field} value={content.fields[field.key] ?? ''} locale={locale} disabled={!canEditContent || mediaUploading || (!!section.optional && !sectionEnabled)} onChange={(value) => updateField(field, value)} />)}
                {section.lists.map((list) => {
                  const items = Array.isArray(content.data[list.key]) ? content.data[list.key] as Record<string, string>[] : [];
                  return <div key={list.key} className="mt-5 border-t border-line pt-4" data-editor-list={list.key}>
                    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{list.label[locale]}</h3><span className="text-xs text-ink/45">{items.length}/{list.maxItems}</span></div>
                    {items.map((item, index) => {
                      const momentPhoto = list.key === 'moments' && section.type === 'gallery'
                        ? content.media.find((media) => media.kind === 'image' && media.id === item.photoId)
                          ?? (items.some((moment) => moment.photoId) ? undefined : content.media.filter((media) => media.kind === 'image')[index])
                        : undefined;
                      const momentPhotoUrl = momentPhoto ? mediaUrls[momentPhoto.id] : undefined;
                      return <div key={`${list.key}-${index}`} className="mt-3 rounded-2xl bg-ivory p-3" data-list-item={index}>
                      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-moss">{list.itemLabel[locale]} {index + 1}</span><button type="button" disabled={!canEditContent || items.length <= list.minItems || !!momentPhoto} onClick={() => removeListItem(list, index)} className="text-xs font-semibold text-rose underline underline-offset-4 disabled:opacity-40">{t('editor', 'removeItem')}</button></div>
                      {list.itemFields.map((field) => <FieldInput key={field.key} field={field} value={item[field.key] ?? ''} locale={locale} disabled={!canEditContent || (!!section.optional && !sectionEnabled)} onChange={(value) => updateListField(list, index, field, value)} idPrefix={`${list.key}-${index}`} compact />)}
                      {list.key === 'moments' && section.type === 'gallery' && <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-3" data-moment-photo={index}>
                        {momentPhotoUrl && momentPhoto ? <Image src={momentPhotoUrl} alt={`${list.itemLabel[locale]} ${index + 1}`} width={56} height={56} unoptimized className="size-14 rounded-lg object-cover" /> : <span className="grid size-14 place-items-center rounded-lg bg-sage/20 text-moss"><ImagePlus size={19} /></span>}
                        {momentPhoto
                          ? <><span className="flex-1 text-xs font-semibold text-ink/65">{t('editor', 'momentPhotoAttached')}</span><button type="button" disabled={!canEditContent || mediaUploading || mediaDeleting !== null} onClick={() => void deleteMedia(momentPhoto.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose/30 px-2 py-1.5 text-xs font-semibold text-rose disabled:opacity-40">{mediaDeleting === momentPhoto.id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}{t('editor', 'removeMedia')}</button></>
                          : <button type="button" disabled={!canEditContent || mediaUploading || (!!section.optional && !sectionEnabled)} onClick={() => { photoTargetMomentRef.current = index; photoInputRef.current?.click(); }} className="rounded-full border border-moss px-3 py-2 text-xs font-semibold text-moss disabled:cursor-not-allowed disabled:opacity-40">{t('editor', 'uploadMomentPhoto')}</button>}
                      </div>}
                    </div>; })}
            <button type="button" disabled={!canEditContent || mediaUploading || items.length >= list.maxItems || (section.optional && !sectionEnabled)} onClick={() => addListItem(list)} className="mt-3 rounded-full border border-dashed border-moss px-4 py-2 text-xs font-semibold text-moss disabled:cursor-not-allowed disabled:opacity-40">{list.itemLabel[locale]} · {t('editor', 'addItem')}</button>
                  </div>;
                })}
              </fieldset>
            );
          })}
          <fieldset disabled={!canEditContent} className="rounded-3xl border border-line bg-paper p-5 disabled:opacity-80">
            <legend className="font-display text-xl">{t('editor', 'media')}</legend>
            <p className="mt-2 text-sm leading-6 text-ink/60">{t('editor', 'mediaUploadHelp')}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={!canEditContent || mediaUploading || hasAudio} onClick={() => audioInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-45"><Music2 size={16} />{hasAudio ? t('editor', 'uploadedMusic') : t('editor', 'uploadMusic')}</button>
            </div>
            <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t('editor', 'uploadMomentPhoto')} onChange={(event) => { void uploadMedia('image', event.target.files?.[0], photoTargetMomentRef.current ?? undefined); photoTargetMomentRef.current = null; event.currentTarget.value = ''; }} />
            <input ref={audioInputRef} type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/x-m4a" className="sr-only" aria-label={t('editor', 'uploadMusic')} onChange={(event) => { void uploadMedia('audio', event.target.files?.[0]); event.currentTarget.value = ''; }} />
            {mediaUploading && <p className="mt-3 text-sm text-ink/60" role="status">{t('editor', 'uploadingMedia')}</p>}
            {content.media.some((item) => item.kind === 'audio') && <ul className="mt-3 space-y-2 text-xs text-ink/60">{content.media.filter((item) => item.kind === 'audio').map((item, index) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-ivory px-3 py-2"><span>{t('editor', 'uploadedMusic')}</span><button type="button" disabled={!canEditContent || mediaUploading || mediaDeleting !== null} onClick={() => void deleteMedia(item.id)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose/30 px-2 py-1 text-rose disabled:opacity-40" aria-label={`${t('editor', 'removeMedia')} ${index + 1}`}>{mediaDeleting === item.id ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}{t('editor', 'removeMedia')}</button></li>)}</ul>}
            {mediaError && <p className="mt-3 text-sm text-rose" role="alert">{mediaError}</p>}
          </fieldset>
          {!activeGiftId && <div className="flex justify-end"><button type="button" disabled={!canEditContent || creating} onClick={() => void createDraft()} className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ivory disabled:opacity-50">{creating ? t('editor', 'statusSaving') : t('editor', 'createDraft')}</button></div>}
        </section>

        <section className="min-h-[560px] rounded-3xl border border-line bg-[#e9e8df] p-3 shadow-soft sm:p-5 xl:sticky xl:top-24" aria-label={t('common', 'preview')} data-editor-preview data-preview-mode={previewMode}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1"><div><h2 className="font-display text-xl">{t('common', 'preview')}</h2><span className="text-xs text-ink/50">{template.name[locale]}</span></div><div className="inline-flex rounded-full border border-line bg-paper p-1" role="group" aria-label={t('editor', 'previewDevice')}><button type="button" aria-pressed={previewMode === 'mobile'} onClick={() => setPreviewMode('mobile')} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${previewMode === 'mobile' ? 'bg-moss text-ivory' : 'text-ink/60 hover:bg-ivory'}`}><Smartphone size={14} aria-hidden="true" />{t('editor', 'mobilePreview')}</button><button type="button" aria-pressed={previewMode === 'desktop'} onClick={() => setPreviewMode('desktop')} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition ${previewMode === 'desktop' ? 'bg-moss text-ivory' : 'text-ink/60 hover:bg-ivory'}`}><Monitor size={14} aria-hidden="true" />{t('editor', 'desktopPreview')}</button></div></div>
          <div className={`mx-auto h-[min(78svh,860px)] min-h-[500px] overflow-hidden rounded-2xl border border-line bg-paper shadow-paper transition-[max-width] duration-300 ${previewMode === 'mobile' ? 'max-w-[390px]' : 'max-w-none'}`} data-preview-viewport={previewMode}>
            <GiftView templateId={template.id} templateVersion={template.version} content={content} locale={locale} mode="preview" mediaUrls={mediaUrls} />
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-ink/50">{previewMode === 'mobile' ? t('editor', 'mobilePreviewNote') : t('editor', 'desktopPreviewNote')}</p>
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
