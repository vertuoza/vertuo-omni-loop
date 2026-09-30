-- Who may read and write a workspace's Jev settings (PRD 812). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/jev.sql
-- A workspace's owner, and only its owner, sets and removes its TypeSafe key and sets a decision's
-- mode, threshold and confidence floor, through set_jev_key(), remove_jev_key() and
-- set_jev_decision(): a member, the owner of another workspace, an account in no workspace and anyone
-- signed out are refused (42501), and nothing changes. Nobody signed in reads a workspace_secrets row;
-- jev_key_status() tells a member only whether a key is stored, and the owner its last four. Removing
-- the key sets every decision Off. Only the service role reads a sealed key and appends a call. One
-- transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

-- ── The cast ──
-- Olga owns Vertuoza and Mo is a member of it; Carl owns Acme; Sam belongs to no workspace.
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000081a1', 'olga@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000081b1', 'mo@vertuoza.com', now()),
  ('00000000-0000-4000-8000-0000000081c1', 'carl@acme.test', now()),
  ('00000000-0000-4000-8000-0000000081d1', 'sam@nowhere.test', now());
insert into public.workspaces (slug, name, github_org) values ('acme-jev', 'Acme', 'acme-jev');
insert into public.workspace_members (workspace_id, user_id, role)
select w.id, m.user_id, m.role
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000081a1'::uuid, 'owner'),
         ('vertuoza', '00000000-0000-4000-8000-0000000081b1'::uuid, 'member'),
         ('acme-jev', '00000000-0000-4000-8000-0000000081c1'::uuid, 'owner')
       ) as m (slug, user_id, role)
  join public.workspaces w on w.slug = m.slug;

-- Nothing is seeded: every workspace starts with no key, and every decision Off.
do $$
begin
  if exists (select 1 from public.workspace_secrets) or exists (select 1 from public.jev_decisions) or exists (select 1 from public.jev_calls) then
    raise exception 'FAIL: a workspace starts with a Jev key, a decision or a call';
  end if;
end $$;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temporary table ids (slug text primary key, id uuid);
insert into ids select w.slug, w.id from public.workspaces w where w.slug in ('vertuoza', 'acme-jev');
grant select on ids to anon, authenticated, service_role;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select i.id from ids i where i.slug = ws.slug;
$$;
-- The workspace's Jev settings, as one value to compare before and after a refusal.
create function pg_temp.jev(slug text) returns text language sql as $$
  select coalesce((select string_agg(row(s.*)::text, ';') from public.workspace_secrets s where s.workspace_id = pg_temp.ws(slug)), '')
      || '|' || coalesce((select string_agg(row(d.*)::text, ';' order by d.decision) from public.jev_decisions d where d.workspace_id = pg_temp.ws(slug)), '');
