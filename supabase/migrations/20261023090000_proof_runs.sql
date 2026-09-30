-- Proof video (PRD 798, docs: .omni-loop/delivery/inbox/0798-proof-video/spec.md, "The Omni page"):
-- /omni:prove records a PRD's acceptance criteria against its ready feature PR's preview, one clip per
-- criterion, and `omni proof push` sends the run to the PRD's dossier.
--
-- - The bucket `proof-videos`: private, 50 MB a file, WebM, GIF and plain text (the scripts) only. An
--   object's path is `<dossier id>/<run id>/<name>`; the run's id is a random UUID the upload call mints.
-- - Its rules on storage.objects, keyed on the path's dossier: a member of the dossier's workspace
--   uploads into a run not yet registered, and reads every run's files. Nobody updates or deletes one
--   (old runs stay, like spec versions).
-- - The table `proof_runs`: one row per run — its dossier, the commit and URL it proved, its criteria
--   (text, verdict, note, the names of its clip and script) and its GIF's name. Written only by
--   proof_run_add(), which checks the caller reads the dossier and every file named is in the run's
--   folder. Read by the members of the dossier's workspace; the service role reads it for the GIF's
--   stable link, the one link that works without signing in.
--
-- Rollback: a follow-up migration drops the function, the table, the three helper functions and the two
-- policies, and, once emptied, the bucket. Nothing else reads them.

-- ── The bucket ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof-videos', 'proof-videos', false, 52428800, array['video/webm', 'image/gif', 'text/plain'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A proof file's name inside its run's folder: a plain file name of at most 128 characters.
create function public.proof_file_name_valid(name text) returns boolean
language sql immutable
set search_path = ''
as $$
  select name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
$$;

-- The dossier a proof file's path names — `<dossier id>/<run id>/<name>` — or null for any other.
create function public.proof_path_dossier(path text) returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
    then split_part(path, '/', 1)::uuid
  end
$$;

-- The run a proof file's path names, or null for any other.
create function public.proof_path_run(path text) returns uuid
language sql immutable
set search_path = ''
as $$
  select case when public.proof_path_dossier(path) is not null then split_part(path, '/', 2)::uuid end
$$;

-- ── The table ────────────────────────────────────────────────────────────────────

-- A run's criteria: one to ten objects, each {text, verdict, note?, video?, script?}, the verdict pass,
-- fail or unfilmable, the text 1 to 2000 characters, the note at most 1000, each file a plain name.
create function public.proof_criteria_valid(c jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(c) = 'array'
    and jsonb_array_length(c) between 1 and 10
    and not exists (
      select 1 from jsonb_array_elements(c) e
       where case
         when jsonb_typeof(e) <> 'object' then true
         when jsonb_typeof(e -> 'text') is distinct from 'string' then true
         when char_length(e ->> 'text') not between 1 and 2000 then true
         when (e ->> 'verdict') is null or (e ->> 'verdict') not in ('pass', 'fail', 'unfilmable') then true
         when e ? 'note' and (jsonb_typeof(e -> 'note') <> 'string' or char_length(e ->> 'note') > 1000) then true
         when e ? 'video' and (jsonb_typeof(e -> 'video') <> 'string' or not public.proof_file_name_valid(e ->> 'video')) then true
         when e ? 'script' and (jsonb_typeof(e -> 'script') <> 'string' or not public.proof_file_name_valid(e ->> 'script')) then true
         when exists (select 1 from jsonb_object_keys(e) k where k not in ('text', 'verdict', 'note', 'video', 'script')) then true
         else false
       end)
$$;

create table public.proof_runs (
  id          uuid primary key,
  dossier_id  uuid not null references public.dossiers on delete cascade,
  commit_sha  text not null check (commit_sha ~ '^[0-9a-f]{7,64}$'),
  url         text not null check (url ~ '^https?://' and char_length(url) <= 2000),
  criteria    jsonb not null check (public.proof_criteria_valid(criteria)),
  gif         text check (gif is null or public.proof_file_name_valid(gif)),
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.proof_runs is
  'One per proof run of a PRD (/omni:prove): the commit and URL it proved, one verdict per acceptance criterion, and the names of its files in the proof-videos bucket under <dossier id>/<id>/. Written only by proof_run_add(). Never edited.';
comment on column public.proof_runs.id is 'The run''s id: a random UUID the upload call minted, its files'' folder.';
comment on column public.proof_runs.gif is 'The GIF excerpt''s name in the run''s folder, or null: what the stable link /api/proofs/<id>/preview.gif serves.';

create index proof_runs_dossier_idx on public.proof_runs (dossier_id, created_at desc);

alter table public.proof_runs enable row level security;

create policy "a member reads the proof runs of their workspace's dossiers" on public.proof_runs
  for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id)));

