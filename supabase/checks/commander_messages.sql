-- A Virtual Fleet's Commander thread (PRD 3107 s1). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/commander_messages.sql
-- Initech's virtual fleet night-crew and Acme's virtual fleet day-crew each have a thread. A member asks their fleet's
-- Commander as themselves, signed by their login; a member of another workspace, an account of no workspace and anon are
-- refused, read nothing and post nothing (AC-9), and so are a fleet that is not virtual and an empty or long question.
-- Nobody signed in writes the table directly: the service role adds the Commander's reply, one per question, of the
-- question's own fleet, its links inside the app or on GitHub only (AC-1, AC-2). Nothing is changed once written. The
-- replies' tokens count toward the fleet's last 24 hours (AC-10). The hourly purge deletes what is older than 90 days, a
-- reply with its question (L-GDPR-4), and a deleted account's questions go with it (L-GDPR-3). One transaction, rolled
-- back at the end. Any `FAIL:` stops the run.

begin;

-- The checks' own workspace, Initech, with its fleets, sectors and repositories (PRD 2305).
\ir fixtures/initech.sql

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000310a1', 'ada@example.com'),
  ('00000000-0000-4000-8000-0000000310b1', 'bob@example.com'),
  ('00000000-0000-4000-8000-0000000310c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000310e1', 'eve@example.com');