$$;
-- Runs a call that must be refused to its caller.
create function pg_temp.forbidden(stmt text, who text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran for %', stmt, who;
exception when insufficient_privilege then null;
end;
$$;

-- Vertuoza starts with a key and one decision in Shadow, set as the owner would, so a refusal has
-- something to leave unchanged.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081a1');
select public.set_jev_key(pg_temp.ws('vertuoza'), 'c2VhbGVk', 'aXY=', '1a2b');
select public.set_jev_decision(pg_temp.ws('vertuoza'), 'outbox-risk', 'shadow', 0.5, 0.4);
reset role;

create temporary table before (slug text primary key, jev text);
insert into before select s, pg_temp.jev(s) from unnest(array['vertuoza', 'acme-jev']) s;

-- The calls every outsider tries, on Vertuoza's settings.
create temporary table calls (stmt text);
insert into calls
select format(c, pg_temp.ws('vertuoza'))
  from unnest(array[
    'select public.set_jev_key(%L, ''cGxhbnRlZA=='', ''aXY='', ''zzzz'')',
    'select public.remove_jev_key(%L)',
    'select public.set_jev_decision(%L, ''outbox-risk'', ''on'', 0.9, 0.1)',
    'select public.set_jev_decision(%L, ''bug-risk'', ''off'', 0.5, 0.4)'
  ]) c;
grant select on calls to anon, authenticated;

-- The direct writes nobody signed in may make, whoever they are.
create temporary table writes (stmt text);
insert into writes
select format(c, pg_temp.ws('vertuoza'))
  from unnest(array[
    'insert into public.workspace_secrets (workspace_id, name, ciphertext, iv, last_four) values (%L, ''jev'', ''x'', ''y'', ''zzzz'')',
    'update public.workspace_secrets set last_four = ''zzzz'' where workspace_id = %L',
    'delete from public.workspace_secrets where workspace_id = %L',
    'insert into public.jev_decisions (workspace_id, decision, mode) values (%L, ''bug-risk'', ''on'')',
    'update public.jev_decisions set mode = ''on'' where workspace_id = %L',
    'delete from public.jev_decisions where workspace_id = %L',
    'insert into public.jev_calls (workspace_id, decision, mode, outcome, decided_by) values (%L, ''bug-risk'', ''on'', ''answered'', ''jev'')',
    'update public.jev_calls set counted = ''x'' where workspace_id = %L',
    'delete from public.jev_calls where workspace_id = %L'
  ]) c;
grant select on writes to anon, authenticated;

-- ── Signed out: every function and every write refused, nothing read ──
set local role anon;
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'anon'); end loop;
  for c in select stmt from writes loop perform pg_temp.forbidden(c, 'anon'); end loop;
  perform pg_temp.forbidden(format('select * from public.jev_key_status(%L)', pg_temp.ws('vertuoza')), 'anon');
  perform pg_temp.forbidden('select 1 from public.workspace_secrets', 'anon reading secrets');
  perform pg_temp.forbidden('select 1 from public.jev_decisions', 'anon reading decisions');
  perform pg_temp.forbidden('select 1 from public.jev_calls', 'anon reading calls');
end $$;
reset role;

-- ── A member of Vertuoza: reads the modes, never the key, changes nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081b1');
do $$
declare
  c text;
  st record;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'a member'); end loop;
  for c in select stmt from writes loop perform pg_temp.forbidden(c, 'a member'); end loop;
  perform pg_temp.forbidden('select 1 from public.workspace_secrets', 'a member reading secrets');
  select * into st from public.jev_key_status(pg_temp.ws('vertuoza'));
  if not st.stored or st.last_four is not null or st.set_at is not null then
    raise exception 'FAIL: a member reads more than whether a key is stored: %', st;
  end if;
  if (select mode from public.jev_decisions where workspace_id = pg_temp.ws('vertuoza') and decision = 'outbox-risk') is distinct from 'shadow' then
    raise exception 'FAIL: a member does not read their workspace''s decisions';
  end if;
end $$;

-- ── Acme's owner: refused on Vertuoza's settings, reads nothing of it ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081c1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'the owner of another workspace'); end loop;
  perform pg_temp.forbidden(format('select * from public.jev_key_status(%L)', pg_temp.ws('vertuoza')), 'the owner of another workspace');
  perform pg_temp.forbidden('select 1 from public.workspace_secrets', 'the owner of another workspace reading secrets');
  if exists (select 1 from public.jev_decisions) or exists (select 1 from public.jev_calls) then
    raise exception 'FAIL: the owner of another workspace reads Vertuoza''s decisions or calls';
  end if;
end $$;

-- ── An account in no workspace: refused, reads nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081d1');
do $$
declare c text;
begin
  for c in select stmt from calls loop perform pg_temp.forbidden(c, 'a stranger'); end loop;
  perform pg_temp.forbidden(format('select * from public.jev_key_status(%L)', pg_temp.ws('vertuoza')), 'a stranger');
  if exists (select 1 from public.jev_decisions) or exists (select 1 from public.jev_calls) then
    raise exception 'FAIL: a stranger reads decisions or calls';
  end if;