-- ── Who may do what with a proof file ────────────────────────────────────────────

-- The dossiers' own rule decides who reads the dossier: every member of its workspace. A run already
-- registered takes no more files.
create policy "a member uploads the files of a new proof run" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proof-videos'
    and exists (select 1 from public.dossiers d where d.id = public.proof_path_dossier(name))
    and not exists (select 1 from public.proof_runs r where r.id = public.proof_path_run(name)));

create policy "a member reads the proof files of their workspace's dossiers" on storage.objects
  for select to authenticated
  using (bucket_id = 'proof-videos'
    and exists (select 1 from public.dossiers d where d.id = public.proof_path_dossier(name)));

-- No update or delete rule: nobody replaces or removes a proof file.

-- ── The kit's call ───────────────────────────────────────────────────────────────

-- Registers run `p_run` of dossier `p_dossier`. Refused: 42501 signed out; P0002 a dossier the caller
-- cannot read; 22023 malformed criteria, or a file named (a clip, a script or the GIF) that is not in
-- the run's folder; 23505 a run registered already.
create function public.proof_run_add(
  p_dossier  uuid,
  p_run      uuid,
  p_commit   text,
  p_url      text,
  p_criteria jsonb,
  p_gif      text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  named  text;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  perform 1 from public.dossiers d where d.id = p_dossier and public.is_member(d.workspace_id);
  if not found then
    raise exception 'No such dossier.' using errcode = 'P0002';
  end if;
  if p_run is null or not public.proof_criteria_valid(coalesce(p_criteria, 'null'::jsonb)) then
    raise exception 'A run is 1 to 10 criteria, each {text, verdict, note?, video?, script?}, its verdict pass, fail or unfilmable.'
      using errcode = '22023';
  end if;
  for named in
    select n from (
      select e ->> 'video' as n from jsonb_array_elements(p_criteria) e
      union select e ->> 'script' from jsonb_array_elements(p_criteria) e
      union select p_gif) files
     where n is not null
  loop
    if not public.proof_file_name_valid(named) or not exists (
      select 1 from storage.objects o
       where o.bucket_id = 'proof-videos' and o.name = p_dossier::text || '/' || p_run::text || '/' || named) then
      raise exception '% was not uploaded to this run.', named using errcode = '22023';
    end if;
  end loop;
  insert into public.proof_runs (id, dossier_id, commit_sha, url, criteria, gif, created_by)
  values (p_run, p_dossier, p_commit, p_url, p_criteria, p_gif, caller);
  return p_run;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more, whether or not the project grants new tables to the API roles by
-- default (config.toml › auto_expose_new_tables).
revoke all on public.proof_runs from anon, authenticated, service_role;
grant select (id, dossier_id, commit_sha, url, criteria, gif, created_by, created_at) on public.proof_runs to authenticated;
-- The GIF's stable link, as the service role: a run's dossier and GIF only.
grant select (id, dossier_id, gif) on public.proof_runs to service_role;

revoke execute on function public.proof_run_add(uuid, uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.proof_run_add(uuid, uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.proof_file_name_valid(text) to anon, authenticated, service_role;
grant execute on function public.proof_path_dossier(text) to anon, authenticated, service_role;
grant execute on function public.proof_path_run(text) to anon, authenticated, service_role;
grant execute on function public.proof_criteria_valid(jsonb) to anon, authenticated, service_role;
