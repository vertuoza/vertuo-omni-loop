-- A runner job's save (PRD 2809, s4, docs: .omni-loop/delivery/inbox/2809-unlosable-jobs/spec.md, section 3,
-- "Saving before anything is removed"): before a job's folder goes, its runner bundles the work origin does not hold
-- and sends it here, or says it kept it.
--
-- - The bucket `runner-checkpoints`: private, 100 MB an object, git bundles only (application/octet-stream). An
--   object's path is `<workspace id>/<job id>/<random id>.bundle`. No rule on storage.objects names it: nobody signed
--   in reads, lists, uploads or deletes a bundle. The app, as the service role, signs one upload link for the job's
--   own runner, and later one download link for the runner that resumes it (s5); the App's hourly job deletes a
--   chain's bundles (s6).
-- - The table `runner_checkpoints`: one row per job that saved, its runner, its kind (`portable` once its bundle is in
--   the bucket, at `storage_path`; `local` while it stays on its runner), its manifest (what the bundle holds, per
--   branch, never a file's content: CheckpointManifestSchema in kit/lib/runner/checkpoint.manifest.ts, read by the
--   app's contract), its bytes (the bundle's for a portable save, the folder's and the bundle's on the runner for a
--   local one), until when it is kept (`keep_until`, 7 days at most) and when its bundle was deleted (`deleted_at`).
--   A member of the workspace reads its rows, anyone else none.
-- - runner_checkpoint_record(): the one write, as the service role. The job must be held by the runner that records
--   it; a portable save's bundle must be in the bucket at a path of the job's own folder; the manifest must say the
--   same job and kind. A portable save replaces a local one of the same job (the sweep's later upload); a local one
--   never replaces a portable one. `keep_until` is never later than 7 days from now.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written (BR-PRODUCT-12,
-- 28, 29, 39, 59, 63, 64, N-PRODUCT-16). L-GDPR-1: only members read the rows, nobody signed in reads a bundle.
-- L-GDPR-2: a manifest holds no file and no credential (the contract refuses one). L-GDPR-4: 7 days at most, 100 MB.
--
-- Returned columns: runner_checkpoint_record() returns a runner_checkpoints row, which
-- apps/galaxy/src/runners/runners.repository.ts reads.
--
-- Proven by supabase/checks/runner_checkpoints.sql.
-- Rollback: a follow-up migration drops the function and the table, then, once emptied, the bucket. Nothing else
-- reads them; a runner on this kit then keeps every save local, as before.

-- ── The bucket ───────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('runner-checkpoints', 'runner-checkpoints', false, 104857600, array['application/octet-stream'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No policy on storage.objects for this bucket: only signed links reach a bundle.

-- ── The table ────────────────────────────────────────────────────────────────────

create table public.runner_checkpoints (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null unique references public.runner_jobs (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  runner_id     uuid references public.runners (id) on delete set null,
  kind          text not null check (kind in ('portable', 'local')),
  manifest      jsonb not null check (jsonb_typeof(manifest) = 'object' and octet_length(manifest::text) <= 65536),
  bytes         bigint not null check (bytes >= 0),
  storage_path  text check (storage_path is null or char_length(storage_path) <= 200),
  keep_until    timestamptz not null,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint runner_checkpoints_path check ((kind = 'portable') = (storage_path is not null)),
  constraint runner_checkpoints_portable_size check (kind = 'local' or bytes <= 104857600)
);

comment on table public.runner_checkpoints is
  'A runner job''s save (PRD 2809): portable once its git bundle is in the runner-checkpoints bucket at storage_path, local while its runner keeps it. The manifest says what it holds, never a file. Written only by runner_checkpoint_record().';
comment on column public.runner_checkpoints.bytes is
  'The bundle''s bytes for a portable save; for a local one, what it takes of its runner''s disk, folder and bundle together.';
comment on column public.runner_checkpoints.keep_until is
  'Until when the save is kept: its bundle deleted from the bucket, or its folder from its runner, by then at the latest (7 days).';

create index runner_checkpoints_workspace_idx on public.runner_checkpoints (workspace_id);
create index runner_checkpoints_kept_idx on public.runner_checkpoints (runner_id) where kind = 'local' and deleted_at is null;
create index runner_checkpoints_forget_idx on public.runner_checkpoints (keep_until) where kind = 'portable' and deleted_at is null;

alter table public.runner_checkpoints enable row level security;

-- The person's workspaces are read once per statement, never once per row (bug #1832).
create policy "a member reads their workspace's runner checkpoints" on public.runner_checkpoints
  for select to authenticated
  using (workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())));

-- ── The one write ────────────────────────────────────────────────────────────────

-- Records the save of job `p_job` by runner `p_runner`. Refused: P0002 no such job, or one another runner holds;
-- 22023 a kind that is neither, a manifest of another job or kind, a portable save whose bundle is not in the bucket
-- at a path of the job's own folder, or one over 100 MB; 55000 a local save of a job whose save is in the bucket.
create function public.runner_checkpoint_record(
  p_job        uuid,
  p_runner     uuid,
  p_kind       text,
  p_manifest   jsonb,
  p_bytes      bigint,
  p_path       text,
  p_keep_until timestamptz
) returns public.runner_checkpoints
language plpgsql
security definer
set search_path = ''
as $$
declare
  job   public.runner_jobs;
  saved public.runner_checkpoints;
  until timestamptz := least(p_keep_until, now() + interval '7 days');
begin
  select * into job from public.runner_jobs j where j.id = p_job;
  if job.id is null or job.runner_id is distinct from p_runner then
    raise exception 'No such job of this runner.' using errcode = 'P0002';
  end if;
  if p_kind is null or p_kind not in ('portable', 'local') then
    raise exception 'A save is portable or local.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' or p_manifest ->> 'job' is distinct from p_job::text or p_manifest ->> 'kind' is distinct from p_kind then
    raise exception 'The manifest names another job or kind.' using errcode = '22023';
  end if;
  if p_kind = 'portable' and (
       p_path is null
       or p_path !~ ('^' || job.workspace_id::text || '/' || job.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bundle$')
       or not exists (select 1 from storage.objects o where o.bucket_id = 'runner-checkpoints' and o.name = p_path)) then
    raise exception 'No bundle was uploaded at this path.' using errcode = '22023';
  end if;
  if p_kind = 'portable' and p_bytes > 104857600 then
    raise exception 'A bundle is 100 MB at most.' using errcode = '22023';
  end if;
  insert into public.runner_checkpoints as c (job_id, workspace_id, runner_id, kind, manifest, bytes, storage_path, keep_until)
  values (job.id, job.workspace_id, p_runner, p_kind, p_manifest, p_bytes, case when p_kind = 'portable' then p_path end, until)
  on conflict (job_id) do update
    set kind = excluded.kind, manifest = excluded.manifest, bytes = excluded.bytes, storage_path = excluded.storage_path,
        keep_until = excluded.keep_until, runner_id = excluded.runner_id, updated_at = now()
    where c.kind = 'local' and c.deleted_at is null
  returning * into saved;
  if saved.id is null then
    raise exception 'This job''s save is already in the bucket.' using errcode = '55000';
  end if;
  return saved;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody writes the table but the
-- function, which only the service role calls.
revoke all on public.runner_checkpoints from public, anon, authenticated, service_role;
grant select on public.runner_checkpoints to authenticated, service_role;
revoke execute on function public.runner_checkpoint_record(uuid, uuid, text, jsonb, bigint, text, timestamptz) from public, anon, authenticated;
grant execute on function public.runner_checkpoint_record(uuid, uuid, text, jsonb, bigint, text, timestamptz) to service_role;
