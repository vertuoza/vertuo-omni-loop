-- Screenshots on an Other answer (PRD 620, docs: .omni-loop/delivery/inbox/0620-screenshot-answers/spec.md,
-- "Storage and data"): the ask page's Other option takes up to five screenshots, uploaded straight from
-- the browser into a private bucket, and the round records their paths next to its answer.
--
-- - The bucket `ask-attachments`: private, 5 MB a file, PNG, JPEG, GIF and WebP only. An object's path
--   is `<round id>/<n>.<ext>`, n from 1 to 5.
-- - Its rules on storage.objects, keyed on the path's round: whoever may answer the round while it is
--   open uploads (the session's owner, or a member it is shared with); whoever reads the round reads
--   its screenshots (every member of its workspace); the uploader deletes while the round is open, and
--   the session's owner deletes at any time (deleting the session removes its screenshots first). Nobody
--   updates an object.
-- - The column ask_rounds.attachments: question text → the paths of its screenshots, each under the
--   round's own folder (ask_attachments_valid). It is set only by the update that answers the round on
--   the page, and never changed after (the round's guard).
--
-- Rollback: a follow-up migration drops the four policies, the column (with its check and grant), the
-- functions below and, once emptied, the bucket; and puts ask_rounds_guard back as
-- 20260927090000_ask_context.sql wrote it. Nothing else reads them.

-- ── The bucket ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ask-attachments', 'ask-attachments', false, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The round a screenshot's path names — `<round id>/<n>.<ext>`, n from 1 to 5 — or null for any other.
create function public.ask_attachment_round(path text) returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[1-5]\.(png|jpg|jpeg|gif|webp)$'
    then split_part(path, '/', 1)::uuid
  end
$$;

-- True when the caller may answer `round` now: it is open, and the caller owns its session (and
-- belongs to a workspace) or it is shared with them — the same people the round's answer rules let
-- in. Reads past row-level security, and answers only about the caller.
create function public.ask_may_answer(round uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.ask_rounds r
      join public.ask_sessions s on s.id = r.session_id
     where r.id = round
       and r.status = 'open'
       and ((s.owner = (select auth.uid()) and public.has_workspace()) or public.ask_shared_with_me(r.id)))
$$;

-- True when the caller owns the session `round` belongs to. Reads past row-level security.
create function public.ask_owns_round(round uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.ask_rounds r
      join public.ask_sessions s on s.id = r.session_id
     where r.id = round
       and s.owner = (select auth.uid()))
$$;

-- ── Who may do what with a screenshot ────────────────────────────────────────────

create policy "a person who may answer a round uploads its screenshots" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ask-attachments' and public.ask_may_answer(public.ask_attachment_round(name)));

-- ask_rounds' own rule decides who reads the round: every member of its session's workspace.
create policy "a member reads the screenshots of their workspace's rounds" on storage.objects
  for select to authenticated
  using (bucket_id = 'ask-attachments' and exists (
    select 1 from public.ask_rounds r where r.id = public.ask_attachment_round(name)));

create policy "the uploader or the owner deletes a round's screenshots" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ask-attachments' and (
    (owner_id = (select auth.uid())::text and public.ask_may_answer(public.ask_attachment_round(name)))
    or public.ask_owns_round(public.ask_attachment_round(name))));

-- No update rule: nobody replaces a screenshot.

-- ── The column ───────────────────────────────────────────────────────────────────

-- Question text → one to five paths, each a screenshot of `round` itself.
create function public.ask_attachments_valid(round uuid, a jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(a) = 'object'
    and not exists (
      select 1 from jsonb_each(a) e
       where case
         when jsonb_typeof(e.value) <> 'array' then true
         when jsonb_array_length(e.value) not between 1 and 5 then true
         else exists (
           select 1 from jsonb_array_elements(e.value) p
            where case
              when jsonb_typeof(p) <> 'string' then true
              else public.ask_attachment_round(p #>> '{}') is distinct from round
            end)
       end)
$$;

alter table public.ask_rounds add column attachments jsonb;
alter table public.ask_rounds add constraint ask_attachments_valid
  check (attachments is null or public.ask_attachments_valid(id, attachments));

comment on column public.ask_rounds.attachments is
  'The screenshots an Other answer carries: question text → paths in the ask-attachments bucket, each under this round''s folder. Set with the answer on the page, never changed after.';

-- Written with the answer, by whoever answers on the page.
grant update (attachments) on public.ask_rounds to authenticated;

-- ── The guard ────────────────────────────────────────────────────────────────────

-- ask_rounds_guard, as 20260927090000_ask_context.sql wrote it, and one more rule: the screenshots are
-- final with the answer. They may be set only by the update that answers the round on the page, and
-- never changed after.
create or replace function public.ask_rounds_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    if new.answers is distinct from old.answers or new.answered_via is distinct from old.answered_via then
      raise exception 'This round is already %: its answer cannot change.', old.status using errcode = 'check_violation';
    end if;
    if new.attachments is distinct from old.attachments then
      raise exception 'This round is already %: its screenshots cannot change.', old.status using errcode = 'check_violation';
    end if;
  elsif not (
    old.status = 'open'
    or (old.status = 'abandoned' and new.status = 'answered' and new.answered_via = 'terminal')
  ) then
    raise exception 'An ask round cannot go from % to %.', old.status, new.status using errcode = 'check_violation';
  end if;
  if new.attachments is distinct from old.attachments
     and not (new.status = 'answered' and old.status <> 'answered' and new.answered_via = 'page') then
    raise exception 'Screenshots are recorded only with an answer given on the page.' using errcode = 'check_violation';
  end if;
  new.answered_at := case
    when new.status = 'answered' and old.status <> 'answered' then now()
    else old.answered_at
  end;
  new.answered_by := case
    when new.status = 'answered' and old.status <> 'answered' then
      case when new.answered_via = 'terminal'
        then (select s.owner from public.ask_sessions s where s.id = new.session_id)
        else auth.uid()
      end
    else old.answered_by
  end;
  return new;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────────

revoke execute on function public.ask_may_answer(uuid) from public, anon;
revoke execute on function public.ask_owns_round(uuid) from public, anon;
grant execute on function public.ask_may_answer(uuid) to authenticated;
grant execute on function public.ask_owns_round(uuid) to authenticated;
grant execute on function public.ask_attachment_round(text) to anon, authenticated, service_role;
grant execute on function public.ask_attachments_valid(uuid, jsonb) to anon, authenticated, service_role;