-- Ada owns Initech, Bob is its member; Carl owns Acme; Eve belongs to none.
insert into public.workspaces (slug, name, github_org) values ('acme-commander', 'Acme', 'acme-commander');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('initech',        '00000000-0000-4000-8000-0000000310a1'::uuid, 'owner'),
         ('initech',        '00000000-0000-4000-8000-0000000310b1'::uuid, 'member'),
         ('acme-commander', '00000000-0000-4000-8000-0000000310c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;
insert into public.teams (workspace_id, name, label, color, motto, mascot, sort, kind)
select w.id, f.name, f.label, '#7a5cff', '', 'robot', 100, 'virtual'
  from (values ('initech', 'night-crew', 'Night Crew'), ('acme-commander', 'day-crew', 'Day Crew')) as f (slug, name, label)
  join public.workspaces w on w.slug = f.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('initech', 'acme-commander');
create temporary table asked (name text primary key, id uuid);
grant select on ids to anon, authenticated, service_role;
grant select, insert on asked to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- Runs a call that must be refused for its field: SQLSTATE 22023, the field as its hint, and a message that starts with
-- `word`.
create function pg_temp.refused_for(stmt text, field text, word text) returns void language plpgsql as $$
declare
  msg text;
  h text;
begin
  execute stmt;
  raise exception 'FAIL: % was not refused for its %', stmt, field;
exception when invalid_parameter_value then
  get stacked diagnostics msg = message_text, h = pg_exception_hint;
  if h is distinct from field or msg not like word || '%' then
    raise exception 'FAIL: % was refused without naming its %: % (hint %)', stmt, field, msg, h;
  end if;
end;
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;
-- A reply as the app writes it: one claim, its source as given.
create function pg_temp.reply(href text) returns jsonb language sql as $$
  select jsonb_build_object('verdict', 'PRD 2817 waits on a review.', 'read', 12, 'removed', 1,
    'claims', jsonb_build_array(jsonb_build_object('text', 'PRD 2817 waits on its Reviewer.',
      'sources', jsonb_build_array(jsonb_build_object('label', 'event 08:41', 'href', href, 'line', '08:41 · reviewer · waits · PRD 2817')))));
$$;
grant execute on function pg_temp.refused_for(text, text, text), pg_temp.forbidden(text, text), pg_temp.reply(text)
  to anon, authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.commander_messages limit 1; raise exception 'FAIL: anon read a Commander thread';
  exception when insufficient_privilege then null; end;
  perform pg_temp.forbidden(format('select public.commander_ask(%L, ''night-crew'', ''What waits on me?'')', pg_temp.ws('initech')), 'anon');
end $$;
reset role;

-- ── A member asks, as themselves ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310b1');
do $$
declare
  v uuid := pg_temp.ws('initech');
  m public.commander_messages;
begin
  m := public.commander_ask(v, 'night-crew', '  What is PRD 2817 waiting for?  ');
  if m.kind <> 'question' or m.author_id <> '00000000-0000-4000-8000-0000000310b1' or m.body <> 'What is PRD 2817 waiting for?'
     or m.author_login is null or m.reply is not null or m.tokens <> 0 then
    raise exception 'FAIL: a member''s question was not recorded as theirs: %', row_to_json(m);
  end if;
  insert into asked values ('bob', m.id);
  perform pg_temp.refused_for(format('select public.commander_ask(%L, ''beaver'', ''Hi'')', v), 'fleet', 'Fleet:');
  perform pg_temp.refused_for(format('select public.commander_ask(%L, ''nobody'', ''Hi'')', v), 'fleet', 'Fleet:');
  perform pg_temp.refused_for(format('select public.commander_ask(%L, ''night-crew'', ''   '')', v), 'text', 'Question:');
  perform pg_temp.refused_for(format('select public.commander_ask(%L, ''night-crew'', %L)', v, repeat('a', 2001)), 'text', 'Question:');
  perform pg_temp.forbidden(format('select public.commander_ask(%L, ''day-crew'', ''Hi'')', pg_temp.ws('acme-commander')), 'a member of another workspace');
  begin
    insert into public.commander_messages (workspace_id, fleet, kind, author_id, author_login, body)
    values (v, 'night-crew', 'question', '00000000-0000-4000-8000-0000000310b1', 'bob', 'Hi');
    raise exception 'FAIL: a signed-in person wrote the thread directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.commander_messages (workspace_id, fleet, kind, reply_to, reply)
    values (v, 'night-crew', 'reply', m.id, pg_temp.reply('/app/fleet'));
    raise exception 'FAIL: a signed-in person wrote a Commander reply';
  exception when insufficient_privilege then null; end;
  begin
    update public.commander_messages set body = 'Something else' where id = m.id;
    raise exception 'FAIL: a signed-in person changed a question';
  exception when insufficient_privilege then null; end;
end $$;

-- A stranger asks nothing, and neither does an account of no workspace (AC-9).
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310c1');
do $$
begin
  perform pg_temp.forbidden(format('select public.commander_ask(%L, ''night-crew'', ''Hi'')', pg_temp.ws('initech')), 'another workspace''s owner');
end $$;
select public.commander_ask(pg_temp.ws('acme-commander'), 'day-crew', 'What happened overnight?');
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310e1');
do $$
begin
  perform pg_temp.forbidden(format('select public.commander_ask(%L, ''night-crew'', ''Hi'')', pg_temp.ws('initech')), 'an account of no workspace');
end $$;
reset role;

-- ── The service role replies: once per question, of its fleet, its links the app's ──
set local role service_role;
do $$
declare
  q uuid := (select id from asked where name = 'bob');
  v uuid := pg_temp.ws('initech');
  bad jsonb;
begin
  insert into public.commander_messages (workspace_id, fleet, kind, reply_to, reply, tokens)
  values (v, 'night-crew', 'reply', q, pg_temp.reply('/app/fleet?fleet=night-crew&tab=room'), 1200);
  begin
    insert into public.commander_messages (workspace_id, fleet, kind, reply_to, reply)
    values (v, 'night-crew', 'reply', q, pg_temp.reply('/app/runners#job-1'));
    raise exception 'FAIL: a question took a second reply';
  exception when unique_violation then null; end;
  begin
    insert into public.commander_messages (workspace_id, fleet, kind, reply_to, reply)
    values (pg_temp.ws('acme-commander'), 'day-crew', 'reply', q, pg_temp.reply('/app/fleet'));
    raise exception 'FAIL: a reply went to another fleet''s thread';
  exception when invalid_parameter_value then null; end;
  -- A link the app did not build, a claim with no source, a verdict over nothing, a person's signature: refused.
  foreach bad in array array[
    pg_temp.reply('https://evil.example/2817'), pg_temp.reply('//evil.example/2817'), pg_temp.reply('javascript:alert(1)'),
    '{"verdict": "All is fine.", "claims": [], "read": 3, "removed": 0}',
    '{"verdict": "Yes.", "claims": [{"text": "PRD 2817 waits.", "sources": []}], "read": 3, "removed": 0}',
    '{"verdict": null, "claims": [], "read": 3}',
    '{"verdict": null, "claims": [], "read": 3, "removed": 0, "link": "https://evil.example"}'
  ]::jsonb[] loop
    begin
      insert into public.commander_messages (workspace_id, fleet, kind, reply_to, reply)
      values (v, 'night-crew', 'reply', q, bad);
      raise exception 'FAIL: the reply % was stored', bad;
    exception when check_violation then null; end;
  end loop;
  begin
    insert into public.commander_messages (workspace_id, fleet, kind, author_id, reply_to, reply)
    values (v, 'night-crew', 'reply', '00000000-0000-4000-8000-0000000310b1', q, '{"verdict": null, "claims": [], "read": 0, "removed": 0}');
    raise exception 'FAIL: a reply was signed by a person';
  exception when check_violation then null; end;
  if public.commander_reply_ok('{"verdict": null, "claims": [], "read": 0, "removed": 0}') is not true then
    raise exception 'FAIL: a reply that kept nothing was refused';
  end if;
  begin
    update public.commander_messages set tokens = 0 where reply_to = q;
    raise exception 'FAIL: the service role changed a reply';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$
begin
  begin
    update public.commander_messages set tokens = 0 where kind = 'reply';
    raise exception 'FAIL: a reply was changed';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Who reads: the workspace's members, and nobody else (AC-9) ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310a1');
