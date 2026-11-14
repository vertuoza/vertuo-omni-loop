-- A runner job's save (PRD 2809, s4), run after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/runner_checkpoints.sql
-- The bucket runner-checkpoints is private and takes 100 MB an object, git bundles only. As the service role,
-- runner_checkpoint_record() records a job's save for the runner that holds the job: local with its size and
-- keep_until (never past 7 days), then portable once its bundle is in the bucket at a path of the job's own folder,
-- replacing the local one; a local one never replaces a portable one. It refuses another runner, a bundle not
-- uploaded, a path of another job, a manifest of another job or kind, and a bundle over 100 MB. A member reads the
-- rows of their workspace, a non-member and anyone signed out nothing; nobody signed in writes a row, calls the
-- function, or reads, lists or uploads a bundle. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Saves, Mo is a member of it; Eve owns another one.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000028094a1', 'olga@saves.test'),
  ('00000000-0000-4000-8000-0000028094b1', 'mo@saves.test'),
  ('00000000-0000-4000-8000-0000028094e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002809401', 'saves-check', 'Saves', 'saves-check'),
  ('00000000-0000-4000-8000-000002809402', 'saves-elsewhere', 'Elsewhere', 'saves-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002809401', '00000000-0000-4000-8000-0000028094a1', 'owner'),
  ('00000000-0000-4000-8000-000002809401', '00000000-0000-4000-8000-0000028094b1', 'member'),
  ('00000000-0000-4000-8000-000002809402', '00000000-0000-4000-8000-0000028094e1', 'owner');

-- box-1 and box-3 of Saves, on saves-check/app.
insert into public.runners (id, workspace_id, owner, name, slots, repos, github_app) values
  ('00000000-0000-4000-8000-0000028095a1', '00000000-0000-4000-8000-000002809401', '00000000-0000-4000-8000-0000028094a1', 'box-1', 4, '{saves-check/app}', true),
  ('00000000-0000-4000-8000-0000028095a3', '00000000-0000-4000-8000-000002809401', '00000000-0000-4000-8000-0000028094a1', 'box-3', 4, '{saves-check/app}', true);

-- J1 ran on box-1 and was lost; J2 ran on box-3.
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, status, runner_id, reason, claimed_at, running_at, ended_at) values
  ('00000000-0000-4000-8000-0000028096a1', '00000000-0000-4000-8000-000002809401', '/omni:yolo 2803', 'saves-check/app', '00000000-0000-4000-8000-0000028094b1', 'failed', '00000000-0000-4000-8000-0000028095a1', 'runner lost', now() - interval '9 minutes', now() - interval '8 minutes', now()),
  ('00000000-0000-4000-8000-0000028096a2', '00000000-0000-4000-8000-000002809401', '/omni:yolo 2804', 'saves-check/app', '00000000-0000-4000-8000-0000028094b1', 'running', '00000000-0000-4000-8000-0000028095a3', null, now() - interval '9 minutes', now() - interval '8 minutes', null);

create function pg_temp.manifest(job text, kind text) returns jsonb language sql as $$
  select jsonb_build_object('job', job, 'runner', 'box-1', 'repo', 'saves-check/app', 'kind', kind, 'savedAt', now()::text, 'keepUntil', (now() + interval '7 days')::text,
    'bundleBytes', 2048, 'bytes', 1048576, 'handoff', null, 'failed', null,
    'branches', jsonb_build_array(jsonb_build_object('branch', 'feat/x--s3', 'ref', 'refs/heads/omni-checkpoint/feat/x--s3', 'path', '.', 'base', null, 'head', repeat('a', 40), 'files', 3, 'commits', 1)));
$$;

-- ── The bucket ──
do $$
declare
  b storage.buckets;
