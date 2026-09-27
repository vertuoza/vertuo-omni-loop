-- Who may read and write the outboxes and the sends (PRD 251). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/outbox_answers.sql
-- Accounts each with its own JWT. A dossier's outbox is read by every member of its workspace and by
-- nobody else, and nobody writes the table directly: dossier_outbox_put(), which only the service role
-- calls, finds or creates the dossier by its key and keeps only a newer evaluation. A send is inserted
-- by a member of its dossier's workspace, as themselves, read only by its owner, and its outcome
-- recorded once, by its owner, through outbox_send_done(); nobody updates or deletes one directly.
-- dossier_list() returns each dossier's open questions. One transaction, rolled back at the end. Any
-- `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme, owns the GitHub organisation acme. Ada and Bob belong to Vertuoza (which
-- owns the organisation vertuoza), Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, now() - interval '1 day'
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('vertuoza', '00000000-0000-4000-8000-0000000000b1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- An outbox as the App sends it: two open items, one adopted.
create function pg_temp.outbox(n_open int) returns jsonb language sql as $$
  select jsonb_build_object(
    'numbering', '[]'::jsonb,
    'open', coalesce((select jsonb_agg(jsonb_build_object('number', i, 'id', 's1-0' || i, 'text', 'item')) from generate_series(1, n_open) i), '[]'::jsonb),
    'adopted', '[{"number": 9, "id": "s1-09", "text": "item"}]'::jsonb,
    'pending', '[]'::jsonb,
    'settled', '[]'::jsonb);
$$;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.dossier_outboxes limit 1; raise exception 'FAIL: anon read the outboxes';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.outbox_sends limit 1; raise exception 'FAIL: anon read the sends';
  exception when insufficient_privilege then null; end;
  begin
    perform public.dossier_outbox_put('vertuoza/vertuo-omni-loop', 7, 12, 'https://github.com/vertuoza/vertuo-omni-loop/pull/12', 'abc1234', 'open', '{}', now());
    raise exception 'FAIL: anon stored an outbox';
  exception when insufficient_privilege then null; end;
  begin perform public.outbox_send_done(gen_random_uuid(), 'https://x', 'ada', true, null); raise exception 'FAIL: anon recorded a send';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── The page's route, as the service role: finds or creates the dossier, keeps only a newer outbox ──
-- Each call runs as the service role; what it stored is read back as the database's owner, since the
-- service role reads no outbox itself.
create temporary table puts (step text primary key, answer jsonb);
grant select, insert on puts to service_role;

set local role service_role;
insert into puts values ('first', public.dossier_outbox_put('Vertuoza/Vertuo-Omni-Loop', 7, 12,
  'https://github.com/vertuoza/vertuo-omni-loop/pull/12', 'abc1234', 'open', pg_temp.outbox(2), '2026-09-27 10:00:00+00'));
reset role;
do $$
declare
  put jsonb := (select answer from puts where step = 'first');
  kept uuid := (put ->> 'id')::uuid;
begin
  if (put ->> 'stale')::boolean then raise exception 'FAIL: a first outbox was stale: %', put; end if;
  if not exists (
    select 1 from public.dossiers d join public.workspaces w on w.id = d.workspace_id
     where d.id = kept and w.slug = 'vertuoza' and d.home_repo = 'vertuoza/vertuo-omni-loop' and d.prd = 7
       and d.numbered_at is not null and d.title = 'PRD 7' and d.opened_by is null) then
    raise exception 'FAIL: the outbox did not create its dossier by its key, in the workspace of the organisation';
  end if;
  if not exists (select 1 from public.dossier_outboxes o where o.dossier_id = kept and o.pr_number = 12 and o.state = 'open'
                  and o.head_sha = 'abc1234' and jsonb_array_length(o.outbox -> 'open') = 2) then
    raise exception 'FAIL: the outbox was not stored as sent';
  end if;
  insert into ids values ('dossier', kept);
end $$;

-- An older evaluation changes nothing; a newer one replaces it, on the same dossier.
set local role service_role;
insert into puts values ('older', public.dossier_outbox_put('vertuoza/vertuo-omni-loop', 7, 12,
  'https://github.com/vertuoza/vertuo-omni-loop/pull/12', 'def5678', 'open', pg_temp.outbox(5), '2026-09-27 09:00:00+00'));
reset role;
do $$
declare
  put jsonb := (select answer from puts where step = 'older');
begin
  if not (put ->> 'stale')::boolean or (put ->> 'id')::uuid <> (select id from ids where name = 'dossier') then
    raise exception 'FAIL: an older outbox was not stale: %', put;
  end if;
  if (select o.head_sha from public.dossier_outboxes o) <> 'abc1234' then
    raise exception 'FAIL: an older outbox replaced a newer one';
  end if;
end $$;

set local role service_role;
insert into puts values ('newer', public.dossier_outbox_put('vertuoza/vertuo-omni-loop', 7, 12,
  'https://github.com/vertuoza/vertuo-omni-loop/pull/12', 'fed9876', 'open', pg_temp.outbox(3), '2026-09-27 11:00:00+00'));
reset role;
do $$
declare
  put jsonb := (select answer from puts where step = 'newer');
begin
  if (put ->> 'stale')::boolean or (put ->> 'id')::uuid <> (select id from ids where name = 'dossier') then
    raise exception 'FAIL: a newer outbox was not stored: %', put;
  end if;
  if (select count(*) from public.dossier_outboxes) <> 1
     or (select jsonb_array_length(o.outbox -> 'open') from public.dossier_outboxes o) <> 3 then
    raise exception 'FAIL: a newer outbox did not replace the stored one';
  end if;
end $$;

-- An existing dossier of the same key is found, not duplicated: the kit pushed PRD 8 first.
insert into public.dossiers (workspace_id, home_repo, prd, title, numbered_at)
select id, 'vertuoza/vertuo-omni-loop', 8, 'Team inbox', now() from public.workspaces where slug = 'vertuoza';
set local role service_role;
insert into puts values ('found', public.dossier_outbox_put('vertuoza/vertuo-omni-loop', 8, 13,
  'https://github.com/vertuoza/vertuo-omni-loop/pull/13', 'abc1234', 'open', pg_temp.outbox(1), now()));
reset role;
do $$
begin
  if (select count(*) from public.dossiers where home_repo = 'vertuoza/vertuo-omni-loop' and prd = 8) <> 1
     or (select d.title from public.dossiers d where d.id = ((select answer from puts where step = 'found') ->> 'id')::uuid) <> 'Team inbox' then
    raise exception 'FAIL: an outbox did not find the dossier already keyed by its repository and PRD';
  end if;
end $$;

set local role service_role;
do $$
begin
  -- No workspace owns the organisation: refused, and nothing written.
  begin
    perform public.dossier_outbox_put('nobody/widgets', 7, 1, 'https://github.com/nobody/widgets/pull/1', 'abc1234', 'open', '{}', now());
    raise exception 'FAIL: an outbox of an organisation no workspace owns was stored';
  exception when no_data_found then null; end;

  -- A malformed call is refused.
  begin
    perform public.dossier_outbox_put('vertuoza/vertuo-omni-loop', 7, 12, 'https://x', 'abc1234', 'reopened', '{}', now());
    raise exception 'FAIL: an outbox in an unknown state was stored';
  exception when invalid_parameter_value then null; end;

  -- Nobody writes the table directly, not even the service role.
  begin
    insert into public.dossier_outboxes (dossier_id, pr_number, pr_url, head_sha, state, outbox, evaluated_at)
    values ((select id from ids where name = 'dossier'), 1, 'https://x', 'abc1234', 'open', '{}', now());
    raise exception 'FAIL: the service role wrote an outbox directly';
  exception when insufficient_privilege then null; end;
end $$;
-- An outbox of acme's repository goes to Acme's dossier.
insert into puts values ('acme', public.dossier_outbox_put('acme/widgets', 3, 4, 'https://github.com/acme/widgets/pull/4',
  'abc1234', 'open', pg_temp.outbox(1), now()));
reset role;
do $$
begin
  if exists (select 1 from public.dossiers where home_repo = 'nobody/widgets') then
    raise exception 'FAIL: a refused outbox created a dossier';
  end if;
  if (select w.slug from public.dossiers d join public.workspaces w on w.id = d.workspace_id
       where d.id = ((select answer from puts where step = 'acme') ->> 'id')::uuid) <> 'acme' then
    raise exception 'FAIL: an outbox of an acme repository did not go to the workspace of the acme organisation';
  end if;
  insert into ids values ('acme', ((select answer from puts where step = 'acme') ->> 'id')::uuid);
end $$;

-- ── Signed in, nobody calls the store ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  begin
    perform public.dossier_outbox_put('vertuoza/vertuo-omni-loop', 7, 12, 'https://x', 'abc1234', 'open', '{}', now() + interval '1 day');
    raise exception 'FAIL: a signed-in account stored an outbox';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada, a member: reads the outbox, writes it in no way, sends, and records her send once ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  kept uuid := (select id from ids where name = 'dossier');
  sent uuid;
begin
  if not exists (select 1 from public.dossier_outboxes where dossier_id = kept) then
    raise exception 'FAIL: a member did not read the outbox of her workspace''s dossier';
  end if;
  if exists (select 1 from public.dossier_outboxes where dossier_id = (select id from ids where name = 'acme')) then
    raise exception 'FAIL: a member read the outbox of another workspace''s dossier';
  end if;
  begin
    insert into public.dossier_outboxes (dossier_id, pr_number, pr_url, head_sha, state, outbox, evaluated_at)
    values (kept, 1, 'https://x', 'abc1234', 'open', '{}', now());
    raise exception 'FAIL: a member wrote an outbox directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.dossier_outboxes set state = 'closed' where dossier_id = kept;
    raise exception 'FAIL: a member rewrote an outbox';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.dossier_outboxes where dossier_id = kept;
    raise exception 'FAIL: a member deleted an outbox';
  exception when insufficient_privilege then null; end;

  insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash)
  values (kept, 12, E'1: A\n\n_answered on the Omni page · PRD 7_', 'hash-a')
  returning id into sent;
  if (select owner from public.outbox_sends where id = sent) <> '00000000-0000-4000-8000-0000000000a1' then
    raise exception 'FAIL: a send was not owned by the member who made it';
  end if;
  begin
    insert into public.outbox_sends (dossier_id, owner, pr_number, reply, nonce_hash)
    values (kept, '00000000-0000-4000-8000-0000000000b1', 12, '1: A', 'hash-forged');
    raise exception 'FAIL: a member made a send in another person''s name';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash, posted_at, comment_url)
    values (kept, 12, '1: A', 'hash-early', now(), 'https://x');
    raise exception 'FAIL: a member made a send already posted';
  exception when insufficient_privilege then null; end;

  begin
    perform public.outbox_send_done(sent, null, null, null, null);
    raise exception 'FAIL: a send was recorded with neither a link nor an error';
  exception when invalid_parameter_value then null; end;
  perform public.outbox_send_done(sent, 'https://github.com/vertuoza/vertuo-omni-loop/pull/12#issuecomment-1', 'ada', true, null);
  if not exists (select 1 from public.outbox_sends where id = sent and posted_at is not null and login = 'ada' and counted
                  and comment_url like '%issuecomment-1' and error is null) then
    raise exception 'FAIL: a send''s outcome was not recorded';
  end if;
  begin
    perform public.outbox_send_done(sent, null, null, null, 'posted twice');
    raise exception 'FAIL: a send''s outcome was recorded twice';
  exception when invalid_parameter_value then null; end;

  begin
    update public.outbox_sends set reply = 'rewritten' where id = sent;
    raise exception 'FAIL: a send was rewritten directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.outbox_sends where id = sent;
    raise exception 'FAIL: a send was deleted';
  exception when insufficient_privilege then null; end;
  insert into ids values ('ada-send', sent);
end $$;
reset role;

-- ── Bob, a member who is not the owner: reads the outbox, never Ada's send, and records nothing of it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  kept uuid := (select id from ids where name = 'dossier');
  mine uuid;
begin
  if not exists (select 1 from public.dossier_outboxes where dossier_id = kept) then
    raise exception 'FAIL: a second member did not read the outbox';
  end if;
  if exists (select 1 from public.outbox_sends where id = (select id from ids where name = 'ada-send')) then
    raise exception 'FAIL: a member read another person''s send';
  end if;
  begin
    perform public.outbox_send_done((select id from ids where name = 'ada-send'), null, null, null, 'not mine');
    raise exception 'FAIL: a member recorded the outcome of another person''s send';
  exception when no_data_found then null; end;
  insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash) values (kept, 12, '2: B because red', 'hash-b')
  returning id into mine;
  perform public.outbox_send_done(mine, null, null, null, 'GitHub is down');
  if not exists (select 1 from public.outbox_sends where id = mine and error = 'GitHub is down' and posted_at is null) then
    raise exception 'FAIL: a failed send''s error was not recorded';
  end if;
end $$;
reset role;

-- ── Carl, of another workspace: reads nothing of Vertuoza's, sends nothing on it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
declare
  kept uuid := (select id from ids where name = 'dossier');
begin
  if exists (select 1 from public.dossier_outboxes where dossier_id = kept) then
    raise exception 'FAIL: a member of another workspace read the outbox';
  end if;
  if not exists (select 1 from public.dossier_outboxes where dossier_id = (select id from ids where name = 'acme')) then
    raise exception 'FAIL: a member of Acme did not read Acme''s outbox';
  end if;
  if exists (select 1 from public.outbox_sends) then
    raise exception 'FAIL: a member of another workspace read a send';
  end if;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash) values (kept, 12, '1: A', 'hash-c');
    raise exception 'FAIL: a member of another workspace sent on Vertuoza''s dossier';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Eve, in no workspace: nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.dossier_outboxes) or exists (select 1 from public.outbox_sends) then
    raise exception 'FAIL: an account in no workspace read an outbox or a send';
  end if;
  begin
    insert into public.outbox_sends (dossier_id, pr_number, reply, nonce_hash) values ((select id from ids where name = 'dossier'), 12, '1: A', 'hash-e');
    raise exception 'FAIL: an account in no workspace sent';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── dossier_list() returns the open questions ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  kept uuid := (select id from ids where name = 'dossier');
  bare uuid;
begin
  if (select l.open_questions from public.dossier_list(kept) l) <> 3 then
    raise exception 'FAIL: dossier_list() did not count the open outbox''s open items';
  end if;
  bare := public.dossier_open('An idea', 'vertuoza/vertuo-omni-loop', null);
  if (select l.open_questions from public.dossier_list(bare) l) <> 0 then
    raise exception 'FAIL: dossier_list() counted open questions on a dossier with no outbox';
  end if;
end $$;
reset role;

set local role service_role;
select public.dossier_outbox_put('vertuoza/vertuo-omni-loop', 7, 12, 'https://github.com/vertuoza/vertuo-omni-loop/pull/12',
  'fed9876', 'merged', pg_temp.outbox(3), '2026-09-27 12:00:00+00');
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  if (select l.open_questions from public.dossier_list((select id from ids where name = 'dossier')) l) <> 0 then
    raise exception 'FAIL: dossier_list() counted open questions on a merged pull request''s outbox';
  end if;
end $$;
reset role;

-- ── Grants ──
do $$
begin
  if has_function_privilege('authenticated', 'public.dossier_outbox_put(text, integer, integer, text, text, text, jsonb, timestamptz)', 'execute')
     or not has_function_privilege('service_role', 'public.dossier_outbox_put(text, integer, integer, text, text, text, jsonb, timestamptz)', 'execute') then
    raise exception 'FAIL: dossier_outbox_put() is callable by the signed-in, or not by the service role';
  end if;
  if has_table_privilege('service_role', 'public.dossier_outboxes', 'insert, update, delete, truncate')
     or has_table_privilege('authenticated', 'public.dossier_outboxes', 'insert, update, delete, truncate') then
    raise exception 'FAIL: someone may write dossier_outboxes directly';
  end if;
  if has_table_privilege('authenticated', 'public.outbox_sends', 'update, delete, truncate')
     or has_any_column_privilege('authenticated', 'public.outbox_sends', 'update')
     or has_column_privilege('authenticated', 'public.outbox_sends', 'owner', 'insert')
     or has_column_privilege('authenticated', 'public.outbox_sends', 'posted_at', 'insert') then
    raise exception 'FAIL: the signed-in may rewrite a send, or set its owner or outcome';
  end if;
end $$;

select 'outbox answers checks passed' as result;
rollback;
