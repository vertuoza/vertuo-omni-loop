-- Pitch runs (PRD 859 s3, docs: .omni-loop/delivery/inbox/0859-pitch/spec.md, "Push" and "The Pitch
-- tab"): /omni:pitch makes a shipped PRD's launch package on the person's computer, and
-- `omni pitch push` sends it to the PRD's dossier.
--
-- - The bucket `pitches`: private, 50 MB a file, PNG, MP4 and GIF only. An object's path is
--   `<dossier id>/<run id>/<name>`; the run's id is a random UUID the upload call mints.
-- - Its rules on storage.objects, keyed on the path's dossier: a member of the dossier's workspace
--   uploads into a run not yet registered of a shipped (or retro) PRD, and reads every run's files.
--   Nobody updates or deletes one (old pitches stay, in the Pitch tab's picker).
-- - The table `pitch_runs`: one row per pitch — its dossier, its audience (customers or inside), the
--   look it was drawn in, the commit it was made at, its words (hook, benefit, kicker, closing line) and
--   the names of its five files. Written only by pitch_run_add(), which checks the caller reads the
--   dossier, that the PRD is shipped or retro, and that every file named is in the run's folder. Read by
--   the members of the dossier's workspace; the service role reads a run's dossier and files for the
--   GIF's stable link, the one link that works without signing in.
--
-- Proven by supabase/checks/pitch.sql.
-- Rollback: a follow-up migration drops pitch_run_add(), the table, the helper functions and the two
-- policies, and, once emptied, the bucket. Nothing else reads them.

-- ── The bucket ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pitches', 'pitches', false, 52428800, array['image/png', 'video/mp4', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The five files every pitch run holds, by name.
create function public.pitch_files() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4', 'pitch.gif']
$$;

-- The dossier a pitch file's path names — `<dossier id>/<run id>/<name>`, the name one of the five — or
-- null for any other.
create function public.pitch_path_dossier(path text) returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
      and split_part(path, '/', 3) = any (public.pitch_files())
    then split_part(path, '/', 1)::uuid
  end
$$;

-- The run a pitch file's path names, or null for any other.
create function public.pitch_path_run(path text) returns uuid
language sql immutable
set search_path = ''
as $$
  select case when public.pitch_path_dossier(path) is not null then split_part(path, '/', 2)::uuid end
$$;

-- Whether dossier `p_dossier` is a PRD that reached shipped or retro, as its stored stages say. Read as
-- the caller: a dossier or a stage they may not read is not shipped for them.
create function public.pitch_dossier_shipped(p_dossier uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.dossiers d
      join public.prd_stages s
        on s.workspace_id = d.workspace_id and s.repository = d.home_repo and s.prd = d.prd
     where d.id = p_dossier and d.kind = 'prd' and s.stage in ('shipped', 'retro'))
$$;

-- ── The table ────────────────────────────────────────────────────────────────────

create table public.pitch_runs (
  id          uuid primary key,
  dossier_id  uuid not null references public.dossiers on delete cascade,
  audience    text not null check (audience in ('customers', 'inside')),
  look        text not null check (look in ('arcade', 'keynote')),
  commit_sha  text not null check (commit_sha ~ '^[0-9a-f]{7,64}$'),
  hook        text not null check (char_length(hook) between 1 and 200),
  benefit     text not null check (char_length(benefit) between 1 and 400),
  kicker      text not null check (char_length(kicker) between 1 and 100),
  closing     text not null check (char_length(closing) between 1 and 300),
  files       text[] not null check (files @> public.pitch_files() and files <@ public.pitch_files()),
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.pitch_runs is
  'One per pitch of a shipped PRD (/omni:pitch): its audience, look, commit, words, and the names of its five files in the pitches bucket under <dossier id>/<id>/. Written only by pitch_run_add(). Never edited.';
comment on column public.pitch_runs.id is 'The run''s id: a random UUID the upload call minted, its files'' folder.';
comment on column public.pitch_runs.audience is 'Who the pitch is for: customers or inside.';
comment on column public.pitch_runs.look is 'The look it was drawn in: arcade (Arcade poster) or keynote (Clean keynote).';
comment on column public.pitch_runs.files is 'The five files in the run''s folder: slide.png, slide-square.png, pitch.mp4, pitch-square.mp4 and pitch.gif (what the stable link /api/pitches/<id>/pitch.gif serves).';

create index pitch_runs_dossier_idx on public.pitch_runs (dossier_id, created_at desc);

alter table public.pitch_runs enable row level security;

create policy "a member reads the pitch runs of their workspace's dossiers" on public.pitch_runs
  for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id)));

