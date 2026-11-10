-- The job ledger (PRD 2676 s1). The supabase workflow runs it on every pull request, after `supabase db start`
-- has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/background_jobs.sql
-- One job per key; a claim hands out the jobs due and adds a try; a claim that ran out is due again and
-- writes `lost`, and the 5th lost claim is `failed`; a stale claim cannot finish; each outcome moves the job,
-- `waiting` giving its try back and a 5th `retry` failing it; a replay keeps the attempts;
-- background_jobs_health() in each case, with counts and no name; forgetting keeps what is under 90 days;
-- two workers at once never hold one job; nobody but the service role reads or calls any of it.
-- The refresh (PRD 2688 s1): each row of its table (none, queued, running, done, skipped, failed), never
-- another kind's job of the same key; a try that ends, or a claim that runs out, on a job holding `again`
-- keeps its attempt line and queues the job at once, `again` cleared; a refresh racing a claim waits for it.
-- Waiting and pacing (PRD omni-loop-3 s1): `later` queues the job at its date with its progress, its try given
-- back, and the 21st fails it; one job of a kind and lane runs at a time, in one claim or two at once; each job
-- has its own tries; a schedule with no done job for three periods is late; a stale claim is still refused.
-- One transaction, rolled back at the end, then the races through dblink. Any `FAIL:` stops the run.

begin;

-- Runs a call that must be refused with `code`, its message holding `words` when given.
create function pg_temp.refused(stmt text, code text, why text, words text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if words is not null and position(words in sqlerrm) = 0 then
    raise exception 'FAIL: % said "%", not naming "%"', why, sqlerrm, words;
  end if;
end;
$$;

-- A knowledge pack's key, from one letter of its commit.
create function pg_temp.key(c text) returns text language sql immutable as $$ select 'initech/pack-api@' || repeat(c, 40) $$;
-- The knowledge pack job of a key.
create function pg_temp.job(k text) returns public.background_jobs language sql security definer as $$
  select * from public.background_jobs j where j.kind = 'knowledge-pack' and j.key = k;
$$;
-- Its attempts, as `try:outcome` in order.
create function pg_temp.tries_of(k text) returns text language sql security definer as $$
  select coalesce(string_agg(a.try || ':' || a.outcome, ' ' order by a.id), '')
    from public.background_job_attempts a join public.background_jobs j on j.id = a.job_id
   where j.kind = 'knowledge-pack' and j.key = k;
$$;
-- The jobs claimed now, as their keys in order; `none` when no job is due.
create function pg_temp.claimed(lim integer default 10) returns text language sql as $$
  select coalesce(string_agg(c.key, ' ' order by c.key), 'none') from public.background_job_claim(lim, 60) c;
$$;
-- What the owner may do and nobody signed in may: the worker died (its claim ran out), a job waited, it ended long ago.
create function pg_temp.expire(k text) returns void language sql security definer as $$
  update public.background_jobs j set claimed_until = now() - interval '1 second' where j.kind = 'knowledge-pack' and j.key = k;
$$;
create function pg_temp.due_since(k text, ago interval) returns void language sql security definer as $$
  update public.background_jobs j set run_after = now() - ago where j.kind = 'knowledge-pack' and j.key = k;
$$;
create function pg_temp.ended(k text, ago interval) returns void language sql security definer as $$
  update public.background_jobs j set finished_at = now() - ago where j.kind = 'knowledge-pack' and j.key = k;
$$;
create function pg_temp.health() returns jsonb language sql as $$ select public.background_jobs_health() $$;

-- PRD 2688: the jobs of one pull request, one per check, and what is done to them.
create function pg_temp.pr(k text) returns public.background_jobs language sql security definer as $$
  select * from public.background_jobs j where j.kind = k and j.key = 'initech/pr-api#12';
$$;
create function pg_temp.pr_tries(k text) returns text language sql security definer as $$
  select coalesce(string_agg(a.try || ':' || a.outcome, ' ' order by a.id), '')
    from public.background_job_attempts a join public.background_jobs j on j.id = a.job_id
   where j.kind = k and j.key = 'initech/pr-api#12';
$$;
create function pg_temp.pr_due(k text, ago interval) returns void language sql security definer as $$
  update public.background_jobs j set run_after = now() - ago where j.kind = k and j.key = 'initech/pr-api#12';
$$;
create function pg_temp.pr_expire(k text) returns void language sql security definer as $$
  update public.background_jobs j set claimed_until = now() - interval '1 second' where j.kind = k and j.key = 'initech/pr-api#12';
$$;
-- Refreshes the pull request's job of kind k with head commit `sha`, due in 5 seconds; what the refresh did.
create function pg_temp.refresh(k text, sha text) returns text language sql as $$
  select public.background_job_refresh(k, 'initech/pr-api#12', 'Initech/PR-API', jsonb_build_object('sha', sha), 5);
$$;
-- The jobs claimed now, as their kinds in order; `none` when no job is due.
create function pg_temp.kinds_claimed() returns text language sql as $$
  select coalesce(string_agg(c.kind, ' ' order by c.kind), 'none') from public.background_job_claim(10, 60) c;
$$;

-- ── Nobody but the service role reads or calls any of it ──
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.background_job_add(text, text, text, jsonb, text, integer)', 'public.background_job_claim(integer, integer)',
    'public.background_job_finish(uuid, uuid, text, text, timestamptz, jsonb)', 'public.background_job_replay(uuid)',
    'public.background_jobs_health(text[], integer[])', 'public.background_jobs_forget()',
    'public.background_job_refresh(text, text, text, jsonb, integer, text, integer)'] loop
    if has_function_privilege('anon', fn, 'execute') or has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL: % may be called by someone signed in or signed out', fn;
    end if;
    if not has_function_privilege('service_role', fn, 'execute') then
      raise exception 'FAIL: the service role cannot call %', fn;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.background_job_line(text)', 'execute')
     or has_function_privilege('authenticated', 'public.background_job_line(text)', 'execute')
     or has_function_privilege('service_role', 'public.background_job_line(text)', 'execute') then
    raise exception 'FAIL: background_job_line() may be called by someone';
  end if;
  foreach fn in array array['public.background_jobs', 'public.background_job_attempts'] loop
    if has_table_privilege('anon', fn, 'select, insert, update, delete, truncate')
       or has_table_privilege('authenticated', fn, 'select, insert, update, delete, truncate') then
      raise exception 'FAIL: % may be read or written by someone signed in or signed out', fn;
    end if;
    if has_table_privilege('service_role', fn, 'insert, update, delete, truncate') then
      raise exception 'FAIL: the service role writes % other than through the functions', fn;
    end if;
    if not has_table_privilege('service_role', fn, 'select') then
      raise exception 'FAIL: the service role cannot read %', fn;
    end if;
    if not (select relrowsecurity from pg_class where oid = fn::regclass) then
      raise exception 'FAIL: % is not under row-level security', fn;
    end if;
  end loop;
end $$;

set local role authenticated;
select pg_temp.refused($q$select public.background_job_add('knowledge-pack', 'x/y@1', 'x/y', '{}')$q$, '42501', 'a person adding a job');
select pg_temp.refused($q$select * from public.background_job_claim(1, 60)$q$, '42501', 'a person claiming a job');
select pg_temp.refused($q$select public.background_jobs_health()$q$, '42501', 'a person reading the health');
select pg_temp.refused($q$select 1 from public.background_jobs$q$, '42501', 'a person reading the jobs');
select pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'x/y#1', 'x/y', '{}', 5)$q$, '42501', 'a person refreshing a job');
reset role;
set local role anon;
select pg_temp.refused($q$select 1 from public.background_job_attempts$q$, '42501', 'anon reading the attempts');
select pg_temp.refused($q$select public.background_jobs_forget()$q$, '42501', 'anon forgetting the jobs');
select pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'x/y#1', 'x/y', '{}', 5)$q$, '42501', 'anon refreshing a job');
reset role;

set local role service_role;

