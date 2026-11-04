-- A Tech Approval before the product approval (PRD 2608 s1). The supabase workflow runs it on every
-- pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/tech_approval.sql
-- dossier_request_tech_approval() lets only a ◆ PRD's author name one other member, once: a non-member,
-- a ◇ PRD, a product PRD and a roadmap are refused, and so are a second request, a withdrawal and a
-- rename by the author; a workspace owner names another person only once the named one left. Only the
-- named person gives it (dossier_approve(p, 'tech')); the product approval is refused while it is missing
-- or voided, and a PRD with no request approves as today, through the one-argument call an older caller
-- makes. A tech approval alone reads as no approval through dossier_approval(); a push changing a pinned
-- file voids both kinds; approval_requests_waiting() lists the tech request for the named person until it
-- is given, and again once voided. One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000e00a1', 'owen@ta.test'),
  ('00000000-0000-4000-8000-0000000e00a2', 'ada@ta.test'),
  ('00000000-0000-4000-8000-0000000e00a3', 'bea@ta.test'),
  ('00000000-0000-4000-8000-0000000e00a4', 'irisa@ta.test'),
  ('00000000-0000-4000-8000-0000000e00a5', 'dan@ta.test'),
  ('00000000-0000-4000-8000-0000000e00c1', 'carl@ta-other.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-0000000e0000', 'ta', 'TA', 'ta-org'),
  ('00000000-0000-4000-8000-0000000e0100', 'ta-other', 'Other', 'ta-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e00a1', 'owner'),
  ('00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e00a2', 'member'),
  ('00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e00a3', 'member'),
  ('00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e00a4', 'member'),
  ('00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e00a5', 'member'),
  ('00000000-0000-4000-8000-0000000e0100', '00000000-0000-4000-8000-0000000e00c1', 'owner');
-- ta-org/mobile is Mobile's, and Irisa its one approver. Bea's login is Bea-GH.
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000000e0b00', '00000000-0000-4000-8000-0000000e0000', 'TA');
insert into public.products (id, workspace_id, business_id, name, key) values
  ('00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e0b00', 'Mobile', 'tamobile');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-0000000e0000', 'ta-org/mobile');
insert into public.product_repositories (product_id, workspace_id, repository, added_by) values
  ('00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e0000', 'ta-org/mobile', 'person');
insert into public.product_approvers (workspace_id, product_id, user_id, state) values
  ('00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e0d01', '00000000-0000-4000-8000-0000000e00a4', 'asked');
