-- Published garden gifts previously copied the owner PIN and private note into the
-- anon-readable public_gifts.content snapshot. Their complete immutable revision is
-- retained in gift_revisions for server-side verification; public presentation no
-- longer needs these three fields. Apply this migration before deploying the unlock flow.
update public.public_gifts
set content = jsonb_set(
  content,
  '{fields}',
  (coalesce(content->'fields', '{}'::jsonb) - 'pinCode' - 'closingLine' - 'signature'),
  true
),
updated_at = now()
where template_id = 'interactive-flower-adventure'
  and jsonb_typeof(content->'fields') = 'object'
  and (content->'fields') ?| array['pinCode', 'closingLine', 'signature'];
