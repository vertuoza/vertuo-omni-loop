-- Who may upload, register and read a PRD's pitches (PRD 859 s3). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/pitch.sql
-- A member of the dossier's workspace uploads a run's five files into the private `pitches` bucket and
-- registers it through pitch_run_add(), for a PRD that reached shipped or retro. Refused: a PRD at any
-- earlier stage (55000), in the bucket and in the call; a file named that is not in the run's folder,
-- an audience other than customers or inside, and a look other than arcade or keynote (22023); a run
-- registered twice (23505); a member of another workspace and an account in no workspace (P0002), and
-- anyone signed out (42501). A member reads the runs and their files; anyone else reads none, and nobody
-- signed in writes pitch_runs directly. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Ada is a member of Vertuoza; Carl owns Acme; Eve belongs to no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000859a3', 'ada@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000859c3', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000859e3', 'eve@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-pitch', 'Acme', 'acme-pitch');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000859a3'::uuid, 'member'),
         ('acme-pitch', '00000000-0000-4000-8000-0000000859c3'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug
on conflict (workspace_id, user_id) do nothing;

-- Four PRD dossiers of Vertuoza: 7 shipped, 8 at retro, 9 still building, 10 a visual fix's number.
insert into public.dossiers (id, workspace_id, home_repo, kind, prd, title, numbered_at)
select d.id, w.id, 'vertuoza/vertuo-omni-loop', d.kind, d.prd, d.title, now()
  from (values
         ('00000000-0000-4000-8000-000000859d07'::uuid, 'prd',    7,  'A shipped PRD'),
         ('00000000-0000-4000-8000-000000859d08'::uuid, 'prd',    8,  'A PRD at retro'),
         ('00000000-0000-4000-8000-000000859d09'::uuid, 'prd',    9,  'A PRD being built'),
         ('00000000-0000-4000-8000-000000859d10'::uuid, 'visual', 10, 'A visual fix')
       ) as d (id, kind, prd, title)
  cross join public.workspaces w where w.slug = 'vertuoza';
insert into public.prd_stages (workspace_id, repository, prd, stage, reached_at)
select w.id, 'vertuoza/vertuo-omni-loop', s.prd, s.stage, now()
  from (values (7, 'building'), (7, 'outbox'), (7, 'shipped'), (8, 'shipped'), (8, 'retro'), (9, 'inbox'), (9, 'building'), (10, 'shipped')) as s (prd, stage)
  cross join public.workspaces w where w.slug = 'vertuoza';

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- The run ids each check uploads into.
create function pg_temp.run(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-0000008591' || lpad(n::text, 2, '0'))::uuid;
$$;
create function pg_temp.dossier(prd int) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-000000859d' || lpad(prd::text, 2, '0'))::uuid;
$$;
-- Uploads the five files of run `run` into dossier `prd`'s folder, as the signed-in caller, or `only`.
create function pg_temp.upload(prd int, run int, names text[] default null) returns void language plpgsql as $$
declare
  name text;
begin
  foreach name in array coalesce(names, public.pitch_files()) loop
    insert into storage.objects (bucket_id, name) values ('pitches', pg_temp.dossier(prd)::text || '/' || pg_temp.run(run)::text || '/' || name);
  end loop;
end;
$$;
-- Registers run `run` of dossier `prd` as the signed-in caller.
create function pg_temp.add(prd int, run int, audience text default 'customers', look text default 'arcade', files text[] default null) returns uuid language sql as $$
  select public.pitch_run_add(pg_temp.dossier(prd), pg_temp.run(run), audience, look, 'abc1234',
    'Answer from your phone', 'Every question waits on one page you open anywhere.', 'NEW IN OMNI LOOP',
    'Omni Loop · https://omni.test', coalesce(files, public.pitch_files()));
$$;
-- Runs `stmt`, which must be refused with `state`, as `who`.
create function pg_temp.refused(stmt text, state text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when others then
  if sqlstate <> state then
    raise exception 'FAIL: % for % was % (%), not %', stmt, who, sqlstate, sqlerrm, state;
  end if;
end;
$$;

-- ── Ada, a member, uploads and registers a pitch of the shipped PRD, and one of the PRD at retro ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000859a3');
do $$
begin
  perform pg_temp.upload(7, 1);
  if pg_temp.add(7, 1) <> pg_temp.run(1) then raise exception 'FAIL: pitch_run_add answered another id'; end if;
  perform pg_temp.upload(8, 2);
  perform pg_temp.add(8, 2, 'inside', 'keynote');
  if (select count(*) from public.pitch_runs) <> 2 then raise exception 'FAIL: Ada does not read her two pitches'; end if;
  if (select r.audience || '/' || r.look from public.pitch_runs r where r.id = pg_temp.run(2)) <> 'inside/keynote' then
    raise exception 'FAIL: the retro PRD''s pitch was not stored as sent';
  end if;
  if (select count(*) from storage.objects o where o.bucket_id = 'pitches') <> 10 then
    raise exception 'FAIL: Ada does not read the ten pitch files';
  end if;
  -- A second pitch for the same audience is a new run: both stay.
  perform pg_temp.upload(7, 3);
  perform pg_temp.add(7, 3);
  if (select count(*) from public.pitch_runs r where r.dossier_id = pg_temp.dossier(7) and r.audience = 'customers') <> 2 then
    raise exception 'FAIL: a second customers pitch replaced the first';
  end if;
end $$;

-- ── Refused: a PRD not shipped, in the bucket and in the call; a fix; a run twice; a file not uploaded;
-- an audience, look or word out of shape; a direct write ──
do $$
begin
  -- The bucket takes no file for a PRD still being built, nor for a fix.
  perform pg_temp.refused('select pg_temp.upload(9, 4)', '42501', 'a PRD being built, in the bucket');
  perform pg_temp.refused('select pg_temp.upload(10, 4)', '42501', 'a visual fix, in the bucket');
  -- The call refuses it too, files or not.
  perform pg_temp.refused('select pg_temp.add(9, 4)', '55000', 'a PRD being built');
  perform pg_temp.refused('select pg_temp.add(10, 4)', '55000', 'a visual fix');
  -- A registered run takes no more files, and is not registered twice.
  perform pg_temp.refused('select pg_temp.upload(7, 1, array[''pitch.gif''])', '42501', 'a registered run, in the bucket');
  perform pg_temp.refused('select pg_temp.add(7, 1)', '23505', 'a run registered already');
  -- A file not in the run's folder: one missing, one of another run, a name outside the five.
  perform pg_temp.upload(7, 5, array['slide.png', 'slide-square.png', 'pitch.mp4', 'pitch-square.mp4']);
  perform pg_temp.refused('select pg_temp.add(7, 5)', '22023', 'a file not uploaded');
  perform pg_temp.refused('select pg_temp.add(7, 5, ''customers'', ''arcade'', array[''slide.png'', ''slide-square.png'', ''pitch.mp4'', ''pitch-square.mp4'', ''../x/pitch.gif''])', '22023', 'a file outside the folder');
  perform pg_temp.refused('select pg_temp.upload(7, 5, array[''notes.txt''])', '42501', 'a name outside the five, in the bucket');
  perform pg_temp.upload(7, 5, array['pitch.gif']);
  -- An audience other than customers or inside, a look other than arcade or keynote.
  perform pg_temp.refused('select pg_temp.add(7, 5, ''everyone'')', '22023', 'another audience');
  perform pg_temp.refused('select pg_temp.add(7, 5, null)', '22023', 'no audience');
  perform pg_temp.refused('select pg_temp.add(7, 5, ''inside'', ''custom'')', '22023', 'another look');
  perform pg_temp.refused(format('select public.pitch_run_add(%L, %L, ''inside'', ''arcade'', ''not-a-hash'', ''h'', ''b'', ''k'', ''c'', public.pitch_files())',
    pg_temp.dossier(7), pg_temp.run(5)), '22023', 'a commit that is not a hash');
  perform pg_temp.refused(format('select public.pitch_run_add(%L, %L, ''inside'', ''arcade'', ''abc1234'', '''', ''b'', ''k'', ''c'', public.pitch_files())',
    pg_temp.dossier(7), pg_temp.run(5)), '22023', 'an empty hook');
  -- Now whole, it registers.
  perform pg_temp.add(7, 5, 'inside');
  -- Nobody signed in writes the table directly.
  perform pg_temp.refused(format('insert into public.pitch_runs (id, dossier_id, audience, look, commit_sha, hook, benefit, kicker, closing, files) values (gen_random_uuid(), %L, ''inside'', ''arcade'', ''abc1234'', ''h'', ''b'', ''k'', ''c'', public.pitch_files())', pg_temp.dossier(7)), '42501', 'a member, directly');
  perform pg_temp.refused(format('update public.pitch_runs set hook = ''x'' where id = %L', pg_temp.run(1)), '42501', 'a member, directly');
end $$;

-- ── Outsiders: a member of another workspace and a stranger read nothing and register nothing ──
do $$
declare
  who text;
begin
  foreach who in array array['00000000-0000-4000-8000-0000000859c3', '00000000-0000-4000-8000-0000000859e3'] loop
    perform pg_temp.sign_in(who);
    if (select count(*) from public.pitch_runs) <> 0 then raise exception 'FAIL: % reads a pitch run', who; end if;
    if (select count(*) from storage.objects o where o.bucket_id = 'pitches') <> 0 then raise exception 'FAIL: % reads a pitch file', who; end if;
    perform pg_temp.refused('select pg_temp.upload(7, 6)', '42501', who || ', in the bucket');
    perform pg_temp.refused('select pg_temp.add(7, 1)', 'P0002', who);
  end loop;
end $$;
reset role;

-- ── Signed out: nothing runs, nothing reads ──
set local role anon;
do $$
begin
  perform pg_temp.refused('select pg_temp.add(7, 1)', '42501', 'anon');
  perform pg_temp.refused('select count(*) from public.pitch_runs', '42501', 'anon');
end $$;
reset role;

-- ── The GIF's stable link, as the service role: a run's dossier and files, nothing more ──
set local role service_role;
do $$
begin
  if (select r.dossier_id from public.pitch_runs r where r.id = pg_temp.run(1)) <> pg_temp.dossier(7) then
    raise exception 'FAIL: the service role does not read a run''s dossier';
  end if;
  perform pg_temp.refused('select hook from public.pitch_runs', '42501', 'the service role, reading the words');
end $$;
reset role;

rollback;

\echo 'pitch: every check passed'