-- ── Nothing yet: ok ──
do $$
begin
  if pg_temp.health() <> '{"state": "ok", "late": 0, "failed": 0, "scheduled": 0}'::jsonb then
    raise exception 'FAIL: an empty ledger is not ok: %', pg_temp.health();
  end if;
end $$;

-- ── One job per key ──
do $$
declare
  j public.background_jobs;
begin
  if not public.background_job_add('knowledge-pack', pg_temp.key('a'), 'Initech/Pack-API', '{"installationId": 7}') then
    raise exception 'FAIL: a first job was not added';
  end if;
  if public.background_job_add('knowledge-pack', pg_temp.key('a'), 'initech/pack-api', '{"installationId": 8}') then
    raise exception 'FAIL: the same key added a second job';
  end if;
  j := pg_temp.job(pg_temp.key('a'));
  if (select count(*) from public.background_jobs) <> 1 or j.subject <> 'initech/pack-api' or j.payload <> '{"installationId": 7}'
     or j.state <> 'queued' or j.tries <> 0 or j.claim is not null or j.run_after > now() then
    raise exception 'FAIL: the job is not one queued job, due now, of the first payload and its lower-case subject: %', j;
  end if;
  -- The same key of another kind is another job.
  if not public.background_job_add('other-kind', pg_temp.key('a'), 'initech/pack-api', '{}') then
    raise exception 'FAIL: the same key of another kind was not added';
  end if;
  perform pg_temp.due_since(pg_temp.key('a'), interval '-1 day');  -- held back below, until the race is done
  perform pg_temp.refused($q$select public.background_job_add('Knowledge Pack', 'k', 's', '{}')$q$, '22023', 'a kind out of shape', 'Kind');
  perform pg_temp.refused($q$select public.background_job_add('knowledge-pack', '  ', 's', '{}')$q$, '22023', 'an empty key', 'Key');
  perform pg_temp.refused($q$select public.background_job_add('knowledge-pack', 'k', '', '{}')$q$, '22023', 'an empty subject', 'Subject');
  perform pg_temp.refused($q$select public.background_job_add('knowledge-pack', 'k', 's', '[]')$q$, '22023', 'a payload not an object', 'Payload');
  perform pg_temp.refused($q$select public.background_job_add('knowledge-pack', 'k', 's', null)$q$, '22023', 'no payload', 'Payload');
end $$;

-- ── A claim hands out the jobs due, adds a try, and holds them ──
do $$
declare
  j public.background_jobs;
begin
  if pg_temp.claimed() <> pg_temp.key('a') then
    raise exception 'FAIL: the claim did not hand out the one job due';
  end if;
  j := (select c from public.background_jobs c where c.kind = 'other-kind');
  if j.state <> 'running' or j.tries <> 1 or j.claim is null or j.claimed_at <> now() or j.claimed_until <> now() + interval '60 seconds' then
    raise exception 'FAIL: a claimed job is not running, one try, held 60 seconds: %', j;
  end if;
  if pg_temp.claimed() <> 'none' then
    raise exception 'FAIL: a held job was handed out again';
  end if;
  perform public.background_job_finish(j.id, j.claim, 'done', null, null);
  perform pg_temp.refused($q$select * from public.background_job_claim(0, 60)$q$, '22023', 'a limit of 0', 'Limit');
  perform pg_temp.refused($q$select * from public.background_job_claim(1, 5)$q$, '22023', 'a lease of 5 seconds', 'Lease');
end $$;

-- ── A claim that ran out is due again, writes `lost`, and the stale claim cannot finish ──
do $$
declare
  first  public.background_jobs;
  second public.background_jobs;
begin
  perform pg_temp.due_since(pg_temp.key('a'), interval '0');
  perform pg_temp.claimed();
  first := pg_temp.job(pg_temp.key('a'));
  perform pg_temp.expire(pg_temp.key('a'));
  if pg_temp.claimed() <> pg_temp.key('a') then
    raise exception 'FAIL: a job whose claim ran out was not handed out again';
  end if;
  second := pg_temp.job(pg_temp.key('a'));
  if second.tries <> 2 or second.claim = first.claim or pg_temp.tries_of(pg_temp.key('a')) <> '1:lost' then
    raise exception 'FAIL: the claim that ran out did not write its lost try and a new claim: % %', second, pg_temp.tries_of(pg_temp.key('a'));
  end if;
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''done'', null, null)', first.id, first.claim),
    '55000', 'the worker presumed dead finishing', 'no longer held');
  if public.background_job_finish(second.id, second.claim, 'done', null, null) <> 'done' then
    raise exception 'FAIL: the claim that replaced it did not finish';
  end if;
  second := pg_temp.job(pg_temp.key('a'));
  if second.state <> 'done' or second.finished_at is null or second.claim is not null or pg_temp.tries_of(pg_temp.key('a')) <> '1:lost 2:done' then
    raise exception 'FAIL: the job is not done with its lost try then its done try: % %', second, pg_temp.tries_of(pg_temp.key('a'));
  end if;
  -- A finished job's claim cannot finish it again.
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''failed'', ''late'', null)', second.id, first.claim),
    '55000', 'a finished job finished again');
  perform pg_temp.refused(format('select public.background_job_finish(%L, null, ''done'', null, null)', second.id), '55000', 'no claim');
  perform pg_temp.refused($q$select public.background_job_finish(gen_random_uuid(), gen_random_uuid(), 'done', null, null)$q$, 'P0002', 'no such job');
end $$;

-- ── The 5th lost claim is failed ──
do $$
declare
  j public.background_jobs;
begin
  perform public.background_job_add('knowledge-pack', pg_temp.key('b'), 'initech/pack-api', '{}');
  for n in 1..5 loop
    if pg_temp.claimed() <> pg_temp.key('b') then
      raise exception 'FAIL: the job was not handed out for its try %', n;
    end if;
    perform pg_temp.expire(pg_temp.key('b'));
  end loop;
  if pg_temp.claimed() <> 'none' then
    raise exception 'FAIL: a job that lost its 5th claim was handed out again';
  end if;
  j := pg_temp.job(pg_temp.key('b'));
  if j.state <> 'failed' or j.tries <> 5 or j.reason is null or j.finished_at is null or j.claim is not null
     or pg_temp.tries_of(pg_temp.key('b')) <> '1:lost 2:lost 3:lost 4:lost 5:lost' then
    raise exception 'FAIL: the 5th lost claim did not fail the job with five lost tries: % %', j, pg_temp.tries_of(pg_temp.key('b'));
  end if;
end $$;

-- ── Each outcome moves the job ──
do $$
declare
  j public.background_jobs;
