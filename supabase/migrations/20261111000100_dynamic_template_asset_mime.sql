-- Additive MIME allowlist for media assets inside analyzed dynamic-template ZIPs.
-- Keep this bucket private; only the server uses service-role Storage access.
update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime order by mime)
  from unnest(coalesce(allowed_mime_types, array[]::text[]) || array[
    'image/gif', 'image/avif', 'image/x-icon',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
    'video/mp4', 'video/webm'
  ]) as mime
)
where id = 'dynamic-templates';