end $$;
reset role;

do $$
begin
  if pg_temp.jev('vertuoza') <> (select jev from before where slug = 'vertuoza') then
    raise exception 'FAIL: a refused call changed Vertuoza''s Jev settings';
  end if;
  if has_table_privilege('authenticated', 'public.workspace_secrets', 'select')
     or has_table_privilege('authenticated', 'public.jev_decisions', 'update')
     or has_table_privilege('authenticated', 'public.jev_calls', 'insert') then
    raise exception 'FAIL: authenticated holds a grant it must not on a Jev table';
  end if;
end $$;

-- ── The owner: writes nothing directly; sets, tunes and removes through the functions ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081a1');
do $$
declare
  c text;
  st record;
  d public.jev_decisions;
begin
  for c in select stmt from writes loop perform pg_temp.forbidden(c, 'the owner, directly'); end loop;
  perform pg_temp.forbidden('select 1 from public.workspace_secrets', 'the owner reading secrets');

  -- The key: replaced, and its last four read back by the owner alone.
  select * into st from public.set_jev_key(pg_temp.ws('vertuoza'), 'bmV3', 'aXYy', '9z9z');
  if st.last_four <> '9z9z' or st.set_at is null then raise exception 'FAIL: set_jev_key did not answer the new last four: %', st; end if;
  select * into st from public.jev_key_status(pg_temp.ws('vertuoza'));
  if not st.stored or st.last_four <> '9z9z' then raise exception 'FAIL: the owner does not read the key''s last four: %', st; end if;
  begin
    perform public.set_jev_key(pg_temp.ws('vertuoza'), '', 'aXY=', '1a2b');
    raise exception 'FAIL: set_jev_key took an empty sealed key';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.set_jev_key(pg_temp.ws('vertuoza'), 'eA==', 'aXY=', 'abcde');
    raise exception 'FAIL: set_jev_key kept more than four characters';
  exception when invalid_parameter_value then null; end;

  -- A decision's mode, threshold and floor; no other decision moves.
  d := public.set_jev_decision(pg_temp.ws('vertuoza'), 'question-category', 'on', 0.65, 0.3);
  if d.mode <> 'on' or d.threshold <> 0.65 or d.confidence_floor <> 0.30 or d.updated_by <> '00000000-0000-4000-8000-0000000081a1'::uuid then
    raise exception 'FAIL: set_jev_decision did not save question-category: %', d;
  end if;
  if (select row(mode, threshold, confidence_floor)::text from public.jev_decisions where workspace_id = pg_temp.ws('vertuoza') and decision = 'outbox-risk')
     <> '(shadow,0.50,0.40)' then
    raise exception 'FAIL: setting question-category moved outbox-risk';
  end if;
  d := public.set_jev_decision(pg_temp.ws('vertuoza'), 'question-category', 'shadow', 0.65, 0.3);
  if (select count(*) from public.jev_decisions where workspace_id = pg_temp.ws('vertuoza') and decision = 'question-category') <> 1 then
    raise exception 'FAIL: setting a decision again made a second row';
  end if;

  -- Bad values, each refused with its field.
  begin perform public.set_jev_decision(pg_temp.ws('vertuoza'), 'retro-verdict', 'on', 0.5, 0.4);
    raise exception 'FAIL: set_jev_decision took an unknown decision';
  exception when invalid_parameter_value then null; end;
  begin perform public.set_jev_decision(pg_temp.ws('vertuoza'), 'bug-risk', 'always', 0.5, 0.4);
    raise exception 'FAIL: set_jev_decision took an unknown mode';
  exception when invalid_parameter_value then null; end;
  begin perform public.set_jev_decision(pg_temp.ws('vertuoza'), 'bug-risk', 'on', 1.5, 0.4);
    raise exception 'FAIL: set_jev_decision took a threshold above 1';
  exception when invalid_parameter_value then null; end;
  begin perform public.set_jev_decision(pg_temp.ws('vertuoza'), 'bug-risk', 'on', 0.5, -0.1);
    raise exception 'FAIL: set_jev_decision took a floor under 0';
  exception when invalid_parameter_value then null; end;

  -- Olga owns Vertuoza only.
  begin perform public.set_jev_decision(pg_temp.ws('acme-jev'), 'bug-risk', 'off', 0.5, 0.4);
    raise exception 'FAIL: Vertuoza''s owner set a decision of Acme';
  exception when insufficient_privilege then null; end;

  -- Removing the key sets every decision Off, and keeps their tuning.
  perform public.remove_jev_key(pg_temp.ws('vertuoza'));
  select * into st from public.jev_key_status(pg_temp.ws('vertuoza'));
  if st.stored or st.last_four is not null then raise exception 'FAIL: remove_jev_key left a key: %', st; end if;
  if exists (select 1 from public.jev_decisions where workspace_id = pg_temp.ws('vertuoza') and mode <> 'off') then
    raise exception 'FAIL: removing the key left a decision on';
  end if;
  if (select threshold from public.jev_decisions where workspace_id = pg_temp.ws('vertuoza') and decision = 'question-category') <> 0.65 then
    raise exception 'FAIL: removing the key lost a decision''s tuning';
  end if;

  -- Without a key, a decision stays Off.
  begin perform public.set_jev_decision(pg_temp.ws('vertuoza'), 'bug-risk', 'shadow', 0.5, 0.4);
    raise exception 'FAIL: a decision left Off without a key';
  exception when invalid_parameter_value then null; end;
  d := public.set_jev_decision(pg_temp.ws('vertuoza'), 'bug-risk', 'off', 0.7, 0.4);
  if d.mode <> 'off' or d.threshold <> 0.70 then raise exception 'FAIL: an Off decision could not be tuned without a key'; end if;