begin
  -- skipped, with why.
  perform public.background_job_add('knowledge-pack', pg_temp.key('c'), 'initech/pack-web', '{}');
  perform pg_temp.claimed();
  j := pg_temp.job(pg_temp.key('c'));
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''skipped'', ''  '', null)', j.id, j.claim), '22023', 'a skip with no why', 'Reason');
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''lost'', null, null)', j.id, j.claim), '22023', 'a worker writing lost', 'Outcome');
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''retry'', ''boom'', null)', j.id, j.claim), '22023', 'a retry with no time', 'Retry at');
  if public.background_job_finish(j.id, j.claim, 'skipped', 'it touches neither the knowledge folder nor the flow config', null) <> 'skipped' then
    raise exception 'FAIL: a skip did not answer skipped';
  end if;
  j := pg_temp.job(pg_temp.key('c'));
  if j.state <> 'skipped' or j.reason <> 'it touches neither the knowledge folder nor the flow config' or j.finished_at is null then
    raise exception 'FAIL: a skipped job does not say why: %', j;
  end if;

  -- retry: queued again at its time, the try kept, the error's first line in the attempt.
  perform public.background_job_add('knowledge-pack', pg_temp.key('d'), 'initech/pack-docs', '{}');
  perform pg_temp.claimed();
  j := pg_temp.job(pg_temp.key('d'));
  if public.background_job_finish(j.id, j.claim, 'retry', E'GitHub answered 502\n    at stack line', now() + interval '1 minute') <> 'queued' then
    raise exception 'FAIL: a retry did not answer queued';
  end if;
  j := pg_temp.job(pg_temp.key('d'));
  if j.state <> 'queued' or j.tries <> 1 or j.run_after <> now() + interval '1 minute' or j.claim is not null or j.finished_at is not null
     or (select a.error from public.background_job_attempts a where a.job_id = j.id) <> 'GitHub answered 502' then
    raise exception 'FAIL: a retry is not queued a minute later with its try and the error''s first line: %', j;
  end if;
  if pg_temp.claimed() <> 'none' then
    raise exception 'FAIL: a job waiting for its retry was handed out early';
  end if;

  -- waiting: queued again at its time, its try given back.
  perform pg_temp.due_since(pg_temp.key('d'), interval '0');
  perform pg_temp.claimed();
  j := pg_temp.job(pg_temp.key('d'));
  if j.tries <> 2 then
    raise exception 'FAIL: the second claim is not the second try: %', j;
  end if;
  if public.background_job_finish(j.id, j.claim, 'waiting', 'GitHub budget below its background floor', now() + interval '15 minutes') <> 'queued' then
    raise exception 'FAIL: waiting did not answer queued';
  end if;
  j := pg_temp.job(pg_temp.key('d'));
  if j.tries <> 1 or j.run_after <> now() + interval '15 minutes' or pg_temp.tries_of(pg_temp.key('d')) <> '1:retry 2:waiting' then
    raise exception 'FAIL: waiting did not give its try back and wait 15 minutes: % %', j, pg_temp.tries_of(pg_temp.key('d'));
  end if;

  -- retry on the 5th try: failed, with its error, five attempts.
  for n in 2..5 loop
    perform pg_temp.due_since(pg_temp.key('d'), interval '0');
    perform pg_temp.claimed();
    j := pg_temp.job(pg_temp.key('d'));
    perform public.background_job_finish(j.id, j.claim, 'retry', 'GitHub answered 502', now());
  end loop;
  j := pg_temp.job(pg_temp.key('d'));
  if j.state <> 'failed' or j.tries <> 5 or j.reason <> 'GitHub answered 502' or j.finished_at is null
     or pg_temp.tries_of(pg_temp.key('d')) <> '1:retry 2:waiting 2:retry 3:retry 4:retry 5:failed' then
    raise exception 'FAIL: a retry on the 5th try did not fail the job with its error: % %', j, pg_temp.tries_of(pg_temp.key('d'));
  end if;

  -- failed, directly, needs its error.
  perform public.background_job_add('knowledge-pack', pg_temp.key('e'), 'initech/pack-ops', '{}');
  perform pg_temp.claimed();
  j := pg_temp.job(pg_temp.key('e'));
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''failed'', null, null)', j.id, j.claim), '22023', 'a failure with no error', 'Reason');
  perform public.background_job_finish(j.id, j.claim, 'done', null, null);
end $$;

-- ── A replay keeps the attempts ──
do $$
declare
  j public.background_jobs;
begin
  j := public.background_job_replay((pg_temp.job(pg_temp.key('d'))).id);
  if j.state <> 'queued' or j.tries <> 0 or j.reason is not null or j.finished_at is not null or j.run_after > now()
     or pg_temp.tries_of(pg_temp.key('d')) <> '1:retry 2:waiting 2:retry 3:retry 4:retry 5:failed' then
    raise exception 'FAIL: a replay did not queue the job with no tries and keep its attempts: % %', j, pg_temp.tries_of(pg_temp.key('d'));
  end if;
  if pg_temp.claimed() <> pg_temp.key('d') or (pg_temp.job(pg_temp.key('d'))).tries <> 1 then
    raise exception 'FAIL: a replayed job was not handed out as its first try';
  end if;
  j := pg_temp.job(pg_temp.key('d'));
  perform public.background_job_finish(j.id, j.claim, 'failed', 'it failed again', null);
  perform pg_temp.refused(format('select public.background_job_replay(%L)', (pg_temp.job(pg_temp.key('a'))).id), '55000', 'replaying a done job', 'not failed');
  perform pg_temp.refused($q$select public.background_job_replay(gen_random_uuid())$q$, 'P0002', 'replaying no job');
end $$;

-- ── The health, in each case ──
do $$
begin
  -- Two failed jobs (b of pack-api, d of pack-docs), neither with a later done job of its repository.
  if pg_temp.health() <> '{"state": "late", "late": 0, "failed": 2, "scheduled": 0}'::jsonb then
    raise exception 'FAIL: two failed jobs with no later done job are not late: %', pg_temp.health();
  end if;
  -- pack-api's done job a finished before b failed: b still counts. Once a is later, b is answered.
  perform pg_temp.ended(pg_temp.key('a'), interval '2 hours');
  if (pg_temp.health() ->> 'failed')::integer <> 2 then
    raise exception 'FAIL: a done job finished before the failure answered it: %', pg_temp.health();
  end if;
  perform pg_temp.ended(pg_temp.key('b'), interval '3 hours');
  if (pg_temp.health() ->> 'failed')::integer <> 1 then
    raise exception 'FAIL: a later done job of the same repository did not answer the failure: %', pg_temp.health();
  end if;
  -- pack-docs answered too, by a later done job of its repository.
  perform public.background_job_add('knowledge-pack', pg_temp.key('f'), 'initech/pack-docs', '{}');
  perform pg_temp.claimed();
  perform public.background_job_finish((pg_temp.job(pg_temp.key('f'))).id, (pg_temp.job(pg_temp.key('f'))).claim, 'done', null, null);
  perform pg_temp.ended(pg_temp.key('d'), interval '1 hour');
  if pg_temp.health() <> '{"state": "ok", "late": 0, "failed": 0, "scheduled": 0}'::jsonb then
    raise exception 'FAIL: every failure answered is not ok: %', pg_temp.health();
  end if;
  -- A job due 30 minutes ago is not late; due over an hour ago, it is.
  perform public.background_job_add('knowledge-pack', pg_temp.key('g'), 'initech/pack-ops', '{}');
  perform pg_temp.due_since(pg_temp.key('g'), interval '30 minutes');
  if pg_temp.health() <> '{"state": "ok", "late": 0, "failed": 0, "scheduled": 0}'::jsonb then
    raise exception 'FAIL: a job due 30 minutes ago is late: %', pg_temp.health();
  end if;
  perform pg_temp.due_since(pg_temp.key('g'), interval '61 minutes');
  if pg_temp.health() <> '{"state": "late", "late": 1, "failed": 0, "scheduled": 0}'::jsonb then
    raise exception 'FAIL: a job due over an hour ago is not late: %', pg_temp.health();
  end if;
  -- Held by a claim that ran out over an hour ago: still late.
  perform pg_temp.claimed();
end $$;
reset role;
update public.background_jobs set claimed_until = now() - interval '61 minutes' where kind = 'knowledge-pack' and key = pg_temp.key('g');
set local role service_role;
do $$
begin
  if pg_temp.health() <> '{"state": "late", "late": 1, "failed": 0, "scheduled": 0}'::jsonb then
    raise exception 'FAIL: a claim that ran out over an hour ago is not late: %', pg_temp.health();
  end if;
end $$;

-- ── Forgetting keeps what is under 90 days ──
do $$
declare
  before integer;
begin
  perform pg_temp.ended(pg_temp.key('a'), interval '91 days');   -- done, 2 attempts
  perform pg_temp.ended(pg_temp.key('b'), interval '91 days');   -- failed, 5 attempts
  perform pg_temp.ended(pg_temp.key('c'), interval '89 days');   -- skipped, kept
  before := (select count(*) from public.background_job_attempts);
  if public.background_jobs_forget() <> 2 then
    raise exception 'FAIL: forgetting did not delete the two jobs finished over 90 days ago';
  end if;
  if (pg_temp.job(pg_temp.key('a'))).id is not null or (pg_temp.job(pg_temp.key('b'))).id is not null
     or (pg_temp.job(pg_temp.key('c'))).id is null or (pg_temp.job(pg_temp.key('g'))).id is null
     or (select count(*) from public.background_job_attempts) <> before - 7 then
    raise exception 'FAIL: forgetting did not delete exactly the old jobs with their attempts';
  end if;
  if public.background_jobs_forget() <> 0 then
    raise exception 'FAIL: forgetting twice deleted more';
  end if;