insert into public.players (workspace_id, user_id, display_name, github_login, hero) values
  ('00000000-0000-4000-8000-0000000e0000', '00000000-0000-4000-8000-0000000e00a3', 'BEA', 'Bea-GH', '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}');

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- The caller pushes PRD `prd` of ta-org/mobile: `kinds` maps each kind to its content.
create function pg_temp.push(prd integer, kinds jsonb) returns jsonb language sql as $$
  select public.dossier_push('ta-org/mobile', prd, 'Tech ' || prd, null,
    (select jsonb_agg(jsonb_build_object('kind', k.key, 'content', k.value #>> '{}')) from jsonb_each(kinds) k));
$$;

-- A ◆ PRD's three files; `plan` changes the plan's text.
create function pg_temp.diamond(prd integer, plan text) returns jsonb language sql as $$
  select jsonb_build_object('spec', E'---\nprd: ' || prd || E'\nphase0: server\n---\n\n# Tech\n', 'plan', plan, 'before-after', '<p>before</p>');
$$;

-- Whether `body` raises `state`; any other outcome fails the run, naming `what`.
create function pg_temp.refused(what text, state text, body text) returns void language plpgsql as $$
begin
  begin
    execute body;
  exception when others then
    if sqlstate <> state then
      raise exception 'FAIL: % was refused with % (%), not %', what, sqlstate, sqlerrm, state;
    end if;
    return;
  end;
  raise exception 'FAIL: % was not refused', what;
end;
$$;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role, anon;

-- ── Every approval and every request reads `product` unless it names `tech` ──
do $$
begin
  if (select string_agg(table_name || ':' || is_nullable || ':' || column_default, ',' order by table_name)
        from information_schema.columns
       where table_schema = 'public' and table_name in ('approvals', 'approval_requests') and column_name = 'approval_kind')
     is distinct from 'approval_requests:NO:''product''::text,approvals:NO:''product''::text' then
    raise exception 'FAIL: approval_kind is not a required column defaulting to product on both tables';
  end if;
  if to_regprocedure('public.dossier_approve(uuid)') is not null then
    raise exception 'FAIL: the one-argument dossier_approve() still stands beside the one taking the kind';
  end if;
end $$;

set local role authenticated;

-- ── Ada pushes three ◆ PRDs and a ◇ one ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a2', 'ada@ta.test');
do $$
begin
  insert into ids values ('p1', (pg_temp.push(1, pg_temp.diamond(1, 'plan 1')) ->> 'id')::uuid);
  insert into ids values ('p3', (pg_temp.push(3, pg_temp.diamond(3, 'plan 3')) ->> 'id')::uuid);
  insert into ids values ('p4', (pg_temp.push(4, pg_temp.diamond(4, 'plan 4')) ->> 'id')::uuid);
  insert into ids values ('p2', (pg_temp.push(2, jsonb_build_object(
    'spec', E'---\nprd: 2\n---\n\n# Repo\n', 'plan', 'plan 2', 'before-after', '<p>before</p>')) ->> 'id')::uuid);
  if public.dossier_approval('ta-org/mobile', 1) ? 'tech' then
    raise exception 'FAIL: a PRD with no tech request read a tech state: %', public.dossier_approval('ta-org/mobile', 1);
  end if;
end $$;

-- A product PRD and a product roadmap, written as the database's owner.
reset role;
insert into public.dossiers (id, workspace_id, home_repo, kind, product_id, product_seq, title, opened_by, numbered_at, birthplace) values
  ('00000000-0000-4000-8000-0000000e0f01', '00000000-0000-4000-8000-0000000e0000', null, 'prd', '00000000-0000-4000-8000-0000000e0d01', 1, 'Product PRD', '00000000-0000-4000-8000-0000000e00a2', now(), 'server'),
  ('00000000-0000-4000-8000-0000000e0f02', '00000000-0000-4000-8000-0000000e0000', null, 'roadmap', '00000000-0000-4000-8000-0000000e0d01', 1, 'Roadmap', '00000000-0000-4000-8000-0000000e00a2', now(), 'server');
set local role authenticated;

-- ── Who may request, and what ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00c1', 'carl@ta-other.test');
select pg_temp.refused('a request by a non-member', '42501',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'bea-gh')$q$);

select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a3', 'bea@ta.test');
select pg_temp.refused('a request by a member who is not the author', '42501',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'ada@ta.test')$q$);

select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a2', 'ada@ta.test');
select pg_temp.refused('the author naming themselves', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'ada@ta.test')$q$);
select pg_temp.refused('naming someone outside the workspace', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'carl@ta-other.test')$q$);
select pg_temp.refused('naming nobody', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), '  ')$q$);
select pg_temp.refused('a request on a ◇ PRD', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p2'), 'bea-gh')$q$);
select pg_temp.refused('a request on a product PRD', '22023',
  $q$select public.dossier_request_tech_approval('00000000-0000-4000-8000-0000000e0f01', 'bea-gh')$q$);
select pg_temp.refused('a request on a roadmap', '22023',
  $q$select public.dossier_request_tech_approval('00000000-0000-4000-8000-0000000e0f02', 'bea-gh')$q$);
select pg_temp.refused('a request on no dossier', 'P0002',
  $q$select public.dossier_request_tech_approval('00000000-0000-4000-8000-0000000eeeee', 'bea-gh')$q$);
do $$
begin
  if exists (select 1 from public.approval_requests) then raise exception 'FAIL: a refused request left a row'; end if;
end $$;

-- ── Ada names Bea, by her login, an @ and any case ──
do $$
declare
  made jsonb := public.dossier_request_tech_approval((select id from ids where name = 'p1'), '@BEA-gh');
  row  public.approval_requests%rowtype;
  read jsonb;
begin
  select r.* into row from public.approval_requests r where r.id = (made ->> 'id')::uuid;
  if row.approval_kind <> 'tech' or row.asked <> array['00000000-0000-4000-8000-0000000e00a3'::uuid] or row.kind <> 'asked'
     or row.asked_by <> '00000000-0000-4000-8000-0000000e00a2' or row.nobody_else then
    raise exception 'FAIL: the tech request read %', to_jsonb(row);
  end if;
  if made ->> 'approvalKind' <> 'tech' or (made ->> 'prd')::int <> 1 or made ->> 'repo' <> 'ta-org/mobile'
     or made -> 'asked' <> jsonb_build_array(jsonb_build_object('user', '00000000-0000-4000-8000-0000000e00a3', 'login', 'bea-gh', 'name', 'BEA'))
     or made ->> 'author' <> 'ada@ta.test' or made ->> 'kind' <> 'asked' then
    raise exception 'FAIL: the request answered %', made;
  end if;
  insert into ids values ('tech-request', row.id);
  read := public.dossier_approval('ta-org/mobile', 1);
  if read -> 'approval' <> 'null'::jsonb or read -> 'tech' <> jsonb_build_object('login', 'bea-gh', 'state', 'asked') then
    raise exception 'FAIL: a requested PRD read %', read;
  end if;
end $$;

-- A second request, a rename and a withdrawal by the author are refused.
select pg_temp.refused('a second request', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'bea-gh')$q$);
select pg_temp.refused('a rename by the author', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'dan@ta.test')$q$);
select pg_temp.refused('a withdrawal', '42501',
  $q$delete from public.approval_requests where id = (select id from ids where name = 'tech-request')$q$);
