-- Who may read and write a PRD's main watch, its breaks and the rewind's findings, and who decides a
-- finding (PRD 2410). The supabase workflow runs it on every pull request, after `supabase db start` has
-- applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/main_watch.sql
-- The service role opens a watch per lane, sets its status, adds breaks (a replayed source adds nothing)
-- and proposes findings (one with no evidence link, an unknown check or origin, or the same check, origin
-- and evidence again is refused); it never decides one, nor deletes anything. The App queues
-- `/omni:rewind <n>` as it queues `/omni:retro-apply`. A member reads their own workspace's rows only;
-- a member of another workspace, an account in no workspace and anyone signed out read nothing, and
-- nobody signed in writes a table. A member approves or rejects a proposed finding once, through its
-- function, which records who and when and appends its event; a second decision, a non-member and a
-- bad reason are refused. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000024a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000024c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000024e1', 'eve@example.com');
-- A second workspace, Acme. Ada belongs to Initech, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('initech', '00000000-0000-4000-8000-0000000024a1'::uuid),
         ('acme',    '00000000-0000-4000-8000-0000000024c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

-- The two workspaces' ids, for every role below to name, whatever it may read.
select set_config('main_watch.initech', (select id::text from public.workspaces where slug = 'initech'), true),
       set_config('main_watch.acme', (select id::text from public.workspaces where slug = 'acme'), true);

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- ── The service role: watches, breaks, findings and the rewind's job ──
set local role service_role;
do $$
declare
  initech uuid := current_setting('main_watch.initech')::uuid;
  acme    uuid := current_setting('main_watch.acme')::uuid;
  sha     text := repeat('4f2a91c0', 5);
begin
  -- PRD 7 of the plan repository merged into two lanes; Acme's PRD 3 into its own repository.
  insert into public.prd_main_watch (workspace_id, repository, prd, lane, merge_sha, merged_at, watch_until) values
    (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain',    sha, '2026-09-01T09:00:00Z', '2026-09-08T09:00:00Z'),
    (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-workflow', sha, '2026-09-01T09:00:00Z', '2026-09-08T09:00:00Z'),
    (acme,    'acme/widgets',        3, 'acme/widgets',            sha, '2026-09-02T09:00:00Z', '2026-09-09T09:00:00Z');
  if (select count(*) from public.prd_main_watch where status = 'watching' and unread = '{}') <> 3 then
    raise exception 'FAIL: a new watch was not watching with nothing unread';
  end if;

  -- A red job on the merge commit breaks one lane; the same run replayed adds nothing.
  insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, parent, at)
  values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain', 'ci-red', '9001/test',
          'https://github.com/initech/nimbus-brain/actions/runs/9001', 'test', 'green', '2026-09-01T09:20:00Z');
  update public.prd_main_watch set status = 'broke' where workspace_id = initech and lane = 'initech/nimbus-brain';
  insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, parent, at)
  values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain', 'ci-red', '9001/test',
          'https://github.com/initech/nimbus-brain/actions/runs/9001', 'test', 'green', '2026-09-01T09:30:00Z')
  on conflict do nothing;
  insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, at) values
    (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain', 'revert', repeat('ab', 20),
     'https://github.com/initech/nimbus-brain/commit/' || repeat('ab', 20), 'Revert "feat: s3"', '2026-09-02T09:00:00Z'),
    (acme, 'acme/widgets', 3, 'acme/widgets', 'regression', '41',
     'https://github.com/acme/widgets/issues/41', 'The quote total is wrong', '2026-09-03T09:00:00Z');
  if (select count(*) from public.prd_main_breaks) <> 3 then
    raise exception 'FAIL: a replayed break added a row';
  end if;
  if (select at from public.prd_main_breaks where source = '9001/test') <> '2026-09-01T09:20:00Z' then
    raise exception 'FAIL: a replayed break changed the first';
  end if;

  -- What a watch and a break refuse.
  begin
    update public.prd_main_watch set unread = array['workflow runs'], status = 'clean' where workspace_id = initech and lane = 'initech/nimbus-workflow';
    raise exception 'FAIL: a watch with an unread signal read clean';
  exception when check_violation then null; end;
  begin
    update public.prd_main_watch set status = 'flaky' where workspace_id = acme;
    raise exception 'FAIL: a status the watch does not know was stored';
  exception when check_violation then null; end;
  begin
    insert into public.prd_main_watch (workspace_id, repository, prd, lane, merge_sha, merged_at, watch_until)
    values (initech, 'initech/nimbus-plan', 8, 'initech/nimbus-plan', sha, '2026-09-01T09:00:00Z', '2026-09-01T09:00:00Z');
    raise exception 'FAIL: a watch that ends at its merge was stored';
  exception when check_violation then null; end;
  begin
    insert into public.prd_main_watch (workspace_id, repository, prd, lane, merge_sha, merged_at, watch_until)
    values (initech, 'initech/nimbus-plan', 8, 'Initech/Nimbus-Plan', sha, '2026-09-01T09:00:00Z', '2026-09-08T09:00:00Z');
    raise exception 'FAIL: a lane was stored in upper case';
  exception when check_violation then null; end;
  begin
    insert into public.prd_main_watch (workspace_id, repository, prd, lane, merge_sha, merged_at, watch_until)
    values (initech, 'initech/nimbus-plan', 8, 'initech/nimbus-plan', 'main', '2026-09-01T09:00:00Z', '2026-09-08T09:00:00Z');
    raise exception 'FAIL: a merge commit that is no SHA was stored';
  exception when check_violation then null; end;
  begin
    insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, at)
    values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain', 'deploy', '1', 'https://example.com/1', 'a deploy', now());
    raise exception 'FAIL: a break of a kind the watch does not know was stored';
  exception when check_violation then null; end;
  begin
    insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, parent, at)
    values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain', 'revert', 'cd', 'https://example.com/cd', 'Revert', 'green', now());
    raise exception 'FAIL: a revert was stored with a parent result';
  exception when check_violation then null; end;
  begin
    insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, at)
    values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain', 'regression', '42', 'javascript:alert(1)', 'An issue', now());
    raise exception 'FAIL: a break was stored with a link that is not https';
  exception when check_violation then null; end;
  begin
    insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, at)
    values (initech, 'initech/nimbus-plan', 9, 'initech/nimbus-plan', 'regression', '43', 'https://example.com/43', 'An issue', now());
    raise exception 'FAIL: a break was stored for a PRD with no watch';
  exception when foreign_key_violation then null; end;
  begin
    update public.prd_main_breaks set url = 'https://example.com/other';
    raise exception 'FAIL: the service role rewrote a break';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.prd_main_breaks;
    raise exception 'FAIL: the service role deleted a break';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.prd_main_watch;
    raise exception 'FAIL: the service role deleted a watch';
  exception when insufficient_privilege then null; end;

  -- The rewind proposes findings.
  insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix) values
    (initech, 'initech/nimbus-plan', 7, 'plan', 'repository', 'Slice s3 changed the job state the tests of slice s2 read.',
     '["https://github.com/initech/nimbus-brain/pull/12"]', 'A test of the two states together.'),
    (initech, 'initech/nimbus-plan', 7, 'waves', 'omni-setup', 'The plan put s3 in the same wave as s2.',
     '["https://github.com/initech/nimbus-plan/pull/10", "https://github.com/initech/nimbus-plan/pull/11"]', 'An issue for the kit''s planning.'),
    (acme, 'acme/widgets', 3, 'knowledge', 'knowledge', 'Nobody wrote down how a quote total rounds.',
     '["https://github.com/acme/widgets/issues/41"]', 'A rule in the register.');
  if (select count(*) from public.rewind_findings where state = 'proposed' and decided_at is null and decided_by is null) <> 3 then
    raise exception 'FAIL: a new finding was not proposed';
  end if;

  -- What a finding refuses.
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
    values (initech, 'initech/nimbus-plan', 7, 'ci', 'repository', 'A red run.', '[]', 'A test.');
    raise exception 'FAIL: a finding with no evidence link was stored';
  exception when check_violation then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
    values (initech, 'initech/nimbus-plan', 7, 'ci', 'repository', 'A red run.', '"https://github.com/initech/nimbus-brain/pull/12"', 'A test.');
    raise exception 'FAIL: a finding whose evidence is no list was stored';
  exception when check_violation then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
    values (initech, 'initech/nimbus-plan', 7, 'ci', 'repository', 'A red run.', '["see the logs"]', 'A test.');
    raise exception 'FAIL: a finding whose evidence is no link was stored';
  exception when check_violation then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
    values (initech, 'initech/nimbus-plan', 7, 'ci', 'the team', 'A red run.', '["https://example.com/1"]', 'A test.');
    raise exception 'FAIL: a finding of an unknown origin was stored';
  exception when check_violation then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
    values (initech, 'initech/nimbus-plan', 7, 'vibes', 'repository', 'A red run.', '["https://example.com/1"]', 'A test.');
    raise exception 'FAIL: a finding of an unknown check was stored';
  exception when check_violation then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
    values (initech, 'initech/nimbus-plan', 7, 'plan', 'repository', 'Said again, in other words.',
            '["https://github.com/initech/nimbus-brain/pull/12"]', 'Another fix.');
    raise exception 'FAIL: the same check, origin and evidence was proposed twice';
  exception when unique_violation then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix, state, decided_at)
    values (initech, 'initech/nimbus-plan', 7, 'ci', 'repository', 'A red run.', '["https://example.com/2"]', 'A test.', 'approved', now());
    raise exception 'FAIL: the service role stored a finding already decided';
  exception when insufficient_privilege then null; end;
  begin
    update public.rewind_findings set state = 'approved', decided_at = now();
    raise exception 'FAIL: the service role decided a finding';
  exception when insufficient_privilege then null; end;
  begin
    perform public.rewind_finding_approve(initech, (select id from public.rewind_findings where check_name = 'plan'));
    raise exception 'FAIL: the service role ran the approval';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.rewind_finding_events (workspace_id, finding_id, action)
    values (initech, (select id from public.rewind_findings where check_name = 'plan'), 'approved');
    raise exception 'FAIL: the service role logged a decision';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.rewind_findings;
    raise exception 'FAIL: the service role deleted a finding';
  exception when insufficient_privilege then null; end;

  -- The App queues the rewind as it queues retro-apply: sent by the app, with no person.
  insert into public.runner_jobs (workspace_id, line, repo, sent_by_app)
  values (initech, '/omni:rewind 2410', 'initech/nimbus-plan', 'omni-app');
  if not exists (select 1 from public.runner_jobs where line = '/omni:rewind 2410' and sent_by_app = 'omni-app' and sent_by is null) then
    raise exception 'FAIL: the app could not queue the rewind';
  end if;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.prd_main_watch limit 1; raise exception 'FAIL: anon read the main watches';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.prd_main_breaks limit 1; raise exception 'FAIL: anon read the main breaks';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.rewind_findings limit 1; raise exception 'FAIL: anon read the rewind findings';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.rewind_finding_events limit 1; raise exception 'FAIL: anon read the rewind decisions';
  exception when insufficient_privilege then null; end;
  begin
    perform public.rewind_finding_approve(current_setting('main_watch.initech')::uuid, gen_random_uuid());
    raise exception 'FAIL: anon ran the approval';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads her workspace's rows only, writes no table, decides each finding once ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024a1', 'ada@example.com');