end $$;
reset role;

-- ── The refresh (PRD 2688 s1), from an empty ledger: the knowledge packs above are done with ──
delete from public.background_jobs;
set local role service_role;

-- ── None: added, due in 5 seconds; queued: the new payload, due 5 seconds from now, its tries kept ──
do $$
declare
  j public.background_jobs;
begin
  if pg_temp.refresh('pr-outbox', 'a') <> 'added' then
    raise exception 'FAIL: a first refresh did not add the job';
  end if;
  j := pg_temp.pr('pr-outbox');
  if j.state <> 'queued' or j.subject <> 'initech/pr-api' or j.payload <> '{"sha": "a"}' or j.tries <> 0 or j.again
     or j.run_after <> now() + interval '5 seconds' then
    raise exception 'FAIL: an added job is not queued, due in 5 seconds, of its payload and lower-case subject: %', j;
  end if;
  -- The same key of another kind is its own job; it is left alone by everything below.
  if pg_temp.refresh('pr-inbox', 'a') <> 'added' then
    raise exception 'FAIL: the same key of another kind was not added';
  end if;
  if pg_temp.kinds_claimed() <> 'none' then
    raise exception 'FAIL: a job due in 5 seconds was handed out now';
  end if;

  -- A try that threw: queued for its retry an hour later, one try spent.
  perform pg_temp.pr_due('pr-outbox', interval '0');
  if pg_temp.kinds_claimed() <> 'pr-outbox' then
    raise exception 'FAIL: the job due was not handed out';
  end if;
  j := pg_temp.pr('pr-outbox');
  perform public.background_job_finish(j.id, j.claim, 'retry', 'GitHub answered 502', now() + interval '1 hour');
  if pg_temp.refresh('pr-outbox', 'b') <> 'updated' then
    raise exception 'FAIL: a refresh of a queued job did not answer updated';
  end if;
  j := pg_temp.pr('pr-outbox');
  if j.state <> 'queued' or j.payload <> '{"sha": "b"}' or j.run_after <> now() + interval '5 seconds' or j.tries <> 1 or j.again
     or (select count(*) from public.background_jobs b where b.kind = 'pr-outbox') <> 1 then
    raise exception 'FAIL: a refreshed queued job is not one job of the new payload, due in 5 seconds, its try kept: %', j;
  end if;

  perform pg_temp.refused($q$select public.background_job_refresh('PR Outbox', 'k', 's', '{}', 5)$q$, '22023', 'a kind out of shape', 'Kind');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-outbox', ' ', 's', '{}', 5)$q$, '22023', 'an empty key', 'Key');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'k', '', '{}', 5)$q$, '22023', 'an empty subject', 'Subject');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'k', 's', '[]', 5)$q$, '22023', 'a payload not an object', 'Payload');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'k', 's', null, 5)$q$, '22023', 'no payload', 'Payload');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'k', 's', '{}', -1)$q$, '22023', 'a delay below 0', 'Delay');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'k', 's', '{}', 3601)$q$, '22023', 'a delay over an hour', 'Delay');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-outbox', 'k', 's', '{}', null)$q$, '22023', 'no delay', 'Delay');
end $$;

-- ── Running: the new payload and `again`; the try's finish, whatever its outcome, keeps its line and queues it at once ──
do $$
declare
  j     public.background_jobs;
  claim uuid;
begin
  perform pg_temp.pr_due('pr-outbox', interval '0');
  perform pg_temp.kinds_claimed();
  j := pg_temp.pr('pr-outbox');
  claim := j.claim;
  if pg_temp.refresh('pr-outbox', 'c') <> 'again' then
    raise exception 'FAIL: a refresh of a running job did not answer again';
  end if;
  j := pg_temp.pr('pr-outbox');
  if j.state <> 'running' or j.claim <> claim or j.tries <> 2 or j.payload <> '{"sha": "c"}' or not j.again then
    raise exception 'FAIL: a refreshed running job is not still held, of the new payload, holding again: %', j;
  end if;
  if pg_temp.kinds_claimed() <> 'none' then
    raise exception 'FAIL: a running job holding again was handed out while held';
  end if;

  -- done: its line kept, then queued at once, `again` cleared, its tries at zero.
  if public.background_job_finish(j.id, j.claim, 'done', null, null) <> 'queued' then
    raise exception 'FAIL: the finish of a job holding again did not answer queued';
  end if;
  j := pg_temp.pr('pr-outbox');
  if j.state <> 'queued' or j.again or j.tries <> 0 or j.run_after <> now() or j.claim is not null or j.reason is not null
     or j.finished_at is not null or j.payload <> '{"sha": "c"}' or pg_temp.pr_tries('pr-outbox') <> '1:retry 2:done' then
    raise exception 'FAIL: a done try holding again did not keep its line and queue the job at once: % %', j, pg_temp.pr_tries('pr-outbox');
  end if;

  -- retry: at once, not at its retry time.
  if pg_temp.kinds_claimed() <> 'pr-outbox' then
    raise exception 'FAIL: the job queued again was not handed out at once';
  end if;
  perform pg_temp.refresh('pr-outbox', 'd');
  j := pg_temp.pr('pr-outbox');
  if public.background_job_finish(j.id, j.claim, 'retry', 'GitHub answered 502', now() + interval '1 hour') <> 'queued' then
    raise exception 'FAIL: a retry holding again did not answer queued';
  end if;
  j := pg_temp.pr('pr-outbox');
  if j.state <> 'queued' or j.again or j.tries <> 0 or j.run_after <> now() or pg_temp.pr_tries('pr-outbox') <> '1:retry 2:done 1:retry' then
    raise exception 'FAIL: a retry holding again is not queued at once: % %', j, pg_temp.pr_tries('pr-outbox');
  end if;

  -- failed: queued, not failed, and no reason kept on the job; the line keeps the error.
  perform pg_temp.kinds_claimed();
  perform pg_temp.refresh('pr-outbox', 'e');
  j := pg_temp.pr('pr-outbox');
  if public.background_job_finish(j.id, j.claim, 'failed', 'it threw', null) <> 'queued' then
    raise exception 'FAIL: a failure holding again did not answer queued';
  end if;
  j := pg_temp.pr('pr-outbox');
  if j.state <> 'queued' or j.again or j.reason is not null or j.finished_at is not null or j.payload <> '{"sha": "e"}'
     or pg_temp.pr_tries('pr-outbox') <> '1:retry 2:done 1:retry 1:failed'
     or (select a.error from public.background_job_attempts a where a.job_id = j.id order by a.id desc limit 1) <> 'it threw' then
    raise exception 'FAIL: a failure holding again did not keep its line and queue the job: % %', j, pg_temp.pr_tries('pr-outbox');
  end if;

  -- With no refresh while it ran, a finish is as it always was.
  perform pg_temp.kinds_claimed();
  j := pg_temp.pr('pr-outbox');
  if public.background_job_finish(j.id, j.claim, 'done', null, null) <> 'done' or (pg_temp.pr('pr-outbox')).state <> 'done' then
    raise exception 'FAIL: a finish with no again did not end the job done: %', pg_temp.pr('pr-outbox');
  end if;
end $$;

-- ── Done, skipped or failed: queued again with the new payload, no tries, no reason; the attempts kept ──
do $$
declare
  j public.background_jobs;