reset role;
select pg_temp.refused('a withdrawal by the database''s owner', '42501',
  $q$delete from public.approval_requests where id = (select id from ids where name = 'tech-request')$q$);
set local role authenticated;

-- An owner renames nobody while Bea is still a member.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a1', 'owen@ta.test');
select pg_temp.refused('an owner''s rename while the named person is a member', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'dan@ta.test')$q$);

-- Ada asks the product's approvers too, as `omni wait approval` would: Irisa's bell lists it.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a2', 'ada@ta.test');
do $$
declare
  made jsonb := public.approval_request('ta-org/mobile', 1);
begin
  if made ->> 'kind' <> 'asked' then raise exception 'FAIL: the first product request read as %: a tech request is not a product one', made ->> 'kind'; end if;
  if (select approval_kind from public.approval_requests where id = (made ->> 'id')::uuid) <> 'product' then
    raise exception 'FAIL: approval_request() wrote another kind than product';
  end if;
end $$;

-- ── The waiting lists ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a3', 'bea@ta.test');
do $$
declare
  waiting jsonb := public.approval_requests_waiting();
begin
  if jsonb_array_length(waiting) <> 1 or waiting -> 0 ->> 'approvalKind' <> 'tech'
     or waiting -> 0 ->> 'id' <> (select id from ids where name = 'tech-request')::text or (waiting -> 0 ->> 'prd')::int <> 1 then
    raise exception 'FAIL: Bea waited on %', waiting;
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a4', 'irisa@ta.test');
do $$
declare
  waiting jsonb := public.approval_requests_waiting();
begin
  if jsonb_array_length(waiting) <> 1 or waiting -> 0 ->> 'approvalKind' <> 'product' then
    raise exception 'FAIL: Irisa waited on %', waiting;
  end if;
end $$;

-- ── The product approval waits for the tech one; only Bea gives that ──
select pg_temp.refused('the product approval before the tech one', '22023',
  $q$select public.dossier_approve((select id from ids where name = 'p1'))$q$);
select pg_temp.refused('the product approval, by name, before the tech one', '22023',
  $q$select public.dossier_approve((select id from ids where name = 'p1'), 'product')$q$);
select pg_temp.refused('a tech approval by a product approver', '42501',
  $q$select public.dossier_approve((select id from ids where name = 'p1'), 'tech')$q$);
select pg_temp.refused('an approval of no known kind', '22023',
  $q$select public.dossier_approve((select id from ids where name = 'p1'), 'legal')$q$);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a2', 'ada@ta.test');
select pg_temp.refused('a tech approval by the author', '42501',
  $q$select public.dossier_approve((select id from ids where name = 'p1'), 'tech')$q$);
