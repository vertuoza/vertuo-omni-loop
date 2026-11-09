-- The job ledger (PRD 2676 s1). The supabase workflow runs it on every pull request, after `supabase db start`
-- has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/background_jobs.sql
-- One job per key; a claim hands out the jobs due and adds a try; a claim that ran out is due again and
-- writes `lost`, and the 5th lost claim is `failed`; a stale claim cannot finish; each outcome moves the job,
-- `waiting` giving its try back and a 5th `retry` failing it; a replay keeps the attempts;
-- background_jobs_health() in each case, with counts and no name; forgetting keeps what is under 90 days;
-- two workers at once never hold one job; nobody but the service role reads or calls any of it.
-- One transaction, rolled back at the end, then the race through dblink. Any `FAIL:` stops the run.

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

-- ── Nobody but the service role reads or calls any of it ──
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.background_job_add(text, text, text, jsonb)', 'public.background_job_claim(integer, integer)',
    'public.background_job_finish(uuid, uuid, text, text, timestamptz)', 'public.background_job_replay(uuid)',
    'public.background_jobs_health()', 'public.background_jobs_forget()'] loop
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
reset role;
set local role anon;
select pg_temp.refused($q$select 1 from public.background_job_attempts$q$, '42501', 'anon reading the attempts');
select pg_temp.refused($q$select public.background_jobs_forget()$q$, '42501', 'anon forgetting the jobs');
reset role;

set local role service_role;

-- ── Nothing yet: ok ──
do $$
begin
  if pg_temp.health() <> '{"state": "ok", "late": 0, "failed": 0}'::jsonb then
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
  if pg_temp.health() <> '{"state": "late", "late": 0, "failed": 2}'::jsonb then
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
  if pg_temp.health() <> '{"state": "ok", "late": 0, "failed": 0}'::jsonb then
    raise exception 'FAIL: every failure answered is not ok: %', pg_temp.health();
  end if;
  -- A job due 30 minutes ago is not late; due over an hour ago, it is.
  perform public.background_job_add('knowledge-pack', pg_temp.key('g'), 'initech/pack-ops', '{}');
  perform pg_temp.due_since(pg_temp.key('g'), interval '30 minutes');
  if pg_temp.health() <> '{"state": "ok", "late": 0, "failed": 0}'::jsonb then
    raise exception 'FAIL: a job due 30 minutes ago is late: %', pg_temp.health();
  end if;
  perform pg_temp.due_since(pg_temp.key('g'), interval '61 minutes');
  if pg_temp.health() <> '{"state": "late", "late": 1, "failed": 0}'::jsonb then
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
  if pg_temp.health() <> '{"state": "late", "late": 1, "failed": 0}'::jsonb then
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

select 'background jobs checks passed' as result;