begin
  -- done (pr-outbox, above).
  if pg_temp.refresh('pr-outbox', 'f') <> 'requeued' then
    raise exception 'FAIL: a refresh of a done job did not answer requeued';
  end if;
  j := pg_temp.pr('pr-outbox');
  if j.state <> 'queued' or j.tries <> 0 or j.reason is not null or j.finished_at is not null or j.payload <> '{"sha": "f"}'
     or j.run_after <> now() + interval '5 seconds' or j.again or pg_temp.pr_tries('pr-outbox') <> '1:retry 2:done 1:retry 1:failed 1:done' then
    raise exception 'FAIL: a refreshed done job is not queued in 5 seconds, its tries at zero and its attempts kept: % %', j, pg_temp.pr_tries('pr-outbox');
  end if;

  -- skipped.
  perform pg_temp.refresh('pr-approved', 'a');
  perform pg_temp.pr_due('pr-approved', interval '0');
  perform pg_temp.kinds_claimed();
  j := pg_temp.pr('pr-approved');
  perform public.background_job_finish(j.id, j.claim, 'skipped', 'not a loop pull request', null);
  if pg_temp.refresh('pr-approved', 'b') <> 'requeued' then
    raise exception 'FAIL: a refresh of a skipped job did not answer requeued';
  end if;
  j := pg_temp.pr('pr-approved');
  if j.state <> 'queued' or j.tries <> 0 or j.reason is not null or j.finished_at is not null or j.payload <> '{"sha": "b"}'
     or pg_temp.pr_tries('pr-approved') <> '1:skipped' then
    raise exception 'FAIL: a refreshed skipped job is not queued with no reason, its attempts kept: % %', j, pg_temp.pr_tries('pr-approved');
  end if;

  -- failed.
  perform pg_temp.refresh('pr-budgets', 'a');
  perform pg_temp.pr_due('pr-budgets', interval '0');
  perform pg_temp.kinds_claimed();
  j := pg_temp.pr('pr-budgets');
  perform public.background_job_finish(j.id, j.claim, 'failed', 'GitHub answered 502', null);
  if (pg_temp.pr('pr-budgets')).state <> 'failed' or pg_temp.refresh('pr-budgets', 'b') <> 'requeued' then
    raise exception 'FAIL: a refresh of a failed job did not answer requeued';
  end if;
  j := pg_temp.pr('pr-budgets');
  if j.state <> 'queued' or j.tries <> 0 or j.reason is not null or j.finished_at is not null or j.payload <> '{"sha": "b"}'
     or pg_temp.pr_tries('pr-budgets') <> '1:failed' then
    raise exception 'FAIL: a refreshed failed job is not queued with no tries and no reason, its attempts kept: % %', j, pg_temp.pr_tries('pr-budgets');
  end if;
end $$;

-- ── A claim that runs out on a job holding `again`: its lost line, then queued at once, even on its 5th try ──
do $$
declare
  j public.background_jobs;
begin
  for n in 1..5 loop
    perform pg_temp.pr_due('pr-approved', interval '0');
    if pg_temp.kinds_claimed() <> 'pr-approved' then
      raise exception 'FAIL: the job was not handed out for its try %', n;
    end if;
    if n < 5 then perform pg_temp.pr_expire('pr-approved'); end if;
  end loop;
  perform pg_temp.refresh('pr-approved', 'c');
  perform pg_temp.pr_expire('pr-approved');
  if pg_temp.kinds_claimed() <> 'pr-approved' then
    raise exception 'FAIL: a job holding again whose 5th claim ran out was not handed out again';
  end if;
  j := pg_temp.pr('pr-approved');
  if j.state <> 'running' or j.tries <> 1 or j.again or j.payload <> '{"sha": "c"}'
     or pg_temp.pr_tries('pr-approved') <> '1:skipped 1:lost 2:lost 3:lost 4:lost 5:lost' then
    raise exception 'FAIL: a lost claim holding again did not keep its line and queue the job as new: % %', j, pg_temp.pr_tries('pr-approved');
  end if;
end $$;

-- ── Another kind's job of the same key was never touched ──
do $$
declare
  j public.background_jobs;
begin
  j := pg_temp.pr('pr-inbox');
  if j.state <> 'queued' or j.payload <> '{"sha": "a"}' or j.tries <> 0 or j.again or j.run_after <> now() + interval '5 seconds'
     or pg_temp.pr_tries('pr-inbox') <> '' then
    raise exception 'FAIL: a refresh of another kind touched the job of the same key: %', j;
  end if;
end $$;
reset role;

-- ── `again` is held only while running ──
select pg_temp.refused($q$update public.background_jobs set again = true where kind = 'pr-inbox'$q$, '23514', 'again on a queued job');

-- ── Waiting and pacing (PRD omni-loop-3 s1), from an empty ledger ──
delete from public.background_jobs;

-- A job of kind k under key ky, its attempts as `try:outcome`, and what the owner may do to it.
create function pg_temp.kj(k text, ky text) returns public.background_jobs language sql security definer as $$
  select * from public.background_jobs j where j.kind = k and j.key = ky;
$$;
create function pg_temp.kj_tries(k text, ky text) returns text language sql security definer as $$
  select coalesce(string_agg(a.try || ':' || a.outcome, ' ' order by a.id), '')
    from public.background_job_attempts a join public.background_jobs j on j.id = a.job_id
   where j.kind = k and j.key = ky;
$$;
create function pg_temp.kj_due(k text, ky text, ago interval) returns void language sql security definer as $$
  update public.background_jobs j set run_after = now() - ago where j.kind = k and j.key = ky;
$$;
create function pg_temp.kj_expire(k text, ky text) returns void language sql security definer as $$
  update public.background_jobs j set claimed_until = now() - interval '1 second' where j.kind = k and j.key = ky;
$$;
create function pg_temp.kj_ended(k text, ky text, ago interval) returns void language sql security definer as $$
  update public.background_jobs j set finished_at = now() - ago where j.kind = k and j.key = ky;
$$;
-- The jobs claimed now, as `kind/key` in order; `none` when no job is due.
create function pg_temp.taken(lim integer default 10) returns text language sql as $$
  select coalesce(string_agg(c.kind || '/' || c.key, ' ' order by c.kind, c.key), 'none') from public.background_job_claim(lim, 60) c;
$$;
-- The `scheduled` count of the health, for the schedules given.
create function pg_temp.scheduled(kinds text[], periods integer[]) returns integer language sql as $$
  select (public.background_jobs_health(kinds, periods) ->> 'scheduled')::integer;
$$;

set local role service_role;

-- ── `later`: queued at its date with its progress, its try given back; a stale claim is still refused ──
do $$
declare
  j     public.background_jobs;
  stale uuid;
begin
  perform public.background_job_add('fleet-board', 'initech/web#7', 'initech/web', '{"pr": 7}', null, 4);
  if pg_temp.taken() <> 'fleet-board/initech/web#7' then
    raise exception 'FAIL: the fleet board job was not handed out';
  end if;
  j := pg_temp.kj('fleet-board', 'initech/web#7');
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''later'', null, null, ''{}'')', j.id, j.claim),
    '22023', 'a later with no date', 'Retry at');
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''later'', null, now(), ''[]'')', j.id, j.claim),
    '22023', 'a progress not an object', 'Progress');
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''later'', null, now(), jsonb_build_object(''x'', repeat(''a'', 4100)))', j.id, j.claim),
    '22023', 'a progress too big', 'Progress');
  if public.background_job_finish(j.id, j.claim, 'later', null, now() + interval '1 minute', '{"look": 1}') <> 'queued' then
    raise exception 'FAIL: a later did not answer queued';
  end if;
  j := pg_temp.kj('fleet-board', 'initech/web#7');
  if j.state <> 'queued' or j.tries <> 0 or j.laters <> 1 or j.progress <> '{"look": 1}' or j.run_after <> now() + interval '1 minute'
     or j.claim is not null or j.finished_at is not null or j.reason is not null or j.payload <> '{"pr": 7}'
     or pg_temp.kj_tries('fleet-board', 'initech/web#7') <> '1:later'
     or (select a.error from public.background_job_attempts a where a.job_id = j.id) is not null then
    raise exception 'FAIL: a later is not queued a minute on with its progress and its try given back: % %', j, pg_temp.kj_tries('fleet-board', 'initech/web#7');
  end if;
  if pg_temp.taken() <> 'none' then
    raise exception 'FAIL: a job that asked to run later was handed out early';
  end if;

  -- Its next run reads its progress; a claim that ran out, and the stale claim's later refused.
  perform pg_temp.kj_due('fleet-board', 'initech/web#7', interval '0');
  perform pg_temp.taken();
  j := pg_temp.kj('fleet-board', 'initech/web#7');
  if j.tries <> 1 or j.progress <> '{"look": 1}' then
    raise exception 'FAIL: the run after a later is not its first try with its progress: %', j;
  end if;
  stale := j.claim;
  perform pg_temp.kj_expire('fleet-board', 'initech/web#7');
  perform pg_temp.taken();
  perform pg_temp.refused(format('select public.background_job_finish(%L, %L, ''later'', null, now(), ''{"look": 2}'')', j.id, stale),
    '55000', 'a stale claim asking to run later', 'no longer held');
  j := pg_temp.kj('fleet-board', 'initech/web#7');
  if j.progress <> '{"look": 1}' or j.laters <> 1 then
    raise exception 'FAIL: a stale later changed the job: %', j;
  end if;
  perform public.background_job_finish(j.id, j.claim, 'later', null, now(), '{"look": 2}');
