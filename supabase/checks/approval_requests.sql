-- Asking a PRD's approvers (PRD 1322 s2). The supabase workflow runs it on every pull request, after
-- `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/approval_requests.sql
-- approval_request() asks the product's members asked to approve except the PRD's author, or the
-- author alone when nobody else is (no product, nobody asked, or only the author); a skipped member is
-- never asked. A second request is `re-asked`. Signed out, a stranger to the workspace and a PRD born in
-- the repository are refused. approval_requests and approval_voids are read by members only and
-- written by nobody directly, never changed. approval_recipients() is the service role's alone and
-- names an address or a device only behind its switch. approval_requests_waiting() lists, for the
-- person asked, the latest request with no approval since. One transaction, rolled back at the end.
-- Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000c00a1', 'owen@ar.test'),
  ('00000000-0000-4000-8000-0000000c00a2', 'ada@ar.test'),
  ('00000000-0000-4000-8000-0000000c00a3', 'sam@ar.test'),
  ('00000000-0000-4000-8000-0000000c00a4', 'irisa@ar.test'),
  ('00000000-0000-4000-8000-0000000c00c1', 'carl@ar-other.test');
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-0000000c0000', 'ar', 'AR', 'ar-org'),
  ('00000000-0000-4000-8000-0000000c0100', 'ar-other', 'Other', 'ar-other');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c00a1', 'owner'),
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c00a2', 'member'),
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c00a3', 'member'),
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c00a4', 'member'),
  ('00000000-0000-4000-8000-0000000c0100', '00000000-0000-4000-8000-0000000c00c1', 'owner');
-- Mobile lists Irisa asked, Ada asked (she authors the PRDs) and Sam skipped; Solo lists only Ada.
-- ar-org/mobile is Mobile's, ar-org/solo Solo's, ar-org/loose nobody's, ar-org/old was born in the repo.
insert into public.businesses (id, workspace_id, name) values
  ('00000000-0000-4000-8000-0000000c0b00', '00000000-0000-4000-8000-0000000c0000', 'AR');
insert into public.products (id, workspace_id, business_id, name) values
  ('00000000-0000-4000-8000-0000000c0d01', '00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c0b00', 'Mobile'),
  ('00000000-0000-4000-8000-0000000c0d02', '00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c0b00', 'Solo');
insert into public.repositories (workspace_id, full_name) values
  ('00000000-0000-4000-8000-0000000c0000', 'ar-org/mobile'),
  ('00000000-0000-4000-8000-0000000c0000', 'ar-org/solo'),
  ('00000000-0000-4000-8000-0000000c0000', 'ar-org/loose'),
  ('00000000-0000-4000-8000-0000000c0000', 'ar-org/old');
insert into public.product_repositories (product_id, workspace_id, repository, added_by) values
  ('00000000-0000-4000-8000-0000000c0d01', '00000000-0000-4000-8000-0000000c0000', 'ar-org/mobile', 'person'),
  ('00000000-0000-4000-8000-0000000c0d02', '00000000-0000-4000-8000-0000000c0000', 'ar-org/solo', 'person');
insert into public.product_approvers (workspace_id, product_id, user_id, state) values
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c0d01', '00000000-0000-4000-8000-0000000c00a4', 'asked'),
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c0d01', '00000000-0000-4000-8000-0000000c00a2', 'asked'),
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c0d01', '00000000-0000-4000-8000-0000000c00a3', 'skipped'),
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c0d02', '00000000-0000-4000-8000-0000000c00a2', 'asked');
insert into public.players (workspace_id, user_id, display_name, github_login, hero) values
  ('00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c00a4', 'IRISA', 'Irisa-GH', '{"v":1,"body":"girl","skin":2,"hair":3,"suit":0,"cape":8}');
-- Irisa turned both channels on, with one device; Sam turned only email on and has a device anyway.
insert into public.alert_channels (user_id, push, email) values
  ('00000000-0000-4000-8000-0000000c00a4', true, true),
  ('00000000-0000-4000-8000-0000000c00a3', false, true);
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth, device_label) values
  ('00000000-0000-4000-8000-0000000c0e01', '00000000-0000-4000-8000-0000000c00a4', 'https://push.example/irisa', 'key', 'secret', 'Phone'),
  ('00000000-0000-4000-8000-0000000c0e02', '00000000-0000-4000-8000-0000000c00a3', 'https://push.example/sam', 'key', 'secret', 'Phone');

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.approval_requests limit 1; raise exception 'FAIL: anon read the approval requests';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.approval_voids limit 1; raise exception 'FAIL: anon read the approval voids';
  exception when insufficient_privilege then null; end;
  begin perform public.approval_request('ar-org/mobile', 1); raise exception 'FAIL: anon asked for an approval';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada pushes four PRDs: three ◆, and one born in the repository ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000c00a2', 'ada@ar.test');
do $$
declare
  repo text;
  prd  int;
  made jsonb;
begin
  foreach repo in array array['ar-org/mobile', 'ar-org/solo', 'ar-org/loose', 'ar-org/old'] loop
    prd := array_position(array['ar-org/mobile', 'ar-org/solo', 'ar-org/loose', 'ar-org/old'], repo);
    made := public.dossier_push(repo, prd, 'Asked ' || prd, null, jsonb_build_array(
      jsonb_build_object('kind', 'spec', 'content', format(E'---\nprd: %s\nphase0: %s\n---\n\n# Asked\n', prd, case when repo = 'ar-org/old' then 'pr' else 'server' end)),
      jsonb_build_object('kind', 'plan', 'content', 'plan'),
      jsonb_build_object('kind', 'before-after', 'content', '<p>before</p>')));
    insert into ids values (split_part(repo, '/', 2), (made ->> 'id')::uuid);
  end loop;
end $$;

-- ── Ada asks Mobile's approvers: Irisa only (not Ada, the author; not Sam, skipped) ──
do $$
declare
  made jsonb;
begin
  made := public.approval_request('AR-org/Mobile ', 1);
  if made -> 'asked' <> jsonb_build_array(jsonb_build_object('user', '00000000-0000-4000-8000-0000000c00a4', 'login', 'irisa-gh', 'name', 'IRISA')) then
    raise exception 'FAIL: Mobile''s request asked %', made -> 'asked';
  end if;
  if (made ->> 'nobodyElse')::boolean or made ->> 'product' <> 'Mobile' or made ->> 'author' <> 'ada@ar.test' or made ->> 'kind' <> 'asked'
     or (made ->> 'prd')::int <> 1 or made ->> 'repo' <> 'ar-org/mobile' or made ->> 'title' <> 'Asked 1' then
    raise exception 'FAIL: Mobile''s request answered %', made - 'spec' - 'files' - 'asked';
  end if;
  if made ->> 'spec' not like '%# Asked%' or jsonb_array_length(made -> 'files') <> 3 or made -> 'files' -> 0 ->> 'kind' <> 'spec' then
    raise exception 'FAIL: Mobile''s request carried % and %', made ->> 'spec', made -> 'files';
  end if;
  insert into ids values ('mobile-request', (made ->> 'id')::uuid);

  -- Asking again is re-asked, a new row.
  made := public.approval_request('ar-org/mobile', 1);
  if made ->> 'kind' <> 're-asked' then raise exception 'FAIL: a second request was %', made ->> 'kind'; end if;
  if (select count(*) from public.approval_requests where dossier_id = (select id from ids where name = 'mobile')) <> 2 then
    raise exception 'FAIL: a second request did not append a row';
  end if;

  -- Solo lists only Ada, the author: she is asked, nobody else.
  made := public.approval_request('ar-org/solo', 2);
  if not (made ->> 'nobodyElse')::boolean or made -> 'asked' -> 0 ->> 'user' <> '00000000-0000-4000-8000-0000000c00a2'
     or jsonb_array_length(made -> 'asked') <> 1 then
    raise exception 'FAIL: Solo''s request answered %', made -> 'asked';
  end if;

  -- No product: the author, and no product named.
  made := public.approval_request('ar-org/loose', 3);
  if not (made ->> 'nobodyElse')::boolean or made -> 'product' <> 'null'::jsonb or made -> 'asked' -> 0 ->> 'login' <> 'ada@ar.test' then
    raise exception 'FAIL: the productless request answered %', made - 'spec' - 'files';
  end if;

  -- Refusals: a PRD born in the repository, no such PRD.
  begin perform public.approval_request('ar-org/old', 4); raise exception 'FAIL: a ◇ PRD was asked for';
  exception when invalid_parameter_value then null; end;
  begin perform public.approval_request('ar-org/mobile', 99); raise exception 'FAIL: a missing PRD was asked for';
  exception when no_data_found then null; end;

  -- Nobody writes the tables directly.
  begin
    insert into public.approval_requests (dossier_id, workspace_id, asked_by, asked, nobody_else, kind)
    values ((select id from ids where name = 'mobile'), '00000000-0000-4000-8000-0000000c0000', '00000000-0000-4000-8000-0000000c00a2', '{}', true, 'asked');
    raise exception 'FAIL: a member wrote a request directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.approval_requests set kind = 'asked';
    raise exception 'FAIL: a member changed a request';
  exception when insufficient_privilege then null; end;
  begin perform public.approval_recipients((select id from ids where name = 'mobile-request'));
    raise exception 'FAIL: a member read the recipients';
  exception when insufficient_privilege then null; end;
end $$;

-- ── Irisa's bell holds Mobile's request; Sam's holds nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000c00a4', 'irisa@ar.test');
do $$
declare
  waiting jsonb := public.approval_requests_waiting();
begin
  if jsonb_array_length(waiting) <> 1 or waiting -> 0 ->> 'dossier' <> (select id::text from ids where name = 'mobile')
     or (waiting -> 0 ->> 'prd')::int <> 1 or waiting -> 0 ->> 'title' <> 'Asked 1' then
    raise exception 'FAIL: Irisa''s bell held %', waiting;
  end if;
  -- She approves: the request no longer waits.
  perform public.dossier_approve((select id from ids where name = 'mobile'));
  if jsonb_array_length(public.approval_requests_waiting()) <> 0 then
    raise exception 'FAIL: an approved PRD still waits in the bell';
  end if;
end $$;

select pg_temp.sign_in('00000000-0000-4000-8000-0000000c00a3', 'sam@ar.test');
do $$
begin
  if jsonb_array_length(public.approval_requests_waiting()) <> 0 then raise exception 'FAIL: a skipped member''s bell held a request'; end if;
  if (select count(*) from public.approval_requests) <> 4 then raise exception 'FAIL: a member did not read the requests'; end if;
end $$;

-- ── Carl, of another workspace, reads nothing and asks nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000c00c1', 'carl@ar-other.test');
do $$
begin
  if exists (select 1 from public.approval_requests) then raise exception 'FAIL: another workspace read the requests'; end if;
  if jsonb_array_length(public.approval_requests_waiting()) <> 0 then raise exception 'FAIL: another workspace''s bell held a request'; end if;
  begin perform public.approval_request('ar-org/mobile', 1); raise exception 'FAIL: a stranger asked for an approval';
  exception when no_data_found then null; end;
end $$;

-- ── The service role reads who is reached, and how ──
reset role;
set local role service_role;
do $$
declare
  reached jsonb := public.approval_recipients((select id from ids where name = 'mobile-request'));
begin
  if reached <> jsonb_build_array(jsonb_build_object(
       'user', '00000000-0000-4000-8000-0000000c00a4', 'email', 'irisa@ar.test',
       'devices', jsonb_build_array(jsonb_build_object('id', '00000000-0000-4000-8000-0000000c0e01',
         'endpoint', 'https://push.example/irisa', 'p256dh', 'key', 'auth', 'secret')))) then
    raise exception 'FAIL: Mobile''s request reached %', reached;
  end if;
end $$;
reset role;

-- Sam (email on, push off) asked through a request of his own: his address, none of his devices.
insert into public.approval_requests (id, dossier_id, workspace_id, asked_by, asked, nobody_else, kind) values
  ('00000000-0000-4000-8000-0000000c0f01', (select id from ids where name = 'loose'), '00000000-0000-4000-8000-0000000c0000',
   '00000000-0000-4000-8000-0000000c00a3', array['00000000-0000-4000-8000-0000000c00a3'::uuid, '00000000-0000-4000-8000-0000000c00a1'::uuid], true, 're-asked');
set local role service_role;
do $$
declare
  reached jsonb := public.approval_recipients('00000000-0000-4000-8000-0000000c0f01');
begin
  if reached <> jsonb_build_array(
       jsonb_build_object('user', '00000000-0000-4000-8000-0000000c00a3', 'email', 'sam@ar.test', 'devices', '[]'::jsonb),
       jsonb_build_object('user', '00000000-0000-4000-8000-0000000c00a1', 'email', null, 'devices', '[]'::jsonb)) then
    raise exception 'FAIL: switches were not honoured: %', reached;
  end if;
end $$;
reset role;

-- A void is never changed either.
insert into public.approval_voids (approval_id, dossier_id, kind, from_sha256, to_sha256, pusher_login, version_id)
select a.id, a.dossier_id, 'spec', repeat('a', 64), repeat('b', 64), 'ada', (a.files -> 0 ->> 'version_id')::uuid from public.approvals a limit 1;
do $$
begin
  begin
    update public.approval_voids set kind = 'plan';
    raise exception 'FAIL: a void was changed';
  exception when insufficient_privilege then null; end;
end $$;

rollback;