end $$;
reset role;

-- ── The service role: reads the sealed key, appends calls, changes no setting ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081a1');
select public.set_jev_key(pg_temp.ws('vertuoza'), 'c2VhbGVk', 'aXY=', '1a2b');
reset role;
set local role service_role;
do $$
begin
  if (select ciphertext from public.workspace_secrets where workspace_id = pg_temp.ws('vertuoza') and name = 'jev') <> 'c2VhbGVk' then
    raise exception 'FAIL: the service role does not read the sealed key';
  end if;
  insert into public.jev_calls (workspace_id, decision, mode, outcome, model, jev_answer, confidence, old_answer, counted, decided_by, ref, ms)
  values (pg_temp.ws('vertuoza'), 'question-category', 'shadow', 'answered', 'jev-1.13.0', 'product', 0.82, 'business', 'business', 'old', 'round:1', 180);
  perform pg_temp.forbidden(format('update public.jev_decisions set mode = ''on'' where workspace_id = %L', pg_temp.ws('vertuoza')), 'the service role');
  perform pg_temp.forbidden(format('update public.jev_calls set counted = ''x'' where workspace_id = %L', pg_temp.ws('vertuoza')), 'the service role');
  perform pg_temp.forbidden(format('delete from public.workspace_secrets where workspace_id = %L', pg_temp.ws('vertuoza')), 'the service role');
end $$;
reset role;

-- A member reads the call; another workspace's owner does not.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081b1');
do $$
begin
  if (select count(*) from public.jev_calls where decision = 'question-category') <> 1 then
    raise exception 'FAIL: a member does not read their workspace''s Jev calls';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000081c1');
do $$
begin
  if exists (select 1 from public.jev_calls) then raise exception 'FAIL: another workspace''s owner reads Vertuoza''s Jev calls'; end if;
end $$;
reset role;

rollback;

\echo 'jev: every check passed'