end $$;

-- ── The 21st `later` fails the job; a replay starts it afresh ──
do $$
declare
  j public.background_jobs;
begin
  -- Two laters above; eighteen more make twenty.
  for n in 3..20 loop
    perform pg_temp.kj_due('fleet-board', 'initech/web#7', interval '0');
    perform pg_temp.taken();
    j := pg_temp.kj('fleet-board', 'initech/web#7');
    if public.background_job_finish(j.id, j.claim, 'later', null, now(), jsonb_build_object('look', n)) <> 'queued' then
      raise exception 'FAIL: later number % did not answer queued', n;
    end if;
  end loop;
  j := pg_temp.kj('fleet-board', 'initech/web#7');
  if j.state <> 'queued' or j.laters <> 20 or j.tries <> 1 or j.progress <> '{"look": 20}' then
    raise exception 'FAIL: twenty laters did not leave the job queued with its progress: %', j;
  end if;
  perform pg_temp.kj_due('fleet-board', 'initech/web#7', interval '0');
  perform pg_temp.taken();
  j := pg_temp.kj('fleet-board', 'initech/web#7');
  if public.background_job_finish(j.id, j.claim, 'later', null, now(), '{"look": 21}') <> 'failed' then
    raise exception 'FAIL: the 21st later did not fail the job';
  end if;
  j := pg_temp.kj('fleet-board', 'initech/web#7');
  if j.state <> 'failed' or j.reason <> 'it asked to run later more than 20 times' or j.finished_at is null or j.laters <> 20
     or j.progress <> '{"look": 20}' or pg_temp.kj_tries('fleet-board', 'initech/web#7') !~ ' 2:failed$' then
    raise exception 'FAIL: the 21st later is not a failure saying why: % %', j, pg_temp.kj_tries('fleet-board', 'initech/web#7');
  end if;
  j := public.background_job_replay(j.id);
  if j.state <> 'queued' or j.tries <> 0 or j.laters <> 0 or j.progress <> '{}' then
    raise exception 'FAIL: a replay did not reset the laters and the progress with the tries: %', j;
  end if;
  perform pg_temp.kj_due('fleet-board', 'initech/web#7', interval '-1 day');  -- held back
end $$;

-- ── `later` on a job holding `again`: its line kept, then queued at once, afresh ──
do $$
declare
  j public.background_jobs;
begin
  perform public.background_job_refresh('pr-approved', 'initech/web#8', 'initech/web', '{"sha": "a"}', 0);
  if pg_temp.taken() <> 'pr-approved/initech/web#8' then
    raise exception 'FAIL: the refreshed job was not handed out';
  end if;
  perform public.background_job_refresh('pr-approved', 'initech/web#8', 'initech/web', '{"sha": "b"}', 0);
  j := pg_temp.kj('pr-approved', 'initech/web#8');
  if public.background_job_finish(j.id, j.claim, 'later', null, now() + interval '1 hour', '{"look": 2}') <> 'queued' then
    raise exception 'FAIL: a later holding again did not answer queued';
  end if;
  j := pg_temp.kj('pr-approved', 'initech/web#8');
  if j.state <> 'queued' or j.again or j.tries <> 0 or j.laters <> 0 or j.progress <> '{}' or j.run_after <> now()
     or j.payload <> '{"sha": "b"}' or pg_temp.kj_tries('pr-approved', 'initech/web#8') <> '1:later' then
    raise exception 'FAIL: a later holding again did not keep its line and queue the job at once, afresh: % %', j, pg_temp.kj_tries('pr-approved', 'initech/web#8');
  end if;
  perform pg_temp.kj_due('pr-approved', 'initech/web#8', interval '-1 day');  -- held back
end $$;

-- ── Each job has its own tries: 5 when not given ──
do $$
declare
  j public.background_jobs;
begin
  perform public.background_job_add('knowledge-pack', 'initech/api@1', 'initech/api', '{}');
  perform public.background_job_add('pr-stats', 'pr-stats@2027-01-15T09:00:00.000Z', 'pr-stats', '{}', 'pr-stats', 3);
  if (pg_temp.kj('knowledge-pack', 'initech/api@1')).max_tries <> 5 or (pg_temp.kj('knowledge-pack', 'initech/api@1')).lane is not null
     or (pg_temp.kj('pr-stats', 'pr-stats@2027-01-15T09:00:00.000Z')).max_tries <> 3
     or (pg_temp.kj('pr-stats', 'pr-stats@2027-01-15T09:00:00.000Z')).lane <> 'pr-stats' then
    raise exception 'FAIL: a job added is not of the tries and lane it was given, 5 and none when not given';
  end if;
  perform pg_temp.refused($q$select public.background_job_add('pr-stats', 'k', 's', '{}', null, 0)$q$, '22023', 'no tries', 'Max tries');
  perform pg_temp.refused($q$select public.background_job_add('pr-stats', 'k', 's', '{}', null, 6)$q$, '22023', 'six tries', 'Max tries');
  perform pg_temp.refused($q$select public.background_job_refresh('pr-stats', 'k', 's', '{}', 0, null, 6)$q$, '22023', 'six tries refreshed', 'Max tries');
  perform pg_temp.refused(format('select public.background_job_add(''pr-stats'', ''k'', ''s'', ''{}'', %L)', repeat('l', 513)), '22023', 'a lane too long', 'Lane');
  perform pg_temp.kj_due('knowledge-pack', 'initech/api@1', interval '-1 day');  -- held back: not part of what follows

  -- The 3rd lost claim of a job of 3 tries fails it.
  for n in 1..3 loop
    if pg_temp.taken() <> 'pr-stats/pr-stats@2027-01-15T09:00:00.000Z' then
      raise exception 'FAIL: the job of 3 tries was not handed out for its try %', n;
    end if;
    perform pg_temp.kj_expire('pr-stats', 'pr-stats@2027-01-15T09:00:00.000Z');
  end loop;
  if pg_temp.taken() <> 'none' then
    raise exception 'FAIL: a job that lost its last claim was handed out again';
  end if;
  j := pg_temp.kj('pr-stats', 'pr-stats@2027-01-15T09:00:00.000Z');
  if j.state <> 'failed' or j.tries <> 3 or j.reason <> 'its claim ran out on its last try'
     or pg_temp.kj_tries('pr-stats', 'pr-stats@2027-01-15T09:00:00.000Z') <> '1:lost 2:lost 3:lost' then
    raise exception 'FAIL: the 3rd lost claim did not fail a job of 3 tries: % %', j, pg_temp.kj_tries('pr-stats', 'pr-stats@2027-01-15T09:00:00.000Z');
  end if;

  -- A retry on the 3rd try of a job of 3 tries fails it.
  perform public.background_job_add('escalation', 'escalation@2027-01-15T09:00:00.000Z', 'escalation', '{}', 'escalation', 3);
  for n in 1..3 loop
    perform pg_temp.kj_due('escalation', 'escalation@2027-01-15T09:00:00.000Z', interval '0');
    perform pg_temp.taken();
    j := pg_temp.kj('escalation', 'escalation@2027-01-15T09:00:00.000Z');
    perform public.background_job_finish(j.id, j.claim, 'retry', 'GitHub answered 502', now());
  end loop;
  j := pg_temp.kj('escalation', 'escalation@2027-01-15T09:00:00.000Z');
  if j.state <> 'failed' or j.tries <> 3 or pg_temp.kj_tries('escalation', 'escalation@2027-01-15T09:00:00.000Z') <> '1:retry 2:retry 3:failed' then
    raise exception 'FAIL: a retry on the 3rd try did not fail a job of 3 tries: % %', j, pg_temp.kj_tries('escalation', 'escalation@2027-01-15T09:00:00.000Z');
  end if;

  -- A refresh adds with its tries and lane; a later refresh moves the lane, never the tries.
  if public.background_job_refresh('canon-action', 'delivery-1', 'initech/web', '{}', 0, 'initech/web#9', 2) <> 'added' then
    raise exception 'FAIL: a refresh with a lane and tries did not add the job';
  end if;
  perform public.background_job_refresh('canon-action', 'delivery-1', 'initech/web', '{}', 0, 'initech/web#10', 4);
  j := pg_temp.kj('canon-action', 'delivery-1');
  if j.max_tries <> 2 or j.lane <> 'initech/web#10' then
    raise exception 'FAIL: a refresh changed the tries, or kept the old lane: %', j;
  end if;
  perform pg_temp.kj_due('canon-action', 'delivery-1', interval '-1 day');  -- held back