select pg_temp.refused('a tech approval of a PRD with no tech request', '22023',
  $q$select public.dossier_approve((select id from ids where name = 'p3'), 'tech')$q$);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a4', 'irisa@ta.test');
do $$
begin
  begin
    perform public.dossier_approve((select id from ids where name = 'p1'));
  exception when others then
    if sqlerrm !~ 'bea-gh' then raise exception 'FAIL: the refusal did not name who it waits on: %', sqlerrm; end if;
  end;
  if exists (select 1 from public.approvals) then raise exception 'FAIL: a refused approval left a row'; end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a3', 'bea@ta.test');
do $$
declare
  made jsonb := public.dossier_approve((select id from ids where name = 'p1'), 'tech');
  read jsonb;
begin
  if made ->> 'kind' <> 'tech' or (made ->> 'prd')::int <> 1 then raise exception 'FAIL: the tech approval answered %', made; end if;
  insert into ids values ('tech-1', (made ->> 'id')::uuid);
  if (select approval_kind from public.approvals where id = (made ->> 'id')::uuid) <> 'tech' then
    raise exception 'FAIL: the tech approval was not recorded as tech';
  end if;
  if (select jsonb_array_length(files) from public.approvals where id = (made ->> 'id')::uuid) <> 3 then
    raise exception 'FAIL: the tech approval did not pin the PRD''s files';
  end if;
  -- A tech approval alone is no approval.
  read := public.dossier_approval('ta-org/mobile', 1);
  if read -> 'approval' <> 'null'::jsonb then raise exception 'FAIL: a tech approval alone read as the approval in force: %', read; end if;
  if read -> 'tech' <> jsonb_build_object('login', 'bea-gh', 'state', 'approved') then raise exception 'FAIL: the given tech approval read %', read -> 'tech'; end if;
  if jsonb_array_length(public.approval_requests_waiting()) <> 0 then raise exception 'FAIL: a given tech request still waited on Bea'; end if;
end $$;

-- The tech approval cleared nothing of Irisa's: her product request still waits on her.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a4', 'irisa@ta.test');
do $$
declare
  read jsonb;
begin
  if jsonb_array_length(public.approval_requests_waiting()) <> 1 then raise exception 'FAIL: a tech approval cleared the product request'; end if;
  insert into ids values ('product-1', (public.dossier_approve((select id from ids where name = 'p1')) ->> 'id')::uuid);
  read := public.dossier_approval('ta-org/mobile', 1);
  if read -> 'approval' -> 'approver' ->> 'login' <> 'irisa@ta.test' or read -> 'tech' ->> 'state' <> 'approved' then
    raise exception 'FAIL: both approvals read %', read;
  end if;
  if jsonb_array_length(public.approval_requests_waiting()) <> 0 then raise exception 'FAIL: the product request still waited once approved'; end if;
end $$;

-- ── A PRD with no request approves as today, through the one-argument call ──
do $$
declare
  read jsonb;
begin
  if exists (select 1 from public.approval_requests r where r.dossier_id = (select id from ids where name = 'p3')) then
    raise exception 'FAIL: PRD 3 holds a request';
  end if;
  perform public.dossier_approve((select id from ids where name = 'p3'));
  read := public.dossier_approval('ta-org/mobile', 3);
  if read -> 'approval' -> 'approver' ->> 'login' <> 'irisa@ta.test' or read ? 'tech' then
    raise exception 'FAIL: a PRD with no tech request read %', read;
  end if;
  if (select approval_kind from public.approvals a where a.dossier_id = (select id from ids where name = 'p3')) <> 'product' then
    raise exception 'FAIL: the one-argument call did not record a product approval';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a2', 'ada@ta.test');