do $$
begin
  if (select count(*) from public.commander_messages) <> 2 then
    raise exception 'FAIL: Initech''s owner does not read their fleet''s thread, and only it';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310c1');
do $$
begin
  if exists (select 1 from public.commander_messages where workspace_id = pg_temp.ws('initech')) then
    raise exception 'FAIL: another workspace''s owner read Initech''s thread';
  end if;
  if (select count(*) from public.commander_messages) <> 1 then
    raise exception 'FAIL: Acme''s owner does not read their own thread';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310e1');
do $$
begin
  if exists (select 1 from public.commander_messages) then
    raise exception 'FAIL: an account of no workspace read a thread';
  end if;
end $$;

-- ── The replies' tokens spend the fleet's last 24 hours (AC-10) ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310b1');
do $$
declare
  t record;
begin
  select * into t from public.fleet_tokens_24h(pg_temp.ws('initech'), 'night-crew');
  if t.tokens <> 1200 or t.oldest_end is null then
    raise exception 'FAIL: the Commander''s tokens did not count toward the fleet''s 24 hours: % %', t.tokens, t.oldest_end;
  end if;
  select * into t from public.fleet_tokens_24h(pg_temp.ws('initech'), 'night-crew', now() + interval '25 hours');
  if t.tokens <> 0 then
    raise exception 'FAIL: a reply older than 24 hours still counted';
  end if;
  perform pg_temp.forbidden('select public.commander_messages_forget()', 'a member');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000310c1');
do $$
begin
  if (select tokens from public.fleet_tokens_24h(pg_temp.ws('initech'), 'night-crew')) <> 0 then
    raise exception 'FAIL: another workspace''s owner read Initech''s spending';
  end if;
end $$;
reset role;

-- ── Kept 90 days, every hour (L-GDPR-4) ──
do $$
declare
  old uuid;
  v uuid := pg_temp.ws('initech');
begin
  insert into public.commander_messages (workspace_id, fleet, kind, author_id, author_login, body, created_at)
  values (v, 'night-crew', 'question', '00000000-0000-4000-8000-0000000310a1', 'ada', 'An old question', now() - interval '91 days')
  returning id into old;
  insert into public.commander_messages (workspace_id, fleet, kind, reply_to, reply, created_at)
  values (v, 'night-crew', 'reply', old, pg_temp.reply('/app/fleet'), now() - interval '91 days');
  if not exists (select 1 from cron.job where jobname = 'commander-messages-forget' and schedule = '17 * * * *') then
    raise exception 'FAIL: no hourly job forgets the Commander''s threads';
  end if;
end $$;
set local role service_role;
do $$
begin
  if public.commander_messages_forget() <> 2 then
    raise exception 'FAIL: the purge did not delete the old question and its reply';
  end if;
end $$;
reset role;
do $$
begin
  if (select count(*) from public.commander_messages where workspace_id = pg_temp.ws('initech')) <> 2 then
    raise exception 'FAIL: the purge deleted a message younger than 90 days';
  end if;
  -- A deleted account's questions go with it, and their replies (L-GDPR-3).
  delete from auth.users where id = '00000000-0000-4000-8000-0000000310b1';
  if exists (select 1 from public.commander_messages where workspace_id = pg_temp.ws('initech')) then
    raise exception 'FAIL: a deleted account''s question, or its reply, stayed';
  end if;
end $$;

rollback;