-- ── Who may do what with a pitch file ────────────────────────────────────────────

-- The dossiers' own rule decides who reads the dossier: every member of its workspace. A run already
-- registered takes no more files, and a PRD not shipped takes none.
create policy "a member uploads the files of a new pitch run" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'pitches'
    and exists (select 1 from public.dossiers d where d.id = public.pitch_path_dossier(name))
    and public.pitch_dossier_shipped(public.pitch_path_dossier(name))
    and not exists (select 1 from public.pitch_runs r where r.id = public.pitch_path_run(name)));

create policy "a member reads the pitch files of their workspace's dossiers" on storage.objects
  for select to authenticated
  using (bucket_id = 'pitches'
    and exists (select 1 from public.dossiers d where d.id = public.pitch_path_dossier(name)));

-- No update or delete rule: nobody replaces or removes a pitch file.

-- ── The kit's call ───────────────────────────────────────────────────────────────

-- Registers run `p_run` of dossier `p_dossier`. Refused: 42501 signed out; P0002 a dossier the caller
-- cannot read; 55000 a PRD not shipped or retro; 22023 an audience, look, commit or word out of shape,
-- or a file named that is not one of the five or not in the run's folder; 23505 a run registered
-- already.
create function public.pitch_run_add(
  p_dossier  uuid,
  p_run      uuid,
  p_audience text,
  p_look     text,
  p_commit   text,
  p_hook     text,
  p_benefit  text,
  p_kicker   text,
  p_closing  text,
  p_files    text[]
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
  if not public.pitch_dossier_shipped(p_dossier) then
    raise exception 'This PRD is not shipped: a pitch is for shipped PRDs.' using errcode = '55000';
  end if;
  if p_run is null or p_audience is null or p_audience not in ('customers', 'inside') then
    raise exception 'A pitch is for customers or inside.' using errcode = '22023', hint = 'audience';
  end if;
  if p_look is null or p_look not in ('arcade', 'keynote') then
    raise exception 'Look: arcade or keynote.' using errcode = '22023', hint = 'look';
  end if;
  if p_files is null or not (p_files @> public.pitch_files() and p_files <@ public.pitch_files()) then
    raise exception 'A pitch names its five files: %.', array_to_string(public.pitch_files(), ', ')
      using errcode = '22023', hint = 'files';
  end if;
  foreach named in array p_files loop
    if not exists (
      select 1 from storage.objects o
       where o.bucket_id = 'pitches' and o.name = p_dossier::text || '/' || p_run::text || '/' || named) then
      raise exception '% was not uploaded to this run.', named using errcode = '22023', hint = 'files';
    end if;
  end loop;
  insert into public.pitch_runs (id, dossier_id, audience, look, commit_sha, hook, benefit, kicker, closing, files, created_by)
  values (p_run, p_dossier, p_audience, p_look, p_commit, p_hook, p_benefit, p_kicker, p_closing, p_files, caller);
  return p_run;
exception
  when check_violation or not_null_violation then
    raise exception 'A pitch''s commit is a hash, and its words are not empty and within their lengths.'
      using errcode = '22023', hint = 'words';
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more, whether or not the project grants new tables to the API roles by
-- default (config.toml › auto_expose_new_tables).
revoke all on public.pitch_runs from anon, authenticated, service_role;
grant select (id, dossier_id, audience, look, commit_sha, hook, benefit, kicker, closing, files, created_by, created_at)
  on public.pitch_runs to authenticated;
-- The GIF's stable link, as the service role: a run's dossier and files only.
grant select (id, dossier_id, files) on public.pitch_runs to service_role;

revoke execute on function public.pitch_run_add(uuid, uuid, text, text, text, text, text, text, text, text[]) from public, anon;
grant execute on function public.pitch_run_add(uuid, uuid, text, text, text, text, text, text, text, text[]) to authenticated;
revoke execute on function public.pitch_dossier_shipped(uuid) from public, anon;
grant execute on function public.pitch_dossier_shipped(uuid) to authenticated;
grant execute on function public.pitch_files() to anon, authenticated, service_role;
grant execute on function public.pitch_path_dossier(text) to anon, authenticated, service_role;
grant execute on function public.pitch_path_run(text) to anon, authenticated, service_role;
