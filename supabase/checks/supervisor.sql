-- The Supervisor's store (PRD omni-loop-34 s1). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/supervisor.sql
-- Initech holds a seat on its runner atlas-01; Acme has a runner of its own. A member of Initech reads its seat, signals,
-- findings, proposals, threads, memory and errors, and acts on none of them; an owner places and moves the seat, pauses it,
-- writes in a thread, presses a suggestion once, dismisses a finding once, deletes a note and clears memory, and a clear
-- keeps every finding, proposal and message (AC-5). A stranger, an account of no workspace and anon read and do nothing.
-- One open signal per fingerprint; at most two suggestions per finding, each an action the App already has; no proposal
-- is changed or deleted (BR-PRODUCT-12). Memory keeps at most 100 short-term notes. The hourly sweep forgets short-term
-- notes past 24 h, signals closed 30 days ago, messages older than 90 days and errors older than 14 days or past 10,000
-- per service, and an error's message is masked on the way in (AC-9, L-GDPR-2, L-GDPR-4). One transaction, rolled back
-- at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000340a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000340b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000340c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000340e1', 'eve@example.com');
-- Ada owns Initech, Bob is its member; Carl owns Acme; Eve belongs to none.
insert into public.workspaces (slug, name, github_org) values ('acme-supervisor', 'Acme', 'acme-supervisor');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',         '00000000-0000-4000-8000-0000000340a1'::uuid, 'owner'),
         ('initech',         '00000000-0000-4000-8000-0000000340b1'::uuid, 'member'),
         ('acme-supervisor', '00000000-0000-4000-8000-0000000340c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
insert into public.runners (workspace_id, owner, name)
select w.id, r.owner, r.name
  from (values
         ('initech',         '00000000-0000-4000-8000-0000000340a1'::uuid, 'atlas-01'),
         ('initech',         '00000000-0000-4000-8000-0000000340a1'::uuid, 'atlas-02'),
         ('acme-supervisor', '00000000-0000-4000-8000-0000000340c1'::uuid, 'acme-01')
       ) as r (slug, owner, name)
  join public.workspaces w on w.slug = r.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (name text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-supervisor');
insert into ids select r.name, r.id from public.runners r where r.name in ('atlas-01', 'atlas-02', 'acme-01');
grant select, insert on ids to anon, authenticated, service_role;
create function pg_temp.id(name text) returns uuid language sql as $$
  select i.id from ids i where i.name = id.name;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;
-- Runs a call that must be refused for its field: SQLSTATE 22023 and the field as its hint.
create function pg_temp.refused_for(stmt text, field text) returns void language plpgsql as $$
declare
  h text;
begin
  execute stmt;
  raise exception 'FAIL: % was not refused for its %', stmt, field;
exception when invalid_parameter_value then
  get stacked diagnostics h = pg_exception_hint;
  if h is distinct from field then
    raise exception 'FAIL: % was refused without naming its % (hint %)', stmt, field, h;
  end if;
end;
$$;
grant execute on function pg_temp.id(text), pg_temp.forbidden(text, text), pg_temp.refused_for(text, text)
  to anon, authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.supervisor_findings limit 1; raise exception 'FAIL: anon read a finding';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.app_errors limit 1; raise exception 'FAIL: anon read an error';
  exception when insufficient_privilege then null; end;
  perform pg_temp.forbidden(format('select public.supervisor_seat_place(%L, %L)', pg_temp.id('initech'), pg_temp.id('atlas-01')), 'anon');
  perform pg_temp.forbidden(format('select public.supervisor_memory_clear(%L, ''all'')', pg_temp.id('initech')), 'anon');
end $$;
reset role;

-- ── An owner places the seat; a member cannot ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340b1');
do $$
begin
  perform pg_temp.forbidden(format('select public.supervisor_seat_place(%L, %L)', pg_temp.id('initech'), pg_temp.id('atlas-01')), 'a member');
  begin
    insert into public.supervisor_seats (workspace_id, runner_id, placed_login) values (pg_temp.id('initech'), pg_temp.id('atlas-01'), 'bob');
    raise exception 'FAIL: a member wrote the seat directly';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340a1');
do $$
declare
  s public.supervisor_seats;
  moved public.supervisor_seats;
begin
  s := public.supervisor_seat_place(pg_temp.id('initech'), pg_temp.id('atlas-01'));
  if s.runner_id <> pg_temp.id('atlas-01') or s.placed_by <> '00000000-0000-4000-8000-0000000340a1' or s.placed_login is null
     or s.paused or s.daily_tokens <> 5000000 then
    raise exception 'FAIL: the seat was not placed as Ada''s, watching, at 5M tokens: %', row_to_json(s);
  end if;
  perform pg_temp.refused_for(format('select public.supervisor_seat_place(%L, %L)', pg_temp.id('initech'), pg_temp.id('acme-01')), 'runner');
  moved := public.supervisor_seat_place(pg_temp.id('initech'), pg_temp.id('atlas-02'));
  if moved.runner_id <> pg_temp.id('atlas-02') or (select count(*) from public.supervisor_seats) <> 1 then
    raise exception 'FAIL: the seat did not move, or moved as a second seat: %', row_to_json(moved);
  end if;
  s := public.supervisor_seat_set(pg_temp.id('initech'), true, 2000000);
  if not s.paused or s.daily_tokens <> 2000000 or s.runner_id <> pg_temp.id('atlas-02') then
    raise exception 'FAIL: the seat was not paused at 2M: %', row_to_json(s);
  end if;
  perform pg_temp.refused_for(format('select public.supervisor_seat_set(%L, null, 0)', pg_temp.id('initech')), 'daily_tokens');
  perform pg_temp.forbidden(format('select public.supervisor_seat_place(%L, %L)', pg_temp.id('acme-supervisor'), pg_temp.id('acme-01')), 'another workspace''s owner');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340b1');
do $$
begin
  perform pg_temp.forbidden(format('select public.supervisor_seat_set(%L, false, null)', pg_temp.id('initech')), 'a member');
end $$;
reset role;

-- ── The service role writes signals, findings, suggestions, notes, messages and errors ──
create temporary table made (name text primary key, id uuid);
grant select, insert on made to anon, authenticated, service_role;
create function pg_temp.made(name text) returns uuid language sql as $$
  select m.id from made m where m.name = made.name;
$$;
grant execute on function pg_temp.made(text) to anon, authenticated, service_role;

set local role service_role;
do $$
declare
  v uuid := pg_temp.id('initech');
  f uuid;
  s uuid;
  i integer;
begin
  insert into public.supervisor_signals (workspace_id, fingerprint, check_name, kind, check_line, figures, evidence_key)
  values (v, 'stuck:silent:job-1', 'silent-job', 'stuck', 'Silent job: no line for 52 min, 3× the 2.5 min usual',
          '{"minutes": 52, "usual": 2.5}', 'e1');
  begin
    insert into public.supervisor_signals (workspace_id, fingerprint, check_name, kind, check_line, evidence_key)
    values (v, 'stuck:silent:job-1', 'silent-job', 'stuck', 'Silent job: again', 'e1');
    raise exception 'FAIL: a second open signal on one fingerprint';
  exception when unique_violation then null; end;

  insert into public.supervisor_findings (workspace_id, fingerprint, kind, severity, title, check_line, evidence_key, raised_by)
  values (v, 'stuck:silent:job-1', 'stuck', 'high', 'A job went silent', 'Silent job: no line for 52 min, 3× the 2.5 min usual', 'e1', 'check')
  returning id into f;
  insert into made values ('finding', f);
  begin
    insert into public.supervisor_findings (workspace_id, kind, severity, title, raised_by) values (v, 'bug', 'medium', 'No check', 'check');
    raise exception 'FAIL: a finding written by a check carried no check';
  exception when check_violation then null; end;
  insert into public.supervisor_findings (workspace_id, kind, severity, title, raised_by, explanation, looked_at)
  values (v, 'bug', 'medium', 'Raised with no check', 'supervisor', 'Looks odd.', now()) returning id into f;
  insert into made values ('loose', f);

  insert into public.supervisor_proposals (workspace_id, finding_id, kind, action, label, target)
  values (v, pg_temp.made('finding'), 'suggestion', 'stop-resume-job', 'Stop and resume the job', '{"job": "job-1"}')
  returning id into s;
  insert into made values ('suggestion', s);
  insert into public.supervisor_proposals (workspace_id, finding_id, kind, action, label, target)
  values (v, pg_temp.made('finding'), 'suggestion', 'open-terminal', 'Open its Terminal', '{"job": "job-1"}');
  begin
    insert into public.supervisor_proposals (workspace_id, finding_id, kind, action, label, target)
    values (v, pg_temp.made('finding'), 'suggestion', 'open-bug-fix', 'A third', '{}');
    raise exception 'FAIL: a third suggestion stood on a finding';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.supervisor_proposals (workspace_id, finding_id, kind, action, label, target)
    values (v, pg_temp.made('loose'), 'suggestion', 'merge', 'Merge it', '{}');
    raise exception 'FAIL: a merge was suggested';
  exception when check_violation then null; end;
  begin
    insert into public.supervisor_proposals (workspace_id, finding_id, kind, action, label, target)
    values (pg_temp.id('acme-supervisor'), pg_temp.made('loose'), 'suggestion', 'open-terminal', 'Elsewhere', '{}');
    raise exception 'FAIL: a suggestion went to another workspace''s finding';
  exception when invalid_parameter_value then null; end;

  -- AC-5's ground: 4 short-term and 5 long-term notes, 6 findings and 12 messages.
  for i in 1..4 loop
    insert into public.supervisor_memory (workspace_id, scope, line, cites) values (v, 'short', format('Watching job %s.', i), array[pg_temp.made('finding')]);
  end loop;
  for i in 1..5 loop
    insert into public.supervisor_memory (workspace_id, scope, line, cites) values (v, 'long', format('Lesson %s.', i), array[pg_temp.made('finding')]);
  end loop;
  for i in 3..6 loop
    insert into public.supervisor_findings (workspace_id, kind, severity, title, raised_by) values (v, 'health', 'medium', format('Finding %s', i), 'supervisor');
  end loop;
  for i in 1..12 loop
    insert into public.supervisor_messages (workspace_id, finding_id, kind, body)
    values (v, case when i % 2 = 0 then pg_temp.made('finding') end, 'supervisor', format('Answer %s.', i));
  end loop;
  begin
    insert into public.supervisor_memory (workspace_id, scope, line, cites) values (v, 'long', 'Cites nothing.', '{}');
    raise exception 'FAIL: a note cited nothing';
  exception when check_violation then null; end;
  begin
    insert into public.supervisor_memory (workspace_id, scope, line, cites) values (v, 'long', repeat('a', 301), array[pg_temp.made('finding')]);
    raise exception 'FAIL: a note ran past 300 characters';
  exception when check_violation then null; end;
  if exists (select 1 from public.supervisor_memory m where m.scope = 'short'
              and m.expires_at <> m.created_at + interval '24 hours') then
    raise exception 'FAIL: a short-term note does not expire after 24 h';
  end if;

  -- An error is masked on the way in, and cut to 500 characters (AC-9).
  insert into public.app_errors (service, route, status, message, workspace_id)
  -- The fake token is built here, never written out whole (the open-source guard).
  values ('galaxy', '/api/runners/next', 500, 'fetch failed: Authorization: Bearer ' || 'gh' || 'p_' || repeat('x9', 15) || ' token=s3cr3tvalue', v);
  if (select message from public.app_errors where route = '/api/runners/next') ~ '(x9x9|s3cr3t)' then
    raise exception 'FAIL: an error kept its token: %', (select message from public.app_errors where route = '/api/runners/next');
  end if;
  begin
    insert into public.app_errors (service, route, status) values ('galaxy', '/api/x', 404);
    raise exception 'FAIL: a 404 was kept as an App error';
  exception when check_violation then null; end;
end $$;
reset role;

-- ── A member reads everything, acts on nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340b1');
do $$
declare
  v uuid := pg_temp.id('initech');
begin
  if (select count(*) from public.supervisor_seats) <> 1 or (select count(*) from public.supervisor_signals) <> 1
     or (select count(*) from public.supervisor_findings) <> 6 or (select count(*) from public.supervisor_proposals) <> 2
     or (select count(*) from public.supervisor_messages) <> 12 or (select count(*) from public.supervisor_memory) <> 9
     or (select count(*) from public.app_errors) <> 1 then
    raise exception 'FAIL: a member did not read their workspace''s Supervisor';
  end if;
  perform pg_temp.forbidden(format('select public.supervisor_proposal_approve(%L)', pg_temp.made('suggestion')), 'a member');
  perform pg_temp.forbidden(format('select public.supervisor_finding_dismiss(%L, null)', pg_temp.made('loose')), 'a member');
  perform pg_temp.forbidden(format('select public.supervisor_say(%L, null, ''Why?'')', v), 'a member');
  perform pg_temp.forbidden(format('select public.supervisor_memory_delete(%L)', (select id from public.supervisor_memory limit 1)), 'a member');
  -- AC-5: a member's clear is refused.
  perform pg_temp.forbidden(format('select public.supervisor_memory_clear(%L, ''all'')', v), 'a member');
  begin
    delete from public.supervisor_memory;
    raise exception 'FAIL: a member deleted notes directly';
  exception when insufficient_privilege then null; end;
end $$;

-- ── A stranger and an account of no workspace read nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340c1');
do $$
begin
  if exists (select 1 from public.supervisor_findings) or exists (select 1 from public.supervisor_memory)
     or exists (select 1 from public.supervisor_seats) or exists (select 1 from public.app_errors) then
    raise exception 'FAIL: another workspace''s owner read Initech''s Supervisor';
  end if;
  perform pg_temp.forbidden(format('select public.supervisor_proposal_approve(%L)', pg_temp.made('suggestion')), 'another workspace''s owner');
  perform pg_temp.forbidden(format('select public.supervisor_memory_clear(%L, ''all'')', pg_temp.id('initech')), 'another workspace''s owner');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340e1');
do $$
begin
  if exists (select 1 from public.supervisor_findings) or exists (select 1 from public.supervisor_messages) then
    raise exception 'FAIL: an account of no workspace read a Supervisor';
  end if;
end $$;

-- ── An owner writes, presses, dismisses and clears ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000340a1');
do $$
declare
  v uuid := pg_temp.id('initech');
  m public.supervisor_messages;
  p public.supervisor_proposals;
  again public.supervisor_proposals;
  d public.supervisor_proposals;
  gone integer;
begin
  m := public.supervisor_say(v, pg_temp.made('finding'), '  Why is it stuck?  ');
  if m.kind <> 'owner' or m.body <> 'Why is it stuck?' or m.author_login is null or m.finding_id <> pg_temp.made('finding') then
    raise exception 'FAIL: an owner''s message was not recorded as theirs: %', row_to_json(m);
  end if;
  perform pg_temp.refused_for(format('select public.supervisor_say(%L, null, ''   '')', v), 'text');
  perform pg_temp.refused_for(format('select public.supervisor_say(%L, %L, ''Hi'')', v, gen_random_uuid()), 'finding');

  p := public.supervisor_proposal_approve(pg_temp.made('suggestion'));
  if p.kind <> 'press' or p.reply_to <> pg_temp.made('suggestion') or p.author_id <> '00000000-0000-4000-8000-0000000340a1'
     or p.author_login is null then
    raise exception 'FAIL: the press was not recorded as Ada''s: %', row_to_json(p);
  end if;
  insert into made values ('press', p.id);
  again := public.supervisor_proposal_approve(pg_temp.made('suggestion'));
  if again.id <> p.id then
    raise exception 'FAIL: a second press was stored as a new row';
  end if;
  perform pg_temp.refused_for(format('select public.supervisor_proposal_approve(%L)', p.id), 'proposal');
  perform pg_temp.refused_for(format('select public.supervisor_proposal_approve(%L)', gen_random_uuid()), 'proposal');

  d := public.supervisor_finding_dismiss(pg_temp.made('loose'), 'Expected during the release.');
  if d.kind <> 'dismiss' or d.note <> 'Expected during the release.' or d.author_login is null
     or (select state from public.supervisor_findings where id = pg_temp.made('loose')) <> 'dismissed' then
    raise exception 'FAIL: the dismissal was not recorded: %', row_to_json(d);
  end if;
  if (public.supervisor_finding_dismiss(pg_temp.made('loose'), 'Again')).id <> d.id then
    raise exception 'FAIL: a second dismissal was stored as a new row';
  end if;

  if not public.supervisor_memory_delete((select id from public.supervisor_memory where line = 'Lesson 1.')) then
    raise exception 'FAIL: an owner could not delete a note';
  end if;
  perform pg_temp.refused_for(format('select public.supervisor_memory_clear(%L, ''some'')', v), 'scope');
  gone := public.supervisor_memory_clear(v, 'short');
  if gone <> 4 or (select count(*) from public.supervisor_memory) <> 4 then
    raise exception 'FAIL: clearing short-term memory cleared % notes', gone;
  end if;
  -- AC-5: an owner's clear of all memory leaves no note and keeps every finding and message.
  gone := public.supervisor_memory_clear(v, 'all');
  if gone <> 4 or exists (select 1 from public.supervisor_memory) then
    raise exception 'FAIL: clearing all memory left a note';
  end if;
  if (select count(*) from public.supervisor_findings) <> 6 or (select count(*) from public.supervisor_messages) <> 13
     or (select count(*) from public.supervisor_proposals) <> 4 then
    raise exception 'FAIL: clearing memory touched findings, messages or proposals';
  end if;
end $$;
reset role;

-- ── No proposal is changed or deleted (BR-PRODUCT-12) ──
set local role service_role;
do $$
begin
  insert into public.supervisor_proposals (workspace_id, finding_id, kind, reply_to, outcome, note)
  values (pg_temp.id('initech'), pg_temp.made('finding'), 'result', pg_temp.made('press'), 'done', 'Resumed as job-2.');
  begin
    insert into public.supervisor_proposals (workspace_id, finding_id, kind, reply_to, outcome)
    values (pg_temp.id('initech'), pg_temp.made('finding'), 'result', pg_temp.made('press'), 'failed');
    raise exception 'FAIL: a press got two results';
  exception when unique_violation then null; end;
  begin
    update public.supervisor_proposals set note = 'Rewritten.';
    raise exception 'FAIL: the service role changed a proposal';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.supervisor_proposals;
    raise exception 'FAIL: the service role deleted a proposal';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$
begin
  begin
    update public.supervisor_proposals set note = 'Rewritten.' where kind = 'press';
    raise exception 'FAIL: a press was rewritten';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.supervisor_proposals where kind = 'dismiss';
    raise exception 'FAIL: a dismissal was deleted';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Memory keeps at most 100 short-term notes ──
set local role service_role;
do $$
declare
  i integer;
begin
  for i in 1..101 loop
    insert into public.supervisor_memory (workspace_id, scope, line, cites, created_at)
    values (pg_temp.id('initech'), 'short', format('Note %s.', i), array[pg_temp.made('finding')], now() - make_interval(secs => 200 - i));
  end loop;
  if (select count(*) from public.supervisor_memory) <> 100 or exists (select 1 from public.supervisor_memory where line = 'Note 1.') then
    raise exception 'FAIL: short-term memory kept % notes, or kept the oldest', (select count(*) from public.supervisor_memory);
  end if;
end $$;
reset role;

-- ── The hourly sweep (L-GDPR-4) ──
do $$
declare
  v uuid := pg_temp.id('initech');
begin
  delete from public.supervisor_memory;
  insert into public.supervisor_memory (workspace_id, scope, line, cites, created_at) values
    (v, 'short', 'Old note.', array[pg_temp.made('finding')], now() - interval '25 hours'),
    (v, 'short', 'Fresh note.', array[pg_temp.made('finding')], now() - interval '1 hour'),
    (v, 'long', 'Old lesson.', array[pg_temp.made('finding')], now() - interval '400 days');
  insert into public.supervisor_signals (workspace_id, fingerprint, check_name, kind, check_line, evidence_key, opened_at, closed_at) values
    (v, 'bug:route:old', 'route-failing', 'bug', 'App route failing: 3 errors in 1 h', 'e2', now() - interval '40 days', now() - interval '31 days'),
    (v, 'bug:route:new', 'route-failing', 'bug', 'App route failing: 3 errors in 1 h', 'e3', now() - interval '2 days', now() - interval '1 day');
  insert into public.supervisor_messages (workspace_id, kind, body, created_at) values
    (v, 'supervisor', 'An old answer.', now() - interval '91 days');
  insert into public.app_errors (service, route, status, created_at) values ('omni-app', '/old', 502, now() - interval '15 days');
  insert into public.app_errors (service, route, status, created_at)
  select 'omni-app', '/many', 500, now() - make_interval(secs => g) from generate_series(1, 10001) g;

  perform public.supervisor_forget();

  if exists (select 1 from public.supervisor_memory where line = 'Old note.')
     or not exists (select 1 from public.supervisor_memory where line = 'Fresh note.')
     or not exists (select 1 from public.supervisor_memory where line = 'Old lesson.') then
    raise exception 'FAIL: the sweep did not forget exactly the short-term notes past 24 h';
  end if;
  if exists (select 1 from public.supervisor_signals where fingerprint = 'bug:route:old')
     or not exists (select 1 from public.supervisor_signals where fingerprint = 'bug:route:new')
     or not exists (select 1 from public.supervisor_signals where fingerprint = 'stuck:silent:job-1') then
    raise exception 'FAIL: the sweep did not forget exactly the signals closed 30 days ago';
  end if;
  if exists (select 1 from public.supervisor_messages where body = 'An old answer.') or (select count(*) from public.supervisor_messages) <> 13 then
    raise exception 'FAIL: the sweep did not forget exactly the messages older than 90 days';
  end if;
  if exists (select 1 from public.app_errors where route = '/old')
     or (select count(*) from public.app_errors where service = 'omni-app') <> 10000
     or exists (select 1 from public.app_errors where route = '/many' and created_at = (select min(created_at) from public.app_errors where route = '/many') and created_at < now() - make_interval(secs => 10000))
     or (select count(*) from public.app_errors where service = 'galaxy') <> 1 then
    raise exception 'FAIL: the sweep did not keep 14 days and 10,000 errors per service';
  end if;
  if (select count(*) from public.supervisor_findings) <> 6 or (select count(*) from public.supervisor_proposals) <> 5 then
    raise exception 'FAIL: the sweep touched findings or proposals';
  end if;
  if not exists (select 1 from cron.job where jobname = 'supervisor-forget') then
    raise exception 'FAIL: the sweep is not scheduled';
  end if;

  -- A deleted account's press keeps its login, its messages go, and its runners take the seat with them (L-GDPR-3).
  delete from auth.users where id = '00000000-0000-4000-8000-0000000340a1';
  if (select author_id from public.supervisor_proposals where id = pg_temp.made('press')) is not null
     or (select author_login from public.supervisor_proposals where id = pg_temp.made('press')) is null then
    raise exception 'FAIL: a deleted account''s press was not kept by its login alone';
  end if;
  if exists (select 1 from public.supervisor_messages where kind = 'owner') then
    raise exception 'FAIL: a deleted account''s messages stayed';
  end if;
  if exists (select 1 from public.supervisor_seats) then
    raise exception 'FAIL: a seat outlived its runner';
  end if;
  -- A finding removed (as its workspace's deletion would) takes its proposals with it: only a direct delete is refused.
  delete from public.supervisor_findings where id = pg_temp.made('finding');
  if exists (select 1 from public.supervisor_proposals where finding_id = pg_temp.made('finding')) then
    raise exception 'FAIL: a removed finding left its proposals behind';
  end if;
end $$;

rollback;