do $$
declare
  initech uuid := current_setting('main_watch.initech')::uuid;
  acme    uuid := current_setting('main_watch.acme')::uuid;
  plan_finding  uuid := (select id from public.rewind_findings where check_name = 'plan');
  waves_finding uuid := (select id from public.rewind_findings where check_name = 'waves');
  decided public.rewind_findings;
begin
  if (select count(*) from public.prd_main_watch) <> 2 or exists (select 1 from public.prd_main_watch where repository = 'acme/widgets') then
    raise exception 'FAIL: a member did not read exactly their workspace''s watches';
  end if;
  if (select count(*) from public.prd_main_breaks) <> 2 or (select count(*) from public.rewind_findings) <> 2 then
    raise exception 'FAIL: a member did not read exactly their workspace''s breaks and findings';
  end if;
  if (select status from public.prd_main_watch where lane = 'initech/nimbus-brain') <> 'broke' then
    raise exception 'FAIL: a member did not read the broken lane';
  end if;

  begin
    insert into public.prd_main_watch (workspace_id, repository, prd, lane, merge_sha, merged_at, watch_until)
    values (initech, 'initech/nimbus-plan', 8, 'initech/nimbus-plan', repeat('0', 40), now(), now() + interval '7 days');
    raise exception 'FAIL: a member opened a watch';
  exception when insufficient_privilege then null; end;
  begin
    update public.prd_main_watch set status = 'clean';
    raise exception 'FAIL: a member changed a watch';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.prd_main_breaks (workspace_id, repository, prd, lane, kind, source, url, title, at)
    values (initech, 'initech/nimbus-plan', 7, 'initech/nimbus-brain', 'regression', '44', 'https://example.com/44', 'An issue', now());
    raise exception 'FAIL: a member added a break';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.prd_main_breaks;
    raise exception 'FAIL: a member deleted a break';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
    values (initech, 'initech/nimbus-plan', 7, 'ci', 'repository', 'A red run.', '["https://example.com/3"]', 'A test.');
    raise exception 'FAIL: a member proposed a finding';
  exception when insufficient_privilege then null; end;
  begin
    update public.rewind_findings set state = 'approved', decided_at = now() where id = plan_finding;
    raise exception 'FAIL: a member decided a finding without its function';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.rewind_finding_events (workspace_id, finding_id, action) values (initech, plan_finding, 'approved');
    raise exception 'FAIL: a member logged a decision';
  exception when insufficient_privilege then null; end;
  begin
    perform public.rewind_finding_open(initech, plan_finding);
    raise exception 'FAIL: a member ran the decision''s helper';
  exception when insufficient_privilege then null; end;

  -- Approve: who and when, and one event.
  decided := public.rewind_finding_approve(initech, plan_finding);
  if decided.state <> 'approved' or decided.decided_by <> '00000000-0000-4000-8000-0000000024a1' or decided.decided_at is null or decided.reason is not null then
    raise exception 'FAIL: an approval did not record who and when';
  end if;
  if (select count(*) from public.rewind_finding_events where finding_id = plan_finding and action = 'approved'
        and changed_by = '00000000-0000-4000-8000-0000000024a1') <> 1 then
    raise exception 'FAIL: an approval did not log its event';
  end if;

  -- A second decision, either way, is refused, and logs nothing.
  begin
    perform public.rewind_finding_approve(initech, plan_finding);
    raise exception 'FAIL: a finding was approved twice';
  exception when insufficient_privilege then
    if sqlerrm not like 'Finding: already approved%' then raise exception 'FAIL: a second approval was refused for another reason: %', sqlerrm; end if;
  end;
  begin
    perform public.rewind_finding_reject(initech, plan_finding, 'changed my mind');
    raise exception 'FAIL: an approved finding was rejected';
  exception when insufficient_privilege then
    if sqlerrm not like 'Finding: already approved%' then raise exception 'FAIL: a rejection after an approval was refused for another reason: %', sqlerrm; end if;
  end;
  if (select count(*) from public.rewind_finding_events where finding_id = plan_finding) <> 1
     or (select state from public.rewind_findings where id = plan_finding) <> 'approved' then
    raise exception 'FAIL: a refused second decision changed something';
  end if;

  -- A reason must be one line of at most 500 characters; a refused one decides nothing.
  begin
    perform public.rewind_finding_reject(initech, waves_finding, 'two' || chr(10) || 'lines');
    raise exception 'FAIL: a reason on two lines was kept';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.rewind_finding_reject(initech, waves_finding, repeat('x', 501));
    raise exception 'FAIL: a reason of 501 characters was kept';
  exception when sqlstate '22023' then null; end;
  if (select state from public.rewind_findings where id = waves_finding) <> 'proposed' then
    raise exception 'FAIL: a refused rejection decided the finding';
  end if;

  -- Reject: kept, with its reason, who and when, and one event.
  decided := public.rewind_finding_reject(initech, waves_finding, '  The waves were right; s3 came later.  ');
  if decided.state <> 'rejected' or decided.reason <> 'The waves were right; s3 came later.'
     or decided.decided_by <> '00000000-0000-4000-8000-0000000024a1' or decided.decided_at is null then
    raise exception 'FAIL: a rejection did not keep its reason, who and when';
  end if;
  if (select count(*) from public.rewind_finding_events where finding_id = waves_finding and action = 'rejected'
        and reason = 'The waves were right; s3 came later.') <> 1 then
    raise exception 'FAIL: a rejection did not log its event';
  end if;

  -- No finding of that id in her workspace, and a workspace she is not in.
  begin
    perform public.rewind_finding_approve(initech, gen_random_uuid());
    raise exception 'FAIL: an unknown finding was approved';
  exception when sqlstate 'P0002' then null; end;
  begin
    perform public.rewind_finding_approve(initech, (select f.id from public.rewind_findings f where false));
    raise exception 'FAIL: no finding was approved';
  exception when sqlstate 'P0002' then null; end;
  begin
    perform public.rewind_finding_approve(acme, plan_finding);
    raise exception 'FAIL: a member decided in a workspace she is not in';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The App proposes a rejected finding again: refused, it is never proposed twice ──
