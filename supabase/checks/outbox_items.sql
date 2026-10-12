-- A product PRD's outbox on the server (PRD 1548 s5). The supabase workflow runs it on every pull
-- request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/outbox_items.sql
-- A member of the PRD's workspace puts an item on product PRD mobile-1: a row with its typed columns and
-- its markdown as written, rewritten while it is open. outbox_settle() appends one settlement, and a
-- second is refused; outbox_item_adopt() puts a medium item and settles it adopted at once. A settled item
-- never changes; a settlement is never updated or deleted, and an item never deleted, but by its dossier's
-- deletion. A non-member, signed in or out, settles nothing, and the members of another workspace read
-- nothing. Nobody signed in writes either table but through the three RPCs. One transaction, rolled back
-- at the end. Any `FAIL:` stops the run.

begin;

-- ── The tables ──
do $$
begin
  if not exists (select 1 from pg_class c where c.oid = 'public.outbox_items'::regclass and c.relrowsecurity)
     or not exists (select 1 from pg_class c where c.oid = 'public.outbox_settlements'::regclass and c.relrowsecurity) then
    raise exception 'FAIL: an outbox table has no row-level security';
  end if;
  if not has_table_privilege('authenticated', 'public.outbox_items', 'select')
     or not has_table_privilege('authenticated', 'public.outbox_settlements', 'select')
     or not has_table_privilege('service_role', 'public.outbox_items', 'select')
     or not has_table_privilege('service_role', 'public.outbox_settlements', 'select') then
    raise exception 'FAIL: a member or the service role cannot read the outbox';
  end if;
  if has_table_privilege('authenticated', 'public.outbox_items', 'insert, update, delete, truncate')
     or has_table_privilege('authenticated', 'public.outbox_settlements', 'insert, update, delete, truncate')
     or has_table_privilege('service_role', 'public.outbox_items', 'insert, update, delete, truncate')
     or has_table_privilege('service_role', 'public.outbox_settlements', 'insert, update, delete, truncate')
     or has_table_privilege('anon', 'public.outbox_items', 'select')
     or has_table_privilege('anon', 'public.outbox_settlements', 'select') then
    raise exception 'FAIL: the outbox is written other than through its RPCs, or read signed out';
  end if;
end $$;

-- ── The cast ──
-- Olga owns PK, Mo is a member of it; Carl owns PK Other; Sam belongs to no workspace. Each workspace
-- keys a product mobile, and each has its mobile-1. pk-org/app is PK's repository.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000015485a1', 'olga@pk5.test'),
  ('00000000-0000-4000-8000-0000015485b1', 'mo@pk5.test'),
  ('00000000-0000-4000-8000-0000015485c1', 'carl@pk5-other.test'),
  ('00000000-0000-4000-8000-0000015485d1', 'sam@pk5.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-000001548500', 'pk5', 'PK', 'pk-org'),
  ('00000000-0000-4000-8000-000001548501', 'pk5-other', 'PK Other', 'pk-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-000001548500', '00000000-0000-4000-8000-0000015485a1', 'owner'),
  ('00000000-0000-4000-8000-000001548500', '00000000-0000-4000-8000-0000015485b1', 'member'),
  ('00000000-0000-4000-8000-000001548501', '00000000-0000-4000-8000-0000015485c1', 'owner');
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000015485f0', '00000000-0000-4000-8000-000001548500', 'PK'),
  ('00000000-0000-4000-8000-0000015485f1', '00000000-0000-4000-8000-000001548501', 'PK Other');
insert into public.products (id, workspace_id, business_id, name, key) values
  ('00000000-0000-4000-8000-0000015485e1', '00000000-0000-4000-8000-000001548500', '00000000-0000-4000-8000-0000015485f0', 'Mobile', 'mobile'),
  ('00000000-0000-4000-8000-0000015485e9', '00000000-0000-4000-8000-000001548501', '00000000-0000-4000-8000-0000015485f1', 'Other', 'mobile');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-000001548500', 'pk-org/app');

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- An item's markdown, as the kit writes it.
create function pg_temp.body(item text, rank text default 'high') returns text language sql as $$
  select format(E'---\nid: %s\nprd: mobile-1\nslice: s5\nrank: %s\nbears-on: none\nraised: 2026-10-11\nwave: 1\n---\n\n## The question, in plain words\n\nWhich one?\n', item, rank);
$$;
-- Puts item `item` on PRD `<key>-<prd>`, ranked `rank`, raised in `repo`.
create function pg_temp.put(key text, prd integer, item text, rank text default 'high', repo text default 'pk-org/app') returns jsonb language sql as $$
  select public.outbox_item_put(key, prd, item, 's5', rank, 'none', 1, date '2026-10-11', pg_temp.body(item, rank), repo);