end $$;

-- ── One job of a kind and lane runs at a time ──
do $$
declare
  j public.background_jobs;
begin
  perform public.background_job_add('pr-stats', 'pr-stats@a', 'pr-stats', '{}', 'pr-stats', 3);
  perform public.background_job_add('pr-stats', 'pr-stats@b', 'pr-stats', '{}', 'pr-stats', 3);
  perform public.background_job_add('pr-stats', 'pr-stats@c', 'pr-stats', '{}', 'another', 3);
  perform public.background_job_add('pr-stats', 'pr-stats@d', 'pr-stats', '{}');
  perform public.background_job_add('escalation', 'escalation@a', 'escalation', '{}', 'pr-stats', 3);
  perform pg_temp.kj_due('pr-stats', 'pr-stats@a', interval '2 minutes');
  perform pg_temp.kj_due('pr-stats', 'pr-stats@b', interval '1 minute');
  -- In one claim: the oldest of the lane, not its second; another lane, no lane and another kind of the same lane run.
  if pg_temp.taken() <> 'escalation/escalation@a pr-stats/pr-stats@a pr-stats/pr-stats@c pr-stats/pr-stats@d' then
    raise exception 'FAIL: one claim did not hand out one job of the lane, and the others';
  end if;
  -- While a@ runs, b@ waits.
  perform pg_temp.kj_due('pr-stats', 'pr-stats@b', interval '1 hour');
  if pg_temp.taken() <> 'none' then
    raise exception 'FAIL: a job was handed out while another of its kind and lane ran';
  end if;
  j := pg_temp.kj('pr-stats', 'pr-stats@a');
  perform public.background_job_finish(j.id, j.claim, 'done', null, null);
  if pg_temp.taken() <> 'pr-stats/pr-stats@b' then
    raise exception 'FAIL: the job of the lane was not handed out once the running one finished';
  end if;
  -- A claim that ran out frees the lane: the job is due again, and it is the one handed out.
  perform public.background_job_add('pr-stats', 'pr-stats@e', 'pr-stats', '{}', 'pr-stats', 3);
  perform pg_temp.kj_expire('pr-stats', 'pr-stats@b');
  if pg_temp.taken(1) <> 'pr-stats/pr-stats@b' then
    raise exception 'FAIL: a lost claim of the lane was not handed out again before the next job of the lane';
  end if;
end $$;
reset role;
-- The database holds the lane too: two running jobs of one kind and lane are refused.
select pg_temp.refused($q$update public.background_jobs set state = 'running', claim = gen_random_uuid(), claimed_at = now(),
  claimed_until = now() + interval '1 minute' where kind = 'pr-stats' and key = 'pr-stats@e'$q$, '23505', 'two running jobs of one lane');
set local role service_role;

-- ── A schedule with no done job for three periods is late ──
do $$
begin
  -- pr-stats@a is done just now; the escalation of the lane has none yet.
  if pg_temp.scheduled(array['pr-stats'], array[900]) <> 0 then
    raise exception 'FAIL: a schedule with a done job just now is late';
  end if;
  if pg_temp.scheduled(array['pr-stats', 'escalation'], array[900, 3600]) <> 1 then
    raise exception 'FAIL: a schedule whose kind has no done job is not late';
  end if;
  if (public.background_jobs_health(array['escalation'], array[3600]) ->> 'state') <> 'late' then
    raise exception 'FAIL: a late schedule does not make the health late';
  end if;
  if pg_temp.scheduled(array['escalation'], array[0]) <> 0 or (pg_temp.health() ->> 'scheduled')::integer <> 0 then
    raise exception 'FAIL: a schedule of no period, or no schedule, counted';
  end if;
  perform pg_temp.kj_ended('pr-stats', 'pr-stats@a', interval '44 minutes');
  if pg_temp.scheduled(array['pr-stats'], array[900]) <> 0 then
    raise exception 'FAIL: a done job 44 minutes ago made a schedule of 15 minutes late';
  end if;
  perform pg_temp.kj_ended('pr-stats', 'pr-stats@a', interval '46 minutes');
  if pg_temp.scheduled(array['pr-stats'], array[900]) <> 1 then
    raise exception 'FAIL: no done job for 46 minutes did not make a schedule of 15 minutes late';
  end if;
  -- A failed or skipped job is no run: the escalation's failure above does not answer it.
  perform pg_temp.kj_ended('pr-stats', 'pr-stats@a', interval '2 hours 59 minutes');
  if pg_temp.scheduled(array['pr-stats'], array[3600]) <> 0 then
    raise exception 'FAIL: a done job 2 hours 59 minutes ago made an hourly schedule late';
  end if;
end $$;
reset role;

rollback;

-- ── Two workers at once never hold one job ──
-- Two sessions through dblink claim at once. Job q is due; job r is held by a claim that ran out. The first
-- session writes r's lost try and claims both, holding them uncommitted; the second runs while it does, skips
-- both locked rows and gets none: one lost line, one holder each. A second session that waits on the locks
-- instead fails on its lock timeout. The setup is committed through a third session, for the other two to see,
-- and deleted at the end.
begin;
create extension if not exists dblink schema extensions;
do $$
declare
  link     constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  setup    constant text := $s$
    delete from public.background_jobs where kind = 'check-race';
    insert into public.background_jobs (kind, key, subject, created_at) values ('check-race', 'q', 'initech/race', now() - interval '1 minute');
    insert into public.background_jobs (kind, key, subject, state, tries, claim, claimed_at, claimed_until)
    values ('check-race', 'r', 'initech/race', 'running', 1, gen_random_uuid(), now() - interval '10 minutes', now() - interval '5 minutes');
  $s$;
  teardown constant text := $s$delete from public.background_jobs where kind = 'check-race'$s$;
  claim    constant text := $s$select coalesce((select string_agg(c.key, ' ' order by c.key) from public.background_job_claim(10, 60) c where c.kind = 'check-race'), 'none')$s$;
  first    text;
  second   text;
  held     text;