set local role service_role;
do $$
begin
  insert into public.rewind_findings (workspace_id, repository, prd, check_name, origin, happened, evidence, fix)
  values (current_setting('main_watch.initech')::uuid, 'initech/nimbus-plan', 7, 'waves', 'omni-setup', 'The plan put s3 in the same wave as s2, again.',
          '["https://github.com/initech/nimbus-plan/pull/10", "https://github.com/initech/nimbus-plan/pull/11"]', 'An issue for the kit''s planning.');
  raise exception 'FAIL: a rejected finding was proposed again';
exception when unique_violation then null;
end $$;
reset role;

-- ── Carl, of another workspace: reads only Acme's, and decides nothing of Initech's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024c1', 'carl@acme.test');
do $$
declare
  initech uuid := current_setting('main_watch.initech')::uuid;
  acme    uuid := current_setting('main_watch.acme')::uuid;
begin
  if (select count(*) from public.prd_main_watch) <> 1 or (select count(*) from public.prd_main_breaks) <> 1
     or (select count(*) from public.rewind_findings) <> 1 or exists (select 1 from public.rewind_finding_events) then
    raise exception 'FAIL: a member of another workspace did not read exactly their own';
  end if;
  begin
    perform public.rewind_finding_reject(initech, gen_random_uuid(), null);
    raise exception 'FAIL: a member of another workspace decided an Initech finding';
  exception when insufficient_privilege then null; end;
  -- His workspace's finding, named under his workspace: he may decide it, with no reason.
  if (public.rewind_finding_reject(acme,
        (select id from public.rewind_findings where check_name = 'knowledge'), '   ')).reason is not null then
    raise exception 'FAIL: a blank reason was kept';
  end if;
end $$;
reset role;

-- ── Eve, in no workspace: reads nothing, decides nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000024e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.prd_main_watch) or exists (select 1 from public.prd_main_breaks)
     or exists (select 1 from public.rewind_findings) or exists (select 1 from public.rewind_finding_events) then
    raise exception 'FAIL: an account in no workspace read a watch, a break, a finding or a decision';
  end if;
  begin
    perform public.rewind_finding_approve(current_setting('main_watch.initech')::uuid, gen_random_uuid());
    raise exception 'FAIL: an account in no workspace decided a finding';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;

select 'main_watch: every check passed' as result;