$$;
-- Settles item `item` of mobile-1 as `verdict`, from the Questions tab.
create function pg_temp.settle(item text, verdict text default 'agreed') returns jsonb language sql as $$
  select public.outbox_settle('mobile', 1, item, verdict, 'restates-the-choice', 'A. Keep it.', 'questions');
$$;
-- Runs a call that must be refused with `code`, its message holding `says` when given.
create function pg_temp.refused(stmt text, code text, why text, says text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if says is not null and sqlerrm <> says then raise exception 'FAIL: % said "%", not "%"', why, sqlerrm, says; end if;
end;
$$;
grant execute on function pg_temp.refused(text, text, text, text) to anon, authenticated, service_role;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- Each workspace's mobile-1, and PK's PRD 2 of pk-org/app, which is no mobile-2.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485b1');
insert into ids select 'mobile-1', (public.dossier_push(null, null, 'Offline photos', null, '[]', 'prd', null, 'mobile') ->> 'id')::uuid;
select public.dossier_push('pk-org/app', 2, 'Repo two', null, '[]');
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485c1');
insert into ids select 'other mobile-1', (public.dossier_push(null, null, 'Their photos', null, '[]', 'prd', null, 'mobile') ->> 'id')::uuid;
reset role;

-- ── Signed out: nothing ──
set local role anon;
select pg_temp.refused($$select pg_temp.put('mobile', 1, 's5-01-x')$$, '42501', 'anon put an item');
select pg_temp.refused($$select pg_temp.settle('s5-01-x')$$, '42501', 'anon settled an item');
select pg_temp.refused($$select public.outbox_item_adopt('mobile', 1, 's5-01-x', 's5', 'medium', 'none', 1, '2026-10-11', 'x')$$, '42501', 'anon adopted an item');
reset role;

-- ── An item: a row with its typed columns and its body ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485b1');
do $$
declare
  put  jsonb;
  item public.outbox_items;
begin
  put := public.outbox_item_put('mobile', 1, 's5-01-which-one', 's5', 'high', 'ADR-0095', 2, date '2026-10-11',
    pg_temp.body('s5-01-which-one'), 'PK-Org/App');
  if put - 'id' <> '{"item": "s5-01-which-one", "prdId": "mobile-1", "open": true}'::jsonb then
    raise exception 'FAIL: putting an item answered %', put;
  end if;
  insert into ids values ('s5-01', (put ->> 'id')::uuid);
  select i.* into item from public.outbox_items i where i.id = (put ->> 'id')::uuid;
  if item.dossier_id <> (select id from ids where name = 'mobile-1') or item.item <> 's5-01-which-one' or item.slice <> 's5'
     or item.rank <> 'high' or item.bears_on <> 'ADR-0095' or item.wave <> 2 or item.raised <> date '2026-10-11'
     or item.repository <> 'pk-org/app' or item.body <> pg_temp.body('s5-01-which-one')
     or item.raised_by <> '00000000-0000-4000-8000-0000015485b1' then
    raise exception 'FAIL: the item reads %', to_jsonb(item);
  end if;
  if exists (select 1 from public.outbox_settlements s where s.item_id = item.id) then
    raise exception 'FAIL: a new item is settled';
  end if;

  -- Put again while open: the same row, rewritten; its author stays.
  perform pg_sleep(0.01);
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000015485a1');
  put := public.outbox_item_put('mobile', 1, 's5-01-which-one', 's5', 'human-action', 'none', 2, date '2026-10-12',
    'reworded', null);
  if put ->> 'id' <> item.id::text then
    raise exception 'FAIL: putting an open item again made another row: %', put;
  end if;
  select i.* into item from public.outbox_items i where i.id = item.id;
  if item.rank <> 'human-action' or item.bears_on <> 'none' or item.raised <> date '2026-10-12' or item.body <> 'reworded'
     or item.repository is not null or item.updated_at <= item.raised_at or item.raised_by <> '00000000-0000-4000-8000-0000015485b1' then
    raise exception 'FAIL: the rewritten item reads %', to_jsonb(item);
  end if;
  if (select count(*) from public.outbox_items i where i.dossier_id = item.dossier_id) <> 1 then
    raise exception 'FAIL: putting an item twice left two rows';
  end if;
  perform pg_temp.sign_in('00000000-0000-4000-8000-0000015485b1');
end $$;

-- A put out of shape writes nothing.
select pg_temp.refused($$select pg_temp.put('mobile', 1, 'S5-01-x')$$, '22023', 'an id out of shape was put');
select pg_temp.refused($$select pg_temp.put('mobile', 1, 's5-1-x')$$, '22023', 'an id with a one-digit count was put');
select pg_temp.refused($$select pg_temp.put('mobile', 1, 's5-01-x', 'low')$$, '22023', 'a rank out of the three was put');
select pg_temp.refused($$select pg_temp.put('mobile', 1, 's5-01-x', 'high', 'not a repo')$$, '22023', 'a repository out of shape was put');
select pg_temp.refused($$select public.outbox_item_put('mobile', 1, 's5-01-x', 'S 5', 'high', 'none', 1, '2026-10-11', 'x')$$, '22023', 'a slice out of shape was put');
select pg_temp.refused($$select public.outbox_item_put('mobile', 1, 's5-01-x', 's5', 'high', ' ', 1, '2026-10-11', 'x')$$, '22023', 'an item bearing on nothing was put');
select pg_temp.refused($$select public.outbox_item_put('mobile', 1, 's5-01-x', 's5', 'high', 'none', 0, '2026-10-11', 'x')$$, '22023', 'wave 0 was put');
select pg_temp.refused($$select public.outbox_item_put('mobile', 1, 's5-01-x', 's5', 'high', 'none', 1, null, 'x')$$, '22023', 'an item with no raised date was put');
select pg_temp.refused($$select public.outbox_item_put('mobile', 1, 's5-01-x', 's5', 'high', 'none', 1, '2026-10-11', '')$$, '22023', 'an empty body was put');
select pg_temp.refused($$select pg_temp.put('Mobile', 1, 's5-01-x')$$, '22023', 'a key out of shape was put to');
select pg_temp.refused($$select pg_temp.put('mobile', 0, 's5-01-x')$$, '22023', 'PRD 0 was put to');
select pg_temp.refused($$select pg_temp.put('mobile', 99, 's5-01-x')$$, 'P0002', 'an item was put on a PRD that does not exist', 'No PRD mobile-99 in your workspaces.');
-- PRD 2 of pk-org/app is a PRD of a repository: its outbox stays in git, and it is no mobile-2.
select pg_temp.refused($$select pg_temp.put('mobile', 2, 's5-01-x')$$, 'P0002', 'an item was put on a PRD of a repository');
do $$
begin
  if exists (select 1 from public.outbox_items i where i.item = 's5-01-x') then
    raise exception 'FAIL: a refused put wrote a row';
  end if;
end $$;

-- ── Nobody signed in writes a table directly ──
select pg_temp.refused($$insert into public.outbox_items (dossier_id, item, slice, rank, bears_on, raised, wave, body, raised_by)
  values ((select id from ids where name = 'mobile-1'), 's5-09-x', 's5', 'high', 'none', '2026-10-11', 1, 'x', gen_random_uuid())$$,
  '42501', 'a member inserted an item');
select pg_temp.refused($$update public.outbox_items set body = 'x'$$, '42501', 'a member updated an item');
select pg_temp.refused($$delete from public.outbox_items$$, '42501', 'a member deleted an item');
select pg_temp.refused($$insert into public.outbox_settlements (item_id, verdict, basis, answer, channel, settled_by, settler_login)
  values ((select id from ids where name = 's5-01'), 'agreed', 'stated', 'A', 'questions', gen_random_uuid(), 'mo')$$,
  '42501', 'a member inserted a settlement');

-- ── A non-member settles nothing, and another workspace reads nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485c1');
select pg_temp.refused($$select pg_temp.settle('s5-01-which-one')$$, 'P0002', 'another workspace''s owner settled PK''s item', 'No item s5-01-which-one on PRD mobile-1.');
do $$
declare
  theirs jsonb;
begin
  -- Carl's mobile is his own: his put lands on his mobile-1, never on PK's.
  theirs := pg_temp.put('mobile', 1, 's5-01-which-one');
  if (select dossier_id from public.outbox_items where id = (theirs ->> 'id')::uuid) <> (select id from ids where name = 'other mobile-1') then
    raise exception 'FAIL: another workspace''s put reached PK''s mobile-1';
  end if;
  insert into ids values ('other s5-01', (theirs ->> 'id')::uuid);
  if exists (select 1 from public.outbox_items i where i.dossier_id = (select id from ids where name = 'mobile-1')) then
    raise exception 'FAIL: another workspace read PK''s items';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485d1');
select pg_temp.refused($$select pg_temp.settle('s5-01-which-one')$$, 'P0002', 'an account in no workspace settled an item', 'No PRD mobile-1 in your workspaces.');
select pg_temp.refused($$select pg_temp.put('mobile', 1, 's5-02-x')$$, 'P0002', 'an account in no workspace put an item');
do $$
begin
  if exists (select 1 from public.outbox_items) or exists (select 1 from public.outbox_settlements) then
    raise exception 'FAIL: an account in no workspace read an outbox';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485b1');
do $$
begin
  if exists (select 1 from public.outbox_settlements s where s.item_id = (select id from ids where name = 's5-01')) then
    raise exception 'FAIL: a refused settle wrote a settlement';
  end if;
  if exists (select 1 from public.outbox_items i where i.id = (select id from ids where name = 'other s5-01')) then
    raise exception 'FAIL: PK read another workspace''s item';
  end if;
end $$;

-- ── Settling: one settlement, appended ──
select pg_temp.refused($$select pg_temp.settle('s5-01-which-one', 'adopted')$$, '22023', 'an answer settled an item adopted');
select pg_temp.refused($$select public.outbox_settle('mobile', 1, 's5-01-which-one', 'agreed', '', 'A', 'questions')$$, '22023', 'a settlement with no basis ran');
select pg_temp.refused($$select public.outbox_settle('mobile', 1, 's5-01-which-one', 'agreed', 'stated', ' ', 'questions')$$, '22023', 'a settlement with no answer ran');
select pg_temp.refused($$select public.outbox_settle('mobile', 1, 's5-01-which-one', 'agreed', 'stated', 'A', 'github')$$, '22023', 'an answer from GitHub settled a product PRD''s item');
select pg_temp.refused($$select pg_temp.settle('s5-07-nope')$$, 'P0002', 'an item that does not exist was settled', 'No item s5-07-nope on PRD mobile-1.');
do $$
declare
  settled jsonb;
  row     public.outbox_settlements;
begin
  settled := pg_temp.settle('s5-01-which-one');
  if settled ->> 'item' <> 's5-01-which-one' or settled ->> 'prdId' <> 'mobile-1' or settled ->> 'verdict' <> 'agreed'
     or settled ->> 'settledAt' is null then
    raise exception 'FAIL: settling an item answered %', settled;
  end if;
  select s.* into row from public.outbox_settlements s where s.id = (settled ->> 'id')::uuid;
  if row.item_id <> (select id from ids where name = 's5-01') or row.verdict <> 'agreed' or row.basis <> 'restates-the-choice'
     or row.answer <> 'A. Keep it.' or row.channel <> 'questions' or row.settled_by <> '00000000-0000-4000-8000-0000015485b1'
     or row.settler_login <> 'mo@pk5.test' then
    raise exception 'FAIL: the settlement reads %', to_jsonb(row);
  end if;
  insert into ids values ('s5-01 settled', row.id);
end $$;
-- acceptance 9: an item already settled cannot be settled again, nor rewritten.
select pg_temp.refused($$select pg_temp.settle('s5-01-which-one', 'drifted')$$, '22023', 'an item was settled twice', 'Item s5-01-which-one is already settled (agreed).');
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485a1');
select pg_temp.refused($$select public.outbox_settle('mobile', 1, 's5-01-which-one', 'drifted', 'stated', 'B', 'terminal')$$, '22023', 'the owner settled a settled item again');
select pg_temp.refused($$select pg_temp.put('mobile', 1, 's5-01-which-one')$$, '22023', 'a settled item was put again', 'Item s5-01-which-one is already settled: it never changes.');
do $$
begin
  if (select count(*) from public.outbox_settlements s where s.item_id = (select id from ids where name = 's5-01')) <> 1 then
    raise exception 'FAIL: a settled item has other than one settlement';
  end if;
end $$;

-- ── Adopting a medium item when it is raised ──
select pg_temp.refused($$select public.outbox_item_adopt('mobile', 1, 's5-02-a-high', 's5', 'high', 'none', 1, '2026-10-11', 'x')$$, '22023', 'a high item was adopted');
select pg_temp.refused($$select public.outbox_item_adopt('mobile', 1, 's5-01-which-one', 's5', 'medium', 'none', 1, '2026-10-11', 'x')$$, '22023', 'a settled item was adopted');
do $$
declare
  adopted jsonb;
  row     public.outbox_settlements;
begin
  adopted := public.outbox_item_adopt('mobile', 1, 's5-03-keep-it', 's5', 'medium', 'none', 1, date '2026-10-11',
    pg_temp.body('s5-03-keep-it', 'medium'), 'pk-org/app');
  if adopted ->> 'item' <> 's5-03-keep-it' or adopted ->> 'prdId' <> 'mobile-1' or adopted ->> 'verdict' <> 'adopted' then
    raise exception 'FAIL: adopting an item answered %', adopted;
  end if;
  if (select rank from public.outbox_items where id = (adopted ->> 'id')::uuid) <> 'medium' then
    raise exception 'FAIL: the adopted item was not kept';
  end if;
  select s.* into row from public.outbox_settlements s where s.item_id = (adopted ->> 'id')::uuid;
  if row.verdict <> 'adopted' or row.basis <> 'adopted-when-raised' or row.answer is not null or row.channel is not null
     or row.settled_by <> '00000000-0000-4000-8000-0000015485a1' then
    raise exception 'FAIL: the adoption reads %', to_jsonb(row);
  end if;
  if (select count(*) from public.outbox_settlements s where s.item_id = (adopted ->> 'id')::uuid) <> 1 then
    raise exception 'FAIL: an adoption left other than one settlement';
  end if;
end $$;
select pg_temp.refused($$select pg_temp.settle('s5-03-keep-it', 'drifted')$$, '22023', 'an adopted item was settled again', 'Item s5-03-keep-it is already settled (adopted).');

-- Another workspace, and an account in none, read none of PK's settlements.
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485c1');
do $$
begin
  if exists (select 1 from public.outbox_settlements) or exists (select 1 from public.outbox_items i where i.item = 's5-03-keep-it') then
    raise exception 'FAIL: another workspace read PK''s settlements';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485d1');
do $$
begin
  if exists (select 1 from public.outbox_settlements) or exists (select 1 from public.outbox_items) then
    raise exception 'FAIL: an account in no workspace read a settlement';
  end if;
end $$;

-- A member reads the PRD's items and settlements; the service role reads them too.
select pg_temp.sign_in('00000000-0000-4000-8000-0000015485a1');
do $$
begin
  if (select count(*) from public.outbox_items i where i.dossier_id = (select id from ids where name = 'mobile-1')) <> 2
     or (select count(*) from public.outbox_settlements) <> 2 then
    raise exception 'FAIL: a member does not read their PRD''s outbox';
  end if;
end $$;
reset role;
set local role service_role;
do $$
begin
  if (select count(*) from public.outbox_items) < 3 or (select count(*) from public.outbox_settlements) < 2 then
    raise exception 'FAIL: the service role does not read the outbox';
  end if;
end $$;
reset role;

-- ── Append-only, even for the tables' owner ──
select pg_temp.refused($$update public.outbox_settlements set answer = 'B' where id = (select id from ids where name = 's5-01 settled')$$,
  '42501', 'a settlement was updated');
select pg_temp.refused($$delete from public.outbox_settlements where id = (select id from ids where name = 's5-01 settled')$$,
  '42501', 'a settlement was deleted');
select pg_temp.refused($$update public.outbox_items set body = 'changed' where id = (select id from ids where name = 's5-01')$$,
  '22023', 'a settled item was changed');
select pg_temp.refused($$update public.outbox_items set item = 's5-04-moved' where id = (select id from ids where name = 'other s5-01')$$,
  '22023', 'an item''s id changed');
select pg_temp.refused($$delete from public.outbox_items where id = (select id from ids where name = 'other s5-01')$$,
  '42501', 'an open item was deleted');
select pg_temp.refused($$insert into public.outbox_settlements (item_id, verdict, basis, answer, channel, settled_by, settler_login)
  values ((select id from ids where name = 'other s5-01'), 'adopted', 'stated', 'A', 'questions', gen_random_uuid(), 'x')$$,
  '23514', 'an adoption carrying an answer was written');
select pg_temp.refused($$insert into public.outbox_settlements (item_id, verdict, basis, settled_by, settler_login)
  values ((select id from ids where name = 'other s5-01'), 'agreed', 'stated', gen_random_uuid(), 'x')$$,
  '23514', 'an answer with no text was written');

-- Only the dossier's deletion takes its items and their settlements with it.
do $$
begin
  delete from public.dossiers d where d.id = (select id from ids where name = 'mobile-1');
  if exists (select 1 from public.outbox_items i where i.id = (select id from ids where name = 's5-01'))
     or exists (select 1 from public.outbox_settlements s where s.id = (select id from ids where name = 's5-01 settled')) then
    raise exception 'FAIL: a dossier''s deletion left its outbox behind';
  end if;
end $$;

rollback;

select 'outbox_items: every check passed' as result;