begin
  perform extensions.dblink_connect('bj_setup', link);
  perform extensions.dblink_exec('bj_setup', setup);
  perform extensions.dblink_connect('bj_one', link);
  perform extensions.dblink_connect('bj_two', link);
  begin
    perform extensions.dblink_exec('bj_one', 'begin; set local role service_role');
    -- A claim that waited on the first session's locks instead of skipping them fails here, not hangs.
    perform extensions.dblink_exec('bj_two', 'begin; set local role service_role; set local lock_timeout = ''3s''');
    select r into first from extensions.dblink('bj_one', claim) as t (r text);
    select r into second from extensions.dblink('bj_two', claim) as t (r text);
    perform extensions.dblink_exec('bj_one', 'commit');
    perform extensions.dblink_exec('bj_two', 'commit');
    if first <> 'q r' or second <> 'none' then
      raise exception 'FAIL: two workers at once claimed "%" and "%", not both jobs and nothing', first, second;
    end if;
    select h into held from extensions.dblink('bj_setup', $s$
      select string_agg(j.key || ':' || j.state || ':' || j.tries || ':' ||
                        (select count(*) from public.background_job_attempts a where a.job_id = j.id and a.outcome = 'lost'),
                        ' ' order by j.key)
        from public.background_jobs j where j.kind = 'check-race'$s$) as t (h text);
    if held <> 'q:running:1:0 r:running:2:1' then
      raise exception 'FAIL: the race did not leave each job held once and one lost try: %', held;
    end if;
  exception when others then
    perform extensions.dblink_disconnect('bj_one');
    perform extensions.dblink_disconnect('bj_two');
    perform extensions.dblink_exec('bj_setup', teardown);
    perform extensions.dblink_disconnect('bj_setup');
    raise;
  end;
  perform extensions.dblink_disconnect('bj_one');
  perform extensions.dblink_disconnect('bj_two');
  perform extensions.dblink_exec('bj_setup', teardown);
  perform extensions.dblink_disconnect('bj_setup');
end $$;
rollback;

-- ── A refresh racing a claim waits for it, then holds `again`: the new head commit is never lost (PRD 2688 s1) ──
-- Job p is due. The first session claims it and holds it uncommitted; the second refreshes it meanwhile, and
-- must wait for the claim rather than read the job as still queued. Once the claim commits, the refresh answers
-- `again`, and the job is running, of the new payload, holding again. Set up and torn down as above.
begin;
create extension if not exists dblink schema extensions;
do $$
declare
  link      constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  setup     constant text := $s$
    delete from public.background_jobs where kind = 'check-refresh-race';
    insert into public.background_jobs (kind, key, subject, payload, created_at)
    values ('check-refresh-race', 'p', 'initech/race', '{"sha": "old"}', now() - interval '1 minute');
  $s$;
  teardown  constant text := $s$delete from public.background_jobs where kind = 'check-refresh-race'$s$;
  claim     constant text := $s$select coalesce((select string_agg(c.key, ' ') from public.background_job_claim(10, 60) c where c.kind = 'check-refresh-race'), 'none')$s$;
  refresh   constant text := $s$select public.background_job_refresh('check-refresh-race', 'p', 'initech/race', '{"sha": "new"}', 5)$s$;
  claimed   text;
  refreshed text;
  held      text;
begin
  perform extensions.dblink_connect('bjr_setup', link);
  perform extensions.dblink_exec('bjr_setup', setup);
  perform extensions.dblink_connect('bjr_one', link);
  perform extensions.dblink_connect('bjr_two', link);
  begin
    perform extensions.dblink_exec('bjr_one', 'begin; set local role service_role');
    perform extensions.dblink_exec('bjr_two', 'begin; set local role service_role; set local lock_timeout = ''10s''');
    select r into claimed from extensions.dblink('bjr_one', claim) as t (r text);
    perform extensions.dblink_send_query('bjr_two', refresh);
    perform pg_sleep(0.3);
    if extensions.dblink_is_busy('bjr_two') <> 1 then
      raise exception 'FAIL: a refresh did not wait for the claim holding the job';
    end if;
    perform extensions.dblink_exec('bjr_one', 'commit');
    select r into refreshed from extensions.dblink_get_result('bjr_two') as t (r text);
    perform r from extensions.dblink_get_result('bjr_two') as t (r text);
    perform extensions.dblink_exec('bjr_two', 'commit');
    select h into held from extensions.dblink('bjr_setup', $s$
      select j.state || ':' || j.tries || ':' || j.again || ':' || (j.payload ->> 'sha')
        from public.background_jobs j where j.kind = 'check-refresh-race'$s$) as t (h text);
    if claimed <> 'p' or refreshed <> 'again' or held <> 'running:1:true:new' then
      raise exception 'FAIL: a refresh racing a claim answered "%" on "%", leaving %, not again on a running job of the new payload',
        refreshed, claimed, held;
    end if;
  exception when others then
    perform extensions.dblink_disconnect('bjr_one');
    perform extensions.dblink_disconnect('bjr_two');
    perform extensions.dblink_exec('bjr_setup', teardown);
    perform extensions.dblink_disconnect('bjr_setup');
    raise;
  end;
  perform extensions.dblink_disconnect('bjr_one');
  perform extensions.dblink_disconnect('bjr_two');
  perform extensions.dblink_exec('bjr_setup', teardown);
  perform extensions.dblink_disconnect('bjr_setup');
end $$;
rollback;

-- ── Two claims at once never both take a job of one kind and lane (PRD omni-loop-3 s1) ──
-- Jobs x and y are due, in one lane. The first session claims and holds x uncommitted; the second runs while it
-- does: x is locked, and y's lane is held by the first claim, so it gets none. Once both commit, x runs and y
-- waits. Set up and torn down as above.
begin;
create extension if not exists dblink schema extensions;
do $$
declare
  link     constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  setup    constant text := $s$
    delete from public.background_jobs where kind = 'check-lane-race';
    insert into public.background_jobs (kind, key, subject, lane, created_at) values
      ('check-lane-race', 'x', 'initech/race', 'one', now() - interval '2 minutes'),
      ('check-lane-race', 'y', 'initech/race', 'one', now() - interval '1 minute');
  $s$;
  teardown constant text := $s$delete from public.background_jobs where kind = 'check-lane-race'$s$;
  claim    constant text := $s$select coalesce((select string_agg(c.key, ' ' order by c.key) from public.background_job_claim(10, 60) c where c.kind = 'check-lane-race'), 'none')$s$;
  first    text;
  second   text;
  held     text;
begin
  perform extensions.dblink_connect('bjl_setup', link);
  perform extensions.dblink_exec('bjl_setup', setup);
  perform extensions.dblink_connect('bjl_one', link);
  perform extensions.dblink_connect('bjl_two', link);
  begin
    perform extensions.dblink_exec('bjl_one', 'begin; set local role service_role');
    perform extensions.dblink_exec('bjl_two', 'begin; set local role service_role; set local lock_timeout = ''3s''');
    select r into first from extensions.dblink('bjl_one', claim) as t (r text);
    select r into second from extensions.dblink('bjl_two', claim) as t (r text);
    perform extensions.dblink_exec('bjl_one', 'commit');
    perform extensions.dblink_exec('bjl_two', 'commit');
    if first <> 'x' or second <> 'none' then
      raise exception 'FAIL: two claims at once of one lane took "%" and "%", not x and nothing', first, second;
    end if;
    select h into held from extensions.dblink('bjl_setup', $s$
      select string_agg(j.key || ':' || j.state, ' ' order by j.key) from public.background_jobs j where j.kind = 'check-lane-race'$s$) as t (h text);
    if held <> 'x:running y:queued' then
      raise exception 'FAIL: the lane race did not leave x running and y queued: %', held;
    end if;
  exception when others then
    perform extensions.dblink_disconnect('bjl_one');
    perform extensions.dblink_disconnect('bjl_two');
    perform extensions.dblink_exec('bjl_setup', teardown);
    perform extensions.dblink_disconnect('bjl_setup');
    raise;
  end;
  perform extensions.dblink_disconnect('bjl_one');
  perform extensions.dblink_disconnect('bjl_two');
  perform extensions.dblink_exec('bjl_setup', teardown);
  perform extensions.dblink_disconnect('bjl_setup');
end $$;
rollback;

select 'background jobs checks passed' as result;
