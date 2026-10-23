-- What the database keeps of a job an API key sent, and who may close its questions (PRD 2425), run
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/api_key_jobs.sql
-- As the service role: a job's outcome takes the six new words beside today's, and refuses `need-human`
-- (the page's `human` stands for it); `acting_for`, `cancelled_for` and `closed_for` hold 1 to 80
-- characters, `notify_url` and `fixed_by` an `https` link (500 and 300 characters at most), `prs` a list
-- of 50 at most; a round open holds no key and no `acting_for`, and one closed names a person or a key,
-- never both. runner_job_answer() and runner_job_dismiss() close a round for a key of the job's
-- workspace, with its `acting_for`, and record the key and never a person; the resume of a key's job keeps
-- `sent_by_key`, sets `continues` and keeps `notify_url`, also when a person answered; the second close
-- of a round is refused (BR-PRODUCT-12); a key outside the workspace, off the repository, revoked, whose
-- maker left, of the kit, or on a job no key sent, is refused (BR-PRODUCT-63, BR-PRODUCT-64). A member of
-- the workspace reads the columns, nobody else does, and nobody signed in writes them. While the key holds
-- a GitHub App (PRD 2433), the resume, whoever answered, and a job inserted as the automatic continuation
-- or a relaunch inserts it are marked to run as that App; while it holds none, none is. Any `FAIL:` stops
-- the run.

begin;

-- ── The cast ──
-- Olga owns the workspace Key jobs, Mo is a member of it; Ivy made a key and left; Eve owns another one.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000024250a1', 'olga@keyjobs.test'),
  ('00000000-0000-4000-8000-0000024250b1', 'mo@keyjobs.test'),
  ('00000000-0000-4000-8000-0000024250c1', 'ivy@keyjobs.test'),
  ('00000000-0000-4000-8000-0000024250e1', 'eve@elsewhere.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000002425001', 'keyjobs-check', 'Key jobs', 'keyjobs-check'),
  ('00000000-0000-4000-8000-000002425002', 'keyjobs-elsewhere', 'Elsewhere', 'keyjobs-elsewhere');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000002425001', '00000000-0000-4000-8000-0000024250a1', 'owner'),
  ('00000000-0000-4000-8000-000002425001', '00000000-0000-4000-8000-0000024250b1', 'member'),
  ('00000000-0000-4000-8000-000002425002', '00000000-0000-4000-8000-0000024250e1', 'owner');

-- Seven keys: pipeline (Olga's) and pipeline-2 (Mo's) act on the whole workspace; narrow only on another
-- repository; revoked is revoked; left was made by Ivy, no longer a member; kit is a kit token, not a
-- key; elsewhere belongs to the other workspace.
insert into public.agent_tokens (id, workspace_id, made_by, name, token_hash, last_four, scope, repos, expires_at, revoked_at)
select t.id::uuid, w.id, t.made_by::uuid, t.name, encode(sha256(convert_to(t.secret, 'UTF8')), 'hex'), right(t.secret, 4), t.scope,
       t.repos::text[], case when t.scope = 'kit' then now() + interval '30 days' end, t.revoked::timestamptz
  from (values
    ('00000000-0000-4000-8000-0000024253a1', 'keyjobs-check', '00000000-0000-4000-8000-0000024250a1', 'pipeline', 'oma_keyjobs_pipeline_0001', 'api', '{}', null),
    ('00000000-0000-4000-8000-0000024253b1', 'keyjobs-check', '00000000-0000-4000-8000-0000024250b1', 'pipeline-2', 'oma_keyjobs_pipeline_0002', 'api', '{}', null),
    ('00000000-0000-4000-8000-0000024253c1', 'keyjobs-check', '00000000-0000-4000-8000-0000024250a1', 'narrow', 'oma_keyjobs_narrow_0003', 'api', '{keyjobs-check/other}', null),
    ('00000000-0000-4000-8000-0000024253d1', 'keyjobs-check', '00000000-0000-4000-8000-0000024250a1', 'revoked', 'oma_keyjobs_revoked_0004', 'api', '{}', '2026-10-01T00:00:00Z'),
    ('00000000-0000-4000-8000-0000024253e1', 'keyjobs-check', '00000000-0000-4000-8000-0000024250c1', 'left', 'oma_keyjobs_left_0005', 'api', '{}', null),
    ('00000000-0000-4000-8000-0000024253f1', 'keyjobs-check', '00000000-0000-4000-8000-0000024250a1', 'kit', 'omk_keyjobs_kit_0006', 'kit', '{}', null),
    ('00000000-0000-4000-8000-0000024253a2', 'keyjobs-elsewhere', '00000000-0000-4000-8000-0000024250e1', 'elsewhere', 'oma_keyjobs_elsewhere_0007', 'api', '{}', null))
       as t (id, slug, made_by, name, secret, scope, repos, revoked)
  join public.workspaces w on w.slug = t.slug;

insert into public.runners (id, workspace_id, owner, name, repos) values
  ('00000000-0000-4000-8000-0000024251a1', '00000000-0000-4000-8000-000002425001', '00000000-0000-4000-8000-0000024250a1', 'box', '{keyjobs-check/app}'),
  ('00000000-0000-4000-8000-0000024251a2', '00000000-0000-4000-8000-000002425002', '00000000-0000-4000-8000-0000024250e1', 'far-box', '{keyjobs-elsewhere/app}');

-- The jobs, all ended `human` with their questions open but K7 (still running) and C5 (the job that
-- already carries K5 on):
--   K1 sent by pipeline, answered by pipeline-2 for Jane D.     K2 sent by pipeline-2, answered by Olga on the page
--   K3 sent by pipeline, dismissed by pipeline-2                K4 sent by pipeline, every refusal lands on it
--   K5 sent by pipeline, already carried on by C5               K6 sent by pipeline, a line too long to resume
--   K7 sent by pipeline, still running                          P1 sent by Olga, no key     K8 sent by elsewhere
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, sent_by_key, notify_url, status, runner_id, claimed_at, running_at, ended_at, outcome)
select j.id::uuid, w.id, j.line, j.repo, j.sent_by::uuid, j.sent_by_key::uuid, j.notify_url, j.status,
       case when j.slug = 'keyjobs-check' then '00000000-0000-4000-8000-0000024251a1'::uuid else '00000000-0000-4000-8000-0000024251a2'::uuid end,
       now(), now(), case when j.status = 'done' then now() end, j.outcome
  from (values
    ('00000000-0000-4000-8000-0000024252a1', 'keyjobs-check', '/omni:bug-fix #401', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', '00000000-0000-4000-8000-0000024253a1', 'https://app.example.test/hook', 'done', 'human'),
    ('00000000-0000-4000-8000-0000024252a2', 'keyjobs-check', '/omni:mega-bug-fix #402', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250b1', '00000000-0000-4000-8000-0000024253b1', 'https://app.example.test/hook', 'done', 'human'),
    ('00000000-0000-4000-8000-0000024252a3', 'keyjobs-check', '/omni:bug-fix #403', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', '00000000-0000-4000-8000-0000024253a1', null, 'done', 'human'),
    ('00000000-0000-4000-8000-0000024252a4', 'keyjobs-check', '/omni:bug-fix #404', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', '00000000-0000-4000-8000-0000024253a1', null, 'done', 'human'),
    ('00000000-0000-4000-8000-0000024252a5', 'keyjobs-check', '/omni:bug-fix #405', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', '00000000-0000-4000-8000-0000024253a1', null, 'done', 'human'),
    ('00000000-0000-4000-8000-0000024252a6', 'keyjobs-check', '/omni:' || repeat('a', 200), 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', '00000000-0000-4000-8000-0000024253a1', null, 'done', 'human'),
    ('00000000-0000-4000-8000-0000024252a7', 'keyjobs-check', '/omni:bug-fix #407', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', '00000000-0000-4000-8000-0000024253a1', null, 'running', null),
    ('00000000-0000-4000-8000-0000024252b1', 'keyjobs-check', '/omni:bug-fix #411', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', null, null, 'done', 'human'),
    ('00000000-0000-4000-8000-0000024252a8', 'keyjobs-elsewhere', '/omni:bug-fix #408', 'keyjobs-elsewhere/app', '00000000-0000-4000-8000-0000024250e1', '00000000-0000-4000-8000-0000024253a2', null, 'done', 'human'))
       as j (id, slug, line, repo, sent_by, sent_by_key, notify_url, status, outcome)
  join public.workspaces w on w.slug = j.slug;
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, continues, status)
values ('00000000-0000-4000-8000-0000024252c5', '00000000-0000-4000-8000-000002425001', '/omni:bug-fix #405 --answers 00000000-0000-4000-8000-0000024252a5',
        'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1', '00000000-0000-4000-8000-0000024252a5', 'queued');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ── What the service role may store ──
set local role service_role;
do $$
declare
  one constant jsonb := '[{"question":"Which fix?","header":"Fix","options":[{"label":"Guard","description":"Check the input"},{"label":"Design it first","description":"Stop here and brainstorm the behaviour"}],"multiSelect":false}]';
  ws  constant uuid  := '00000000-0000-4000-8000-000002425001';
  k4  constant uuid  := '00000000-0000-4000-8000-0000024252a4';
  v   text;
begin
  insert into public.runner_job_questions (job_id, workspace_id, issue, lead, questions)
  select j.id::uuid, ws, j.issue, 'Two fixes are possible.', one
    from (values ('00000000-0000-4000-8000-0000024252a1', 401), ('00000000-0000-4000-8000-0000024252a2', 402),
                 ('00000000-0000-4000-8000-0000024252a3', 403), ('00000000-0000-4000-8000-0000024252a4', 404),
                 ('00000000-0000-4000-8000-0000024252a5', 405), ('00000000-0000-4000-8000-0000024252a6', 406),
                 ('00000000-0000-4000-8000-0000024252a7', 407), ('00000000-0000-4000-8000-0000024252b1', 411)) as j (id, issue);
  insert into public.runner_job_questions (job_id, workspace_id, issue, lead, questions)
  values ('00000000-0000-4000-8000-0000024252a8', '00000000-0000-4000-8000-000002425002', 408, 'Another team''s question.', one);

  -- A job's outcome takes the six new words, and the page's `human` and `stopped`; `need-human` is refused.
  foreach v in array array['pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked', 'human', 'stopped', 'answers'] loop
    update public.runner_jobs set outcome = v where id = '00000000-0000-4000-8000-0000024252a7';
  end loop;
  begin update public.runner_jobs set outcome = 'need-human' where id = '00000000-0000-4000-8000-0000024252a7';
    raise exception 'FAIL: need-human was stored as an outcome (the page''s human stands for it)';
  exception when check_violation then null; end;
  begin update public.runner_jobs set outcome = 'pr_opened' where id = '00000000-0000-4000-8000-0000024252a7';
    raise exception 'FAIL: the public spelling of an outcome was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set outcome = 'done' where id = '00000000-0000-4000-8000-0000024252a7';
    raise exception 'FAIL: an unknown outcome was stored';
  exception when check_violation then null; end;
  update public.runner_jobs set outcome = null where id = '00000000-0000-4000-8000-0000024252a7';

  -- acting_for: 1 to 80 characters, for a job and for a cancel.
  update public.runner_jobs set acting_for = repeat('a', 80), cancelled_for = repeat('b', 80) where id = k4;
  update public.runner_jobs set acting_for = 'J', cancelled_for = 'J' where id = k4;
  begin update public.runner_jobs set acting_for = repeat('a', 81) where id = k4;
    raise exception 'FAIL: an acting_for of 81 characters was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set acting_for = '' where id = k4;
    raise exception 'FAIL: an empty acting_for was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set cancelled_for = repeat('b', 81) where id = k4;
    raise exception 'FAIL: a cancelled_for of 81 characters was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set cancelled_for = '' where id = k4;
    raise exception 'FAIL: an empty cancelled_for was stored';
  exception when check_violation then null; end;
  update public.runner_jobs set acting_for = null, cancelled_for = null where id = k4;

  -- notify_url: an https link of 500 characters at most; fixed_by: one of 300.
  update public.runner_jobs set notify_url = 'https://' || repeat('a', 492) where id = k4;
  begin update public.runner_jobs set notify_url = 'https://' || repeat('a', 493) where id = k4;
    raise exception 'FAIL: a notify_url of 501 characters was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set notify_url = 'http://app.example.test/hook' where id = k4;
    raise exception 'FAIL: a notify_url over http was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set notify_url = 'ftp://app.example.test/hook' where id = k4;
    raise exception 'FAIL: a notify_url over ftp was stored';
  exception when check_violation then null; end;
  update public.runner_jobs set notify_url = null where id = k4;
  update public.runner_jobs set fixed_by = 'https://github.com/keyjobs-check/app/pull/7' where id = k4;
  begin update public.runner_jobs set fixed_by = 'http://github.com/keyjobs-check/app/pull/7' where id = k4;
    raise exception 'FAIL: a fixed_by over http was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set fixed_by = 'https://' || repeat('a', 293) where id = k4;
    raise exception 'FAIL: a fixed_by of 301 characters was stored';
  exception when check_violation then null; end;
  update public.runner_jobs set fixed_by = null where id = k4;

  -- prs: none by default, 50 at most, and a list.
  if (select prs from public.runner_jobs where id = k4) <> '[]'::jsonb then
    raise exception 'FAIL: a job''s pull requests do not start as an empty list';
  end if;
  update public.runner_jobs set prs = (select jsonb_agg(jsonb_build_object('url', 'https://github.com/keyjobs-check/app/pull/' || n)) from generate_series(1, 50) n) where id = k4;
  begin update public.runner_jobs set prs = (select jsonb_agg(jsonb_build_object('url', 'https://github.com/keyjobs-check/app/pull/' || n)) from generate_series(1, 51) n) where id = k4;
    raise exception 'FAIL: a 51st pull request was stored';
  exception when check_violation then null; end;
  begin update public.runner_jobs set prs = '{"url":"https://github.com/keyjobs-check/app/pull/1"}' where id = k4;
    raise exception 'FAIL: pull requests were stored as an object';
  exception when check_violation then null; end;
  begin update public.runner_jobs set prs = null where id = k4;
    raise exception 'FAIL: a job''s pull requests were stored as null';
  exception when not_null_violation then null; end;
  update public.runner_jobs set prs = '[]' where id = k4;

  -- A cancel names a key the workspace holds, and only one that exists.
  update public.runner_jobs set cancelled_by_key = '00000000-0000-4000-8000-0000024253a1', cancelled_for = 'Jane D.' where id = k4;
  begin update public.runner_jobs set cancelled_by_key = '00000000-0000-4000-8000-0000024253ff' where id = k4;
    raise exception 'FAIL: a cancel named a key that does not exist';
  exception when foreign_key_violation then null; end;
  update public.runner_jobs set cancelled_by_key = null, cancelled_for = null where id = k4;

  -- A round still open holds no key and no acting_for; a closed one names a person or a key, never both,
  -- and closed_for holds 1 to 80 characters.
  begin update public.runner_job_questions set closed_by_key = '00000000-0000-4000-8000-0000024253a1' where job_id = k4;
    raise exception 'FAIL: a round still open stored the key that closed it';
  exception when check_violation then null; end;
  begin update public.runner_job_questions set closed_for = 'Jane D.' where job_id = k4;
    raise exception 'FAIL: a round still open stored an acting_for';
  exception when check_violation then null; end;
  begin update public.runner_job_questions set closed_at = now(), closed_by = '00000000-0000-4000-8000-0000024250a1', closed_by_key = '00000000-0000-4000-8000-0000024253a1' where job_id = k4;
    raise exception 'FAIL: a round was closed by a person and a key at once';
  exception when check_violation then null; end;
  begin update public.runner_job_questions set closed_at = now(), closed_by_key = '00000000-0000-4000-8000-0000024253a1', closed_for = repeat('c', 81) where job_id = k4;
    raise exception 'FAIL: a closed_for of 81 characters was stored';
  exception when check_violation then null; end;
  begin update public.runner_job_questions set closed_at = now(), closed_by_key = '00000000-0000-4000-8000-0000024253a1', closed_for = '' where job_id = k4;
    raise exception 'FAIL: an empty closed_for was stored';
  exception when check_violation then null; end;
  begin update public.runner_job_questions set closed_at = now(), closed_by_key = '00000000-0000-4000-8000-0000024253ff' where job_id = k4;
    raise exception 'FAIL: a round was closed by a key that does not exist';
  exception when foreign_key_violation then null; end;
  if (select closed_at from public.runner_job_questions where job_id = k4) is not null then
    raise exception 'FAIL: a refused close left the round closed';
  end if;
end $$;
reset role;

-- ── Closing a round for a key, as the service role ──
set local role service_role;
do $$
declare
  k1       constant uuid := '00000000-0000-4000-8000-0000024252a1';
  k2       constant uuid := '00000000-0000-4000-8000-0000024252a2';
  k3       constant uuid := '00000000-0000-4000-8000-0000024252a3';
  k4       constant uuid := '00000000-0000-4000-8000-0000024252a4';
  k5       constant uuid := '00000000-0000-4000-8000-0000024252a5';
  k6       constant uuid := '00000000-0000-4000-8000-0000024252a6';
  k7       constant uuid := '00000000-0000-4000-8000-0000024252a7';
  k8       constant uuid := '00000000-0000-4000-8000-0000024252a8';
  p1       constant uuid := '00000000-0000-4000-8000-0000024252b1';
  pipeline constant uuid := '00000000-0000-4000-8000-0000024253a1';
  pipe2    constant uuid := '00000000-0000-4000-8000-0000024253b1';
  narrow   constant uuid := '00000000-0000-4000-8000-0000024253c1';
  revoked  constant uuid := '00000000-0000-4000-8000-0000024253d1';
  gone     constant uuid := '00000000-0000-4000-8000-0000024253e1';
  kit      constant uuid := '00000000-0000-4000-8000-0000024253f1';
  elsewhere constant uuid := '00000000-0000-4000-8000-0000024253a2';
  olga     constant uuid := '00000000-0000-4000-8000-0000024250a1';
  mo       constant uuid := '00000000-0000-4000-8000-0000024250b1';
  good     constant jsonb := '{"Which fix?":"Guard"}';
  queued   integer;
  resume   public.runner_jobs;
  closed   public.runner_job_questions;
begin
  select count(*) into queued from public.runner_jobs where status = 'queued';

  -- Every refusal, on K4: it stays open, and nothing is queued.
  -- A key of another workspace, a key that is revoked, one whose maker left, a kit token and a key that
  -- is not a key at all may not answer; nor may a key kept to another repository.
  begin perform public.runner_job_answer(k4, good, p_key => elsewhere); raise exception 'FAIL: a key of another workspace answered';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer(k4, good, p_key => revoked); raise exception 'FAIL: a revoked key answered';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer(k4, good, p_key => gone); raise exception 'FAIL: a key whose maker left answered';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer(k4, good, p_key => kit); raise exception 'FAIL: a kit token answered';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer(k4, good, p_key => '00000000-0000-4000-8000-0000024253ff'); raise exception 'FAIL: a key nobody made answered';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer(k4, good, p_key => narrow); raise exception 'FAIL: a key kept to another repository answered';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss(k4, p_key => elsewhere); raise exception 'FAIL: a key of another workspace dismissed';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss(k4, p_key => revoked); raise exception 'FAIL: a revoked key dismissed';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss(k4, p_key => gone); raise exception 'FAIL: a key whose maker left dismissed';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss(k4, p_key => kit); raise exception 'FAIL: a kit token dismissed';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss(k4, p_key => narrow); raise exception 'FAIL: a key kept to another repository dismissed';
  exception when insufficient_privilege then null; end;
  -- A key never answers the questions of a job a person sent, nor those of another workspace's job.
  begin perform public.runner_job_answer(p1, good, p_key => pipeline); raise exception 'FAIL: a key answered a job a person sent';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss(p1, p_key => pipeline); raise exception 'FAIL: a key dismissed a job a person sent';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer(k8, good, p_key => pipeline); raise exception 'FAIL: a key answered another workspace''s job';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss(k8, p_key => pipeline); raise exception 'FAIL: a key dismissed another workspace''s job';
  exception when insufficient_privilege then null; end;
  -- Exactly one of a person and a key; acting_for only with a key, 1 to 80 characters.
  begin perform public.runner_job_answer(k4, good, p_by => mo, p_key => pipeline); raise exception 'FAIL: a person and a key answered together';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_answer(k4, good); raise exception 'FAIL: nobody answered';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_dismiss(k4, p_by => mo, p_key => pipeline); raise exception 'FAIL: a person and a key dismissed together';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_dismiss(k4); raise exception 'FAIL: nobody dismissed';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_answer(k4, good, p_by => mo, p_acting_for => 'Jane D.'); raise exception 'FAIL: a person answered for someone';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_dismiss(k4, p_by => mo, p_acting_for => 'Jane D.'); raise exception 'FAIL: a person dismissed for someone';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_answer(k4, good, p_key => pipeline, p_acting_for => repeat('a', 81)); raise exception 'FAIL: an acting_for of 81 characters was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_answer(k4, good, p_key => pipeline, p_acting_for => ''); raise exception 'FAIL: an empty acting_for was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.runner_job_dismiss(k4, p_key => pipeline, p_acting_for => repeat('a', 81)); raise exception 'FAIL: a dismissal for 81 characters was taken';
  exception when invalid_parameter_value then null; end;
  -- A job that is not waiting, and one a job already carries on, are refused.
  begin perform public.runner_job_answer(k7, good, p_key => pipeline); raise exception 'FAIL: a job still running was answered by a key';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.runner_job_answer(k5, good, p_key => pipeline); raise exception 'FAIL: a job already carried on was answered';
  exception when object_not_in_prerequisite_state then null; end;
  -- A resume that cannot be queued stores nothing: K6's line is so long that the resume line is over 240.
  begin perform public.runner_job_answer(k6, good, p_key => pipeline); raise exception 'FAIL: a resume line over 240 characters was queued';
  exception when check_violation then null; end;
  if (select count(*) from public.runner_jobs where status = 'queued') <> queued
     or exists (select 1 from public.runner_job_questions where job_id in (k4, k5, k6, k7, p1, k8) and closed_at is not null) then
    raise exception 'FAIL: a refused close queued a job or closed a round';
  end if;

  -- A key's answer, from another key of the workspace than the one that sent K1: the resume keeps K1's
  -- key and its maker, the line and the target, sets continues, keeps notify_url and carries the
  -- acting_for; the round records the key that answered and its acting_for, and no person.
  resume := public.runner_job_answer(k1, good, p_key => pipe2, p_acting_for => 'Jane D.');
  if resume.line <> '/omni:bug-fix #401 --answers ' || k1::text or resume.repo <> 'keyjobs-check/app' or resume.status <> 'queued'
     or resume.sent_by_key is distinct from pipeline or resume.sent_by is distinct from olga
     or resume.continues is distinct from k1 or resume.notify_url is distinct from 'https://app.example.test/hook'
     or resume.acting_for is distinct from 'Jane D.' or resume.workspace_id <> '00000000-0000-4000-8000-000002425001' then
    raise exception 'FAIL: the resume job does not keep the key''s job: its key and maker, the thread and the notify_url';
  end if;
  select * into closed from public.runner_job_questions where job_id = k1;
  if closed.answers <> good or closed.closed_by_key is distinct from pipe2 or closed.closed_for is distinct from 'Jane D.'
     or closed.closed_by is not null or closed.closed_at is null or closed.resume_job <> resume.id then
    raise exception 'FAIL: a key''s answer did not record the key, its acting_for and no person';
  end if;
  -- The first job is carried on by exactly one job, the key's, whoever answered.
  if (select count(*) from public.runner_jobs where continues = k1 and sent_by_key = pipeline) <> 1 then
    raise exception 'FAIL: the first job is not carried on by one job of its key';
  end if;

  -- A second answer or a dismissal after it, from a key or a person, is refused and changes nothing.
  begin perform public.runner_job_answer(k1, '{"Which fix?":"Design it first"}', p_key => pipeline); raise exception 'FAIL: a second answer from a key was taken';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.runner_job_answer(k1, '{"Which fix?":"Design it first"}', p_by => olga); raise exception 'FAIL: a second answer from a person was taken';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.runner_job_dismiss(k1, p_key => pipeline); raise exception 'FAIL: an answered round was dismissed by a key';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.runner_job_dismiss(k1, p_by => olga); raise exception 'FAIL: an answered round was dismissed by a person';
  exception when object_not_in_prerequisite_state then null; end;
  select * into closed from public.runner_job_questions where job_id = k1;
  if closed.answers <> good or closed.closed_by_key is distinct from pipe2 or closed.closed_for is distinct from 'Jane D.'
     or closed.closed_by is not null or closed.resume_job <> resume.id
     or (select count(*) from public.runner_jobs where status = 'queued') <> queued + 1 then
    raise exception 'FAIL: a refused second close changed the round or queued a job';
  end if;

  -- A key's answer with no acting_for stores none.
  -- (K2 is answered by a person below; K4 by a key without one, then it is closed.)
  resume := public.runner_job_answer(k4, good, p_key => pipeline);
  select * into closed from public.runner_job_questions where job_id = k4;
  if resume.acting_for is not null or closed.closed_for is not null or closed.closed_by_key is distinct from pipeline or closed.closed_by is not null then
    raise exception 'FAIL: a key''s answer with no acting_for stored one';
  end if;

  -- A person's answer on the page to a key's job keeps the resume the key's: its key and its maker, never
  -- the person who answered, the thread and the notify_url; the round names the person and no key.
  resume := public.runner_job_answer(k2, good, p_by => olga);
  if resume.line <> '/omni:mega-bug-fix #402 --answers ' || k2::text or resume.sent_by_key is distinct from pipe2
     or resume.sent_by is distinct from mo or resume.continues is distinct from k2
     or resume.notify_url is distinct from 'https://app.example.test/hook' or resume.acting_for is not null then
    raise exception 'FAIL: a person''s answer to a key''s job did not keep the resume the key''s';
  end if;
  select * into closed from public.runner_job_questions where job_id = k2;
  if closed.closed_by is distinct from olga or closed.closed_by_key is not null or closed.closed_for is not null
     or closed.resume_job <> resume.id then
    raise exception 'FAIL: a person''s answer did not record the person and no key';
  end if;

  -- A person's answer to a person's job is what it was: sent by the answerer, no key, no thread.
  resume := public.runner_job_answer(p1, good, mo);
  if resume.sent_by is distinct from mo or resume.sent_by_key is not null or resume.continues is not null
     or resume.notify_url is not null or resume.acting_for is not null then
    raise exception 'FAIL: a person''s answer to a person''s job changed';
  end if;

  -- A key's dismissal: any key of the workspace, closed with no answers and no job queued.
  select count(*) into queued from public.runner_jobs where status = 'queued';
  closed := public.runner_job_dismiss(k3, p_key => pipe2, p_acting_for => 'Ops team');
  if closed.closed_at is null or closed.closed_by_key is distinct from pipe2 or closed.closed_for is distinct from 'Ops team'
     or closed.closed_by is not null or closed.answers is not null or closed.resume_job is not null then
    raise exception 'FAIL: a key''s dismissal did not close the round with the key, its acting_for, no answers and no resume job';
  end if;
  if (select count(*) from public.runner_jobs where status = 'queued') <> queued then
    raise exception 'FAIL: a key''s dismissal queued a job';
  end if;
  begin perform public.runner_job_answer(k3, good, p_key => pipeline); raise exception 'FAIL: a dismissed round was answered by a key';
  exception when object_not_in_prerequisite_state then null; end;
  begin perform public.runner_job_dismiss(k3, p_key => pipeline); raise exception 'FAIL: a dismissed round was dismissed again by a key';
  exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;

-- ── A key that is deleted leaves what it did in place ──
delete from public.agent_tokens where id = '00000000-0000-4000-8000-0000024253b1';
do $$
begin
  if (select count(*) from public.runner_job_questions where closed_at is not null and workspace_id = '00000000-0000-4000-8000-000002425001') <> 5
     or exists (select 1 from public.runner_job_questions where closed_by_key = '00000000-0000-4000-8000-0000024253b1')
     or exists (select 1 from public.runner_jobs where sent_by_key = '00000000-0000-4000-8000-0000024253b1')
     or (select closed_for from public.runner_job_questions where job_id = '00000000-0000-4000-8000-0000024252a3') is distinct from 'Ops team' then
    raise exception 'FAIL: deleting a key broke the rounds it closed or the jobs it sent';
  end if;
end $$;

-- ── A job that carries a key's job on runs as the key's GitHub App ──
-- A job a key queues while it holds a GitHub App is marked to run as that App (PRD 2433: the AFTER INSERT
-- trigger runner_jobs_needs_app_mark on runner_jobs), and only a runner that runs it as the App claims it.
-- A job that carries a key's job on is the key's, so it is marked like any other: the resume, whether the
-- key or a person answered, and the automatic continuation and the relaunch, which insertContinuing
-- (apps/galaxy/src/runners/runners.repository.ts) inserts with the key's `sent_by_key` and `continues` set.
-- The mark follows what the key holds when the job is inserted. Four more jobs of pipeline, sent while it
-- holds no App, ended `human` on K4's question: K9 and K10 are carried on before Olga attaches an App to
-- pipeline, K11 and K12 after.

-- Carries two of pipeline's jobs on, as whoever runs it: `by_key` is answered by pipeline and `by_person` by
-- Olga on the page; the first resume is then continued as the automatic continuation inserts it, the second
-- relaunched as a relaunch is. Answers the four jobs queued, each with what it is and its key.
create function pg_temp.carry_on(by_key uuid, by_person uuid) returns table (what text, job uuid, job_key uuid)
language plpgsql as $$
declare
  pipeline   constant uuid  := '00000000-0000-4000-8000-0000024253a1';
  olga       constant uuid  := '00000000-0000-4000-8000-0000024250a1';
  good       constant jsonb := '{"Which fix?":"Guard"}';
  answered   public.runner_jobs;
  resumed    public.runner_jobs;
  continued  public.runner_jobs;
  relaunched public.runner_jobs;
begin
  answered := public.runner_job_answer(carry_on.by_key, good, p_key => pipeline);
  resumed := public.runner_job_answer(carry_on.by_person, good, p_by => olga);
  insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_key, continues, notify_url)
  values (answered.workspace_id, '/omni:yolo-fix 2425', answered.repo, answered.to_runner, answered.to_fleet, answered.sent_by,
          answered.sent_by_key, answered.id, answered.notify_url)
  returning * into continued;
  insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_key, continues, acting_for, notify_url)
  values (resumed.workspace_id, resumed.line, resumed.repo, resumed.to_runner, resumed.to_fleet, resumed.sent_by,
          resumed.sent_by_key, resumed.id, 'Ops bot', resumed.notify_url)
  returning * into relaunched;
  return query values
    ('the resume a key''s answer queued', answered.id, answered.sent_by_key),
    ('the resume a person''s answer to a key''s job queued', resumed.id, resumed.sent_by_key),
    ('the automatic continuation of a key''s job', continued.id, continued.sent_by_key),
    ('the relaunch of a key''s job', relaunched.id, relaunched.sent_by_key);
end;
$$;

set local role service_role;
insert into public.runner_jobs (id, workspace_id, line, repo, sent_by, sent_by_key, notify_url, status, runner_id, claimed_at, running_at, ended_at, outcome)
select j.id::uuid, '00000000-0000-4000-8000-000002425001', '/omni:bug-fix #' || j.issue, 'keyjobs-check/app', '00000000-0000-4000-8000-0000024250a1',
       '00000000-0000-4000-8000-0000024253a1', 'https://app.example.test/hook', 'done', '00000000-0000-4000-8000-0000024251a1', now(), now(), now(), 'human'
  from (values ('00000000-0000-4000-8000-0000024252a9', 421), ('00000000-0000-4000-8000-0000024252aa', 422),
               ('00000000-0000-4000-8000-0000024252ab', 423), ('00000000-0000-4000-8000-0000024252ac', 424)) as j (id, issue);
insert into public.runner_job_questions (job_id, workspace_id, issue, lead, questions)
select j.id::uuid, k4.workspace_id, j.issue, k4.lead, k4.questions
  from (values ('00000000-0000-4000-8000-0000024252a9', 421), ('00000000-0000-4000-8000-0000024252aa', 422),
               ('00000000-0000-4000-8000-0000024252ab', 423), ('00000000-0000-4000-8000-0000024252ac', 424)) as j (id, issue)
  join public.runner_job_questions k4 on k4.job_id = '00000000-0000-4000-8000-0000024252a4';

-- pipeline holds no App: every job that carries K9 and K10 on is the key's, and none is marked.
do $$
declare
  c    record;
  seen integer := 0;
begin
  for c in select * from pg_temp.carry_on('00000000-0000-4000-8000-0000024252a9', '00000000-0000-4000-8000-0000024252aa') loop
    seen := seen + 1;
    if c.job_key is distinct from '00000000-0000-4000-8000-0000024253a1' then
      raise exception 'FAIL: % is not the key''s', c.what;
    end if;
    if exists (select 1 from public.runner_job_needs_app n where n.job_id = c.job) then
      raise exception 'FAIL: % was marked to run as a GitHub App while its key held none', c.what;
    end if;
  end loop;
  if seen <> 4 then
    raise exception 'FAIL: carrying K9 and K10 on queued % jobs, not 4', seen;
  end if;
end $$;
reset role;

-- Olga attaches a GitHub App to pipeline (api_key_github_apps.sql proves the attach itself).
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000024250a1');
do $$
begin
  perform public.api_key_github_app_attach('00000000-0000-4000-8000-0000024253a1', 2425, 'keyjobs-bot', 24250,
                                           'sealed-for-keyjobs-bot', 'iv-for-keyjobs-bot');
end $$;
reset role;

-- pipeline holds an App: every job that carries K11 and K12 on is marked; the four jobs sent before it held
-- one are not.
set local role service_role;
do $$
declare
  c    record;
  seen integer := 0;
begin
  for c in select * from pg_temp.carry_on('00000000-0000-4000-8000-0000024252ab', '00000000-0000-4000-8000-0000024252ac') loop
    seen := seen + 1;
    if not exists (select 1 from public.runner_job_needs_app n where n.job_id = c.job) then
      raise exception 'FAIL: % is not marked to run as the key''s GitHub App', c.what;
    end if;
  end loop;
  if seen <> 4 then
    raise exception 'FAIL: carrying K11 and K12 on queued % jobs, not 4', seen;
  end if;
  if exists (select 1 from public.runner_job_needs_app n
              where n.job_id in ('00000000-0000-4000-8000-0000024252a9', '00000000-0000-4000-8000-0000024252aa',
                                 '00000000-0000-4000-8000-0000024252ab', '00000000-0000-4000-8000-0000024252ac')) then
    raise exception 'FAIL: a job sent before its key held a GitHub App was marked';
  end if;
end $$;
reset role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.runner_jobs limit 1; raise exception 'FAIL: anon read the runner jobs';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer('00000000-0000-4000-8000-0000024252a4', '{}', p_key => '00000000-0000-4000-8000-0000024253a1'); raise exception 'FAIL: anon answered for a key';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A member reads; nobody signed in writes ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000024250b1');
do $$
begin
  if (select count(*) from public.runner_jobs where acting_for = 'Jane D.' and sent_by_key is not null) <> 1
     or (select count(*) from public.runner_job_questions where closed_for = 'Ops team') <> 1
     or (select count(*) from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002425001' and notify_url is not null) < 3 then
    raise exception 'FAIL: a member did not read the new columns of their workspace''s jobs and rounds';
  end if;
  begin update public.runner_jobs set acting_for = 'forged' where id = '00000000-0000-4000-8000-0000024252a4';
    raise exception 'FAIL: a member wrote a job''s acting_for';
  exception when insufficient_privilege then null; end;
  begin update public.runner_jobs set cancelled_by_key = '00000000-0000-4000-8000-0000024253a1' where id = '00000000-0000-4000-8000-0000024252a4';
    raise exception 'FAIL: a member wrote a job''s cancelling key';
  exception when insufficient_privilege then null; end;
  begin update public.runner_jobs set notify_url = 'https://evil.example.test/' where id = '00000000-0000-4000-8000-0000024252a4';
    raise exception 'FAIL: a member wrote a job''s notify_url';
  exception when insufficient_privilege then null; end;
  begin update public.runner_jobs set prs = '[]', fixed_by = 'https://github.com/x/y/pull/1', outcome = 'blocked' where id = '00000000-0000-4000-8000-0000024252a4';
    raise exception 'FAIL: a member wrote a job''s outcome, fixed_by or pull requests';
  exception when insufficient_privilege then null; end;
  begin update public.runner_job_questions set closed_for = 'forged' where job_id = '00000000-0000-4000-8000-0000024252a3';
    raise exception 'FAIL: a member wrote a round''s acting_for';
  exception when insufficient_privilege then null; end;
  begin update public.runner_job_questions set closed_by_key = '00000000-0000-4000-8000-0000024253a1' where job_id = '00000000-0000-4000-8000-0000024252a3';
    raise exception 'FAIL: a member wrote a round''s closing key';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_answer('00000000-0000-4000-8000-0000024252a7', '{}', p_key => '00000000-0000-4000-8000-0000024253a1');
    raise exception 'FAIL: a member answered for a key through runner_job_answer()';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_dismiss('00000000-0000-4000-8000-0000024252a7', p_key => '00000000-0000-4000-8000-0000024253a1');
    raise exception 'FAIL: a member dismissed for a key through runner_job_dismiss()';
  exception when insufficient_privilege then null; end;
  begin perform public.runner_job_closer_check('00000000-0000-4000-8000-000002425001', 'keyjobs-check/app', '00000000-0000-4000-8000-0000024253a1', null, '00000000-0000-4000-8000-0000024253a1', null);
    raise exception 'FAIL: a member called the closer check';
  exception when insufficient_privilege then null; end;
end $$;

-- A member of another workspace reads none of it.
select pg_temp.sign_in('00000000-0000-4000-8000-0000024250e1');
do $$
begin
  if exists (select 1 from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002425001')
     or exists (select 1 from public.runner_job_questions where workspace_id = '00000000-0000-4000-8000-000002425001') then
    raise exception 'FAIL: another workspace read a key''s jobs or the rounds they closed';
  end if;
  if (select count(*) from public.runner_jobs where workspace_id = '00000000-0000-4000-8000-000002425002') <> 1 then
    raise exception 'FAIL: Eve did not read her own workspace''s job';
  end if;
end $$;
reset role;

rollback;

select 'api_key_jobs: every check passed' as result;