begin
  select * into b from storage.buckets where id = 'runner-checkpoints';
  if b.id is null or b.public or b.file_size_limit <> 104857600 or b.allowed_mime_types <> array['application/octet-stream'] then
    raise exception 'FAIL: the bucket runner-checkpoints is %/public %/% bytes/%: not private, 100 MB, bundles only', b.id, b.public, b.file_size_limit, b.allowed_mime_types;
  end if;
  if exists (select 1 from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects' and (p.qual like '%runner-checkpoints%' or p.with_check like '%runner-checkpoints%')) then
    raise exception 'FAIL: a rule on storage.objects names runner-checkpoints: only signed links reach a bundle';
  end if;
end $$;

-- A bundle J1's runner uploaded through its link, and one at a path of another folder.
insert into storage.objects (bucket_id, name) values
  ('runner-checkpoints', '00000000-0000-4000-8000-000002809401/00000000-0000-4000-8000-0000028096a1/00000000-0000-4000-8000-0000028097b1.bundle'),
  ('runner-checkpoints', '00000000-0000-4000-8000-000002809401/00000000-0000-4000-8000-0000028096a2/00000000-0000-4000-8000-0000028097b2.bundle');

set local role service_role;

-- ── Recorded local, then portable ──
do $$
declare
  j1     constant uuid := '00000000-0000-4000-8000-0000028096a1';
  box1   constant uuid := '00000000-0000-4000-8000-0000028095a1';
  bundle constant text := '00000000-0000-4000-8000-000002809401/00000000-0000-4000-8000-0000028096a1/00000000-0000-4000-8000-0000028097b1.bundle';
  saved  public.runner_checkpoints;
begin
  -- The upload failed: the save stays on box-1, with its size; a keep_until past 7 days is cut to 7.
  saved := public.runner_checkpoint_record(j1, box1, 'local', pg_temp.manifest(j1::text, 'local'), 1048576, null, now() + interval '30 days');
  if saved.kind <> 'local' or saved.runner_id <> box1 or saved.bytes <> 1048576 or saved.storage_path is not null
     or saved.keep_until <> now() + interval '7 days' or saved.workspace_id <> '00000000-0000-4000-8000-000002809401' then
    raise exception 'FAIL: the local save reads %/% on %, % bytes, until %: not local on box-1 for 7 days at most', saved.kind, saved.storage_path, saved.runner_id, saved.bytes, saved.keep_until - now();
  end if;

  -- The sweep's later upload: the same job's save, now portable, replaces it.
  saved := public.runner_checkpoint_record(j1, box1, 'portable', pg_temp.manifest(j1::text, 'portable'), 2048, bundle, now() + interval '7 days');
  if saved.kind <> 'portable' or saved.storage_path <> bundle or saved.bytes <> 2048 or (select count(*) from public.runner_checkpoints where job_id = j1) <> 1 then
    raise exception 'FAIL: the portable save reads %/% %, not one portable row at its bundle', saved.kind, saved.storage_path, saved.bytes;
  end if;

  -- A local save never replaces a portable one.
  begin
    perform public.runner_checkpoint_record(j1, box1, 'local', pg_temp.manifest(j1::text, 'local'), 1048576, null, now() + interval '7 days');
    raise exception 'FAIL: a local save replaced the portable one';
  exception when sqlstate '55000' then null; end;
end $$;

-- ── What it refuses ──
do $$
declare
  j1    constant uuid := '00000000-0000-4000-8000-0000028096a1';
  j2    constant uuid := '00000000-0000-4000-8000-0000028096a2';
  box1  constant uuid := '00000000-0000-4000-8000-0000028095a1';
  box3  constant uuid := '00000000-0000-4000-8000-0000028095a3';
  ws    constant text := '00000000-0000-4000-8000-000002809401';
begin
  -- Another runner than the one that holds the job, and a job that does not exist.
  begin
    perform public.runner_checkpoint_record(j2, box1, 'local', pg_temp.manifest(j2::text, 'local'), 10, null, now());
    raise exception 'FAIL: box-1 recorded the save of a job box-3 holds';
  exception when sqlstate 'P0002' then null; end;
  begin
    perform public.runner_checkpoint_record('00000000-0000-4000-8000-0000028096ff', box1, 'local', pg_temp.manifest('00000000-0000-4000-8000-0000028096ff', 'local'), 10, null, now());
    raise exception 'FAIL: a save of no job was recorded';
  exception when sqlstate 'P0002' then null; end;
  -- A bundle never uploaded, and one of another job's folder.
  begin
    perform public.runner_checkpoint_record(j2, box3, 'portable', pg_temp.manifest(j2::text, 'portable'), 10, ws || '/' || j2::text || '/00000000-0000-4000-8000-0000028097ff.bundle', now());
    raise exception 'FAIL: a portable save of no bundle was recorded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.runner_checkpoint_record(j2, box3, 'portable', pg_temp.manifest(j2::text, 'portable'), 10, ws || '/' || j1::text || '/00000000-0000-4000-8000-0000028097b1.bundle', now());
    raise exception 'FAIL: a job recorded another job''s bundle';
  exception when sqlstate '22023' then null; end;
  -- A manifest of another job, or of another kind; an unknown kind; a bundle over 100 MB.
  begin
    perform public.runner_checkpoint_record(j2, box3, 'local', pg_temp.manifest(j1::text, 'local'), 10, null, now());
    raise exception 'FAIL: a manifest of another job was recorded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.runner_checkpoint_record(j2, box3, 'local', pg_temp.manifest(j2::text, 'portable'), 10, null, now());
    raise exception 'FAIL: a manifest of another kind was recorded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.runner_checkpoint_record(j2, box3, 'remote', pg_temp.manifest(j2::text, 'remote'), 10, null, now());
    raise exception 'FAIL: a save neither portable nor local was recorded';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.runner_checkpoint_record(j2, box3, 'portable', pg_temp.manifest(j2::text, 'portable'), 104857601,
      ws || '/' || j2::text || '/00000000-0000-4000-8000-0000028097b2.bundle', now());
    raise exception 'FAIL: a bundle over 100 MB was recorded';
  exception when sqlstate '22023' then null; end;
  -- The service role writes the table through the function alone.
  begin
    insert into public.runner_checkpoints (job_id, workspace_id, kind, manifest, bytes, keep_until) values (j2, ws::uuid, 'local', '{}', 1, now());
    raise exception 'FAIL: the service role wrote a save by hand';
  exception when insufficient_privilege then null; end;
  perform public.runner_checkpoint_record(j2, box3, 'local', pg_temp.manifest(j2::text, 'local'), 4096, null, now() + interval '7 days');
end $$;

reset role;

-- ── Who reads ──
create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000028094b1');
do $$
begin
  if (select count(*) from public.runner_checkpoints) <> 2 then
    raise exception 'FAIL: a member read % of their workspace''s two saves', (select count(*) from public.runner_checkpoints);
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'runner-checkpoints') then
    raise exception 'FAIL: a member read a bundle without a signed link';
  end if;
  begin
    insert into storage.objects (bucket_id, name) values ('runner-checkpoints', '00000000-0000-4000-8000-000002809401/00000000-0000-4000-8000-0000028096a2/00000000-0000-4000-8000-0000028097c1.bundle');
    raise exception 'FAIL: a member uploaded a bundle without a signed link';
  exception when insufficient_privilege then null; end;
  begin
    update public.runner_checkpoints set keep_until = now() + interval '1 year';
    raise exception 'FAIL: a member changed a save';
  exception when insufficient_privilege then null; end;
  begin
    perform public.runner_checkpoint_record('00000000-0000-4000-8000-0000028096a2', '00000000-0000-4000-8000-0000028095a3', 'local',
      pg_temp.manifest('00000000-0000-4000-8000-0000028096a2', 'local'), 1, null, now());
    raise exception 'FAIL: a member recorded a save';
  exception when insufficient_privilege then null; end;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000028094e1');
do $$
begin
  if exists (select 1 from public.runner_checkpoints) then
    raise exception 'FAIL: a non-member read another workspace''s saves';
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'runner-checkpoints') then
    raise exception 'FAIL: a non-member read a bundle';
  end if;
end $$;
reset role;

set local role anon;
do $$
begin
  if exists (select 1 from public.runner_checkpoints) then
    raise exception 'FAIL: someone signed out read the saves';
  end if;
exception when insufficient_privilege then null;
end $$;
reset role;

rollback;

select 'runner_checkpoints: every check passed' as result;