select pg_temp.refused('a tech request on an approved PRD', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p3'), 'bea-gh')$q$);

-- ── A push changing a pinned file voids both kinds ──
do $$
declare
  read jsonb;
begin
  perform pg_temp.push(1, pg_temp.diamond(1, 'plan 1, changed'));
  if (select array_agg(x.approval_id order by x.approval_id) from public.approval_voids x where x.dossier_id = (select id from ids where name = 'p1'))
     is distinct from (select array_agg(id order by id) from ids where name in ('tech-1', 'product-1')) then
    raise exception 'FAIL: the push voided %', (select array_agg(x.approval_id) from public.approval_voids x);
  end if;
  read := public.dossier_approval('ta-org/mobile', 1);
  if jsonb_array_length(read -> 'approval' -> 'voids') <> 1 or read -> 'tech' <> jsonb_build_object('login', 'bea-gh', 'state', 'voided') then
    raise exception 'FAIL: the voided PRD read %', read;
  end if;
  if (select count(*) from jsonb_array_elements(public.approval_voids_of_push((select id from ids where name = 'p1'))) v
       where v ->> 'approvalKind' in ('product', 'tech')) <> 2 then
    raise exception 'FAIL: the push named %', public.approval_voids_of_push((select id from ids where name = 'p1'));
  end if;
end $$;

-- The voided tech request waits on Bea again, and the product approval waits for her.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a3', 'bea@ta.test');
do $$
begin
  if jsonb_array_length(public.approval_requests_waiting()) <> 1 or public.approval_requests_waiting() -> 0 ->> 'approvalKind' <> 'tech' then
    raise exception 'FAIL: a voided tech approval did not wait on Bea again: %', public.approval_requests_waiting();
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a4', 'irisa@ta.test');
select pg_temp.refused('the product approval while the tech one is voided', '22023',
  $q$select public.dossier_approve((select id from ids where name = 'p1'))$q$);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a3', 'bea@ta.test');
do $$
begin
  perform public.dossier_approve((select id from ids where name = 'p1'), 'tech');
  if public.dossier_approval('ta-org/mobile', 1) -> 'tech' ->> 'state' <> 'approved' then raise exception 'FAIL: the second tech approval was not in force'; end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a4', 'irisa@ta.test');
do $$
begin
  perform public.dossier_approve((select id from ids where name = 'p1'));
  if jsonb_array_length(public.dossier_approval('ta-org/mobile', 1) -> 'approval' -> 'voids') <> 0 then
    raise exception 'FAIL: the product approval given again was not in force';
  end if;
end $$;

-- ── The owner names another person once the named one left ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a2', 'ada@ta.test');
select public.dossier_request_tech_approval((select id from ids where name = 'p4'), 'bea-gh') is not null as requested;
reset role;
delete from public.workspace_members where user_id = '00000000-0000-4000-8000-0000000e00a3';
set local role authenticated;
select pg_temp.refused('a rename by the author once the named person left', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p4'), 'dan@ta.test')$q$);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a5', 'dan@ta.test');
select pg_temp.refused('a rename by a member who is not an owner', '42501',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p4'), 'dan@ta.test')$q$);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a1', 'owen@ta.test');
select pg_temp.refused('an owner naming the author', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p4'), 'ada@ta.test')$q$);
do $$
declare
  made jsonb := public.dossier_request_tech_approval((select id from ids where name = 'p4'), 'dan@ta.test');
begin
  if made ->> 'kind' <> 're-asked' or made -> 'asked' -> 0 ->> 'login' <> 'dan@ta.test' then
    raise exception 'FAIL: the owner''s rename answered %', made;
  end if;
  if public.dossier_approval('ta-org/mobile', 4) -> 'tech' <> jsonb_build_object('login', 'dan@ta.test', 'state', 'asked') then
    raise exception 'FAIL: the renamed request read %', public.dossier_approval('ta-org/mobile', 4) -> 'tech';
  end if;
end $$;
select pg_temp.refused('a second rename while the named person is a member', '22023',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p4'), 'irisa@ta.test')$q$);
select pg_temp.sign_in('00000000-0000-4000-8000-0000000e00a5', 'dan@ta.test');
do $$
begin
  if jsonb_array_length(public.approval_requests_waiting()) <> 1 then raise exception 'FAIL: the renamed request did not wait on Dan'; end if;
end $$;

-- ── Signed out: nothing ──
reset role;
set local role anon;
select pg_temp.refused('a request signed out', '42501',
  $q$select public.dossier_request_tech_approval((select id from ids where name = 'p1'), 'bea-gh')$q$);
reset role;

rollback;
