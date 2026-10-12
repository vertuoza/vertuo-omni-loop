-- Who may approve a PRD born on the server, and how an approval is kept (PRD 1299 s2). The supabase
-- workflow runs it on every pull request, after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/approvals.sql
-- A PRD dossier's first spec sets its birthplace once: `server` when its front matter says
-- `phase0: server`, `repo` otherwise, and nothing changes it after. dossier_approve() lets a member of the
-- dossier's workspace approve a numbered ◆ PRD holding a spec, a plan and a before/after, pinning the
-- latest version of each kind; it refuses a non-member, a ◇ dossier and a dossier missing a file. A
-- second approval adds a row and never changes the first; nobody updates or deletes one.
-- dossier_approval() answers the approval in force with the approver's login, whether they are a member
-- today, the time and each pinned file with its text, and nothing to an account of another workspace.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000a00a1', 'ada@appr.test'),
  ('00000000-0000-4000-8000-0000000a00b1', 'bob@appr.test'),
  ('00000000-0000-4000-8000-0000000a00c1', 'carl@other.test');
insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000a00a1', 'github', '9101', '{"sub": "9101", "user_name": "AdaGH"}', now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000a00b1', 'github', '9102', '{"sub": "9102", "user_name": "bob-gh"}', now(), now());
-- Appr owns the GitHub organisation appr; Ada and Bob belong to it, Carl only to Other.
insert into public.workspaces (id, slug, name, github_org) values
  ('00000000-0000-4000-8000-0000000a0000', 'appr', 'Appr', 'appr'),
  ('00000000-0000-4000-8000-0000000a0100', 'appr-other', 'Other', 'appr-other');
insert into public.workspace_members (workspace_id, user_id, joined_at) values
  ('00000000-0000-4000-8000-0000000a0000', '00000000-0000-4000-8000-0000000a00a1', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000a0000', '00000000-0000-4000-8000-0000000a00b1', now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000a0100', '00000000-0000-4000-8000-0000000a00c1', now() - interval '1 day');

create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.approvals limit 1; raise exception 'FAIL: anon read the approvals';
  exception when insufficient_privilege then null; end;
  begin perform public.dossier_approve(gen_random_uuid()); raise exception 'FAIL: anon approved';
  exception when insufficient_privilege then null; end;
  begin perform public.dossier_approval('appr/app', 9); raise exception 'FAIL: anon read an approval';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada pushes a ◆ PRD, a ◇ PRD and a ◆ PRD with no before/after ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000a00a1', 'ada@appr.test');
do $$
declare
  born jsonb;
  repo jsonb;
  bare jsonb;
begin
  born := public.dossier_push('appr/app', 9, 'Server born', null, jsonb_build_array(
    jsonb_build_object('kind', 'spec', 'content', E'---\nprd: 9\nphase0: server\n---\n\n# Server born\n'),
    jsonb_build_object('kind', 'plan', 'content', 'plan one'),
    jsonb_build_object('kind', 'before-after', 'content', '<p>before</p>'),
    jsonb_build_object('kind', 'voice', 'content', '{}')));
  repo := public.dossier_push('appr/app', 8, 'Repo born', null, jsonb_build_array(
    jsonb_build_object('kind', 'spec', 'content', E'---\nprd: 8\n---\n\n# Repo born\n'),
    jsonb_build_object('kind', 'plan', 'content', 'plan'),
    jsonb_build_object('kind', 'before-after', 'content', '<p>b</p>')));
  bare := public.dossier_push('appr/app', 10, 'No page yet', null, jsonb_build_array(
    jsonb_build_object('kind', 'spec', 'content', E'---\nphase0: "server"\n---\n'),
    jsonb_build_object('kind', 'plan', 'content', 'plan')));
  insert into ids values ('born', (born ->> 'id')::uuid), ('repo', (repo ->> 'id')::uuid), ('bare', (bare ->> 'id')::uuid);

  if (select birthplace from public.dossiers where id = (born ->> 'id')::uuid) is distinct from 'server' then
    raise exception 'FAIL: a spec saying phase0: server did not set the birthplace to server';
  end if;
  if (select birthplace from public.dossiers where id = (repo ->> 'id')::uuid) is distinct from 'repo' then
    raise exception 'FAIL: a spec without phase0 did not set the birthplace to repo';
  end if;
  if (select birthplace from public.dossiers where id = (bare ->> 'id')::uuid) is distinct from 'server' then
    raise exception 'FAIL: a quoted phase0: "server" did not set the birthplace to server';
  end if;

  -- A later spec never moves the birthplace.
  perform public.dossier_push('appr/app', 9, 'Server born', null, '[{"kind": "spec", "content": "no front matter now"}]');
  perform public.dossier_push('appr/app', 9, 'Server born', null,
    jsonb_build_array(jsonb_build_object('kind', 'spec', 'content', E'---\nprd: 9\nphase0: server\n---\n\n# Server born\n')));
  if (select birthplace from public.dossiers where id = (born ->> 'id')::uuid) is distinct from 'server' then
    raise exception 'FAIL: a later spec changed the birthplace';
  end if;

  -- Nothing is approved yet: the approval in force is none.
  if public.dossier_approval('APPR/app', 9) <> jsonb_build_object('dossier', born ->> 'id', 'approval', null) then
    raise exception 'FAIL: a PRD with no approval did not answer approval null: %', public.dossier_approval('appr/app', 9);
  end if;
  if public.dossier_approval('appr/app', 404) is not null then
    raise exception 'FAIL: a PRD with no dossier did not answer null';
  end if;

  -- Refusals: a ◇ dossier, a dossier missing its before/after, no such dossier.
  begin perform public.dossier_approve((repo ->> 'id')::uuid); raise exception 'FAIL: a ◇ dossier was approved';
  exception when invalid_parameter_value then
    if sqlerrm not like '%born in the repository%' then raise exception 'FAIL: a ◇ refusal said %', sqlerrm; end if;
  end;
  begin perform public.dossier_approve((bare ->> 'id')::uuid); raise exception 'FAIL: a dossier without a before/after was approved';
  exception when invalid_parameter_value then
    if sqlerrm not like '%no before-after yet%' then raise exception 'FAIL: a missing-file refusal said %', sqlerrm; end if;
  end;
  begin perform public.dossier_approve(gen_random_uuid()); raise exception 'FAIL: no dossier was approved';
  exception when no_data_found then null; end;

  -- Nobody signed in writes the table.
  begin
    insert into public.approvals (dossier_id, approved_by, approver_login, files)
    values ((born ->> 'id')::uuid, '00000000-0000-4000-8000-0000000a00a1', 'adagh', '[{}, {}, {}]');
    raise exception 'FAIL: a signed-in account wrote an approval directly';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.approvals) then raise exception 'FAIL: a refusal wrote an approval'; end if;
end $$;

-- ── Carl, of another workspace, neither approves nor reads ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000a00c1', 'carl@other.test');
do $$
begin
  begin perform public.dossier_approve((select id from ids where name = 'born')); raise exception 'FAIL: a non-member approved';
  exception when insufficient_privilege then null; end;
  if public.dossier_approval('appr/app', 9) is not null then raise exception 'FAIL: a non-member read an approval'; end if;
  if exists (select 1 from public.approvals) then raise exception 'FAIL: a non-member read the approvals table'; end if;
end $$;

-- ── Bob approves: every kind pinned at its latest version ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000a00b1', 'bob@appr.test');
do $$
declare
  born uuid := (select id from ids where name = 'born');
  made jsonb;
  read jsonb;
  spec_v uuid;
begin
  made := public.dossier_approve(born);
  if made ->> 'repo' <> 'appr/app' or (made ->> 'prd')::int <> 9 or made ->> 'id' is null then
    raise exception 'FAIL: an approval answered %', made;
  end if;
  insert into ids values ('first', (made ->> 'id')::uuid);
  select v.id into spec_v from public.dossier_versions v where v.dossier_id = born and v.kind = 'spec' order by v.created_at desc, v.id desc limit 1;
  read := public.dossier_approval('appr/app', 9);
  if read -> 'approval' -> 'approver' <> '{"login": "bob-gh", "member": true}'::jsonb then
    raise exception 'FAIL: the approver read %', read -> 'approval' -> 'approver';
  end if;
  if (select jsonb_agg(f ->> 'kind') from jsonb_array_elements(read -> 'approval' -> 'files') f) <> '["spec", "plan", "before-after", "voice"]'::jsonb then
    raise exception 'FAIL: the pinned kinds read %', read -> 'approval' -> 'files';
  end if;
  if (read -> 'approval' -> 'files' -> 0) <> jsonb_build_object(
       'kind', 'spec', 'path', 'spec.md', 'versionId', spec_v,
       'sha256', encode(sha256(convert_to(E'---\nprd: 9\nphase0: server\n---\n\n# Server born\n', 'UTF8')), 'hex'),
       'content', E'---\nprd: 9\nphase0: server\n---\n\n# Server born\n') then
    raise exception 'FAIL: the spec was not pinned at its latest version: %', read -> 'approval' -> 'files' -> 0;
  end if;
  if (read -> 'approval' ->> 'approvedAt') is null then raise exception 'FAIL: an approval has no time'; end if;

  -- Nobody changes or deletes an approval, through the API.
  begin update public.approvals set approver_login = 'someone' where dossier_id = born; raise exception 'FAIL: an approval was updated';
  exception when insufficient_privilege then null; end;
  begin delete from public.approvals where dossier_id = born; raise exception 'FAIL: an approval was deleted';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Not even the owner of the tables changes one, or a birthplace ──
do $$
begin
  begin update public.approvals set approver_login = 'someone'; raise exception 'FAIL: the table owner updated an approval';
  exception when insufficient_privilege then null; end;
  begin delete from public.approvals; raise exception 'FAIL: the table owner deleted an approval';
  exception when insufficient_privilege then null; end;
  begin update public.dossiers set birthplace = 'repo' where id = (select id from ids where name = 'born');
    raise exception 'FAIL: a birthplace changed';
  exception when invalid_parameter_value then null; end;
end $$;

-- Bob leaves the workspace: his approval reads as no member's.
delete from public.workspace_members where user_id = '00000000-0000-4000-8000-0000000a00b1';

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000a00a1', 'ada@appr.test');
do $$
declare
  born uuid := (select id from ids where name = 'born');
  read jsonb;
begin
  if public.dossier_approval('appr/app', 9) -> 'approval' -> 'approver' <> '{"login": "bob-gh", "member": false}'::jsonb then
    raise exception 'FAIL: an approver who left read %', public.dossier_approval('appr/app', 9) -> 'approval' -> 'approver';
  end if;

  -- A new plan, then Ada approves again: a second row, the first unchanged, Ada's in force.
  perform public.dossier_push('appr/app', 9, 'Server born', null, '[{"kind": "plan", "content": "plan two"}]');
  perform public.dossier_approve(born);
  if (select count(*) from public.approvals where dossier_id = born) <> 2 then
    raise exception 'FAIL: a second approval did not add a row';
  end if;
  if (select approver_login from public.approvals where id = (select id from ids where name = 'first')) <> 'bob-gh' then
    raise exception 'FAIL: the first approval changed';
  end if;
  read := public.dossier_approval('appr/app', 9);
  if read -> 'approval' -> 'approver' <> '{"login": "adagh", "member": true}'::jsonb then
    raise exception 'FAIL: the approval in force is not the latest: %', read -> 'approval' -> 'approver';
  end if;
  if read -> 'approval' -> 'files' -> 1 ->> 'content' <> 'plan two' then
    raise exception 'FAIL: the second approval did not pin the newer plan';
  end if;
end $$;
reset role;

select 'approval checks passed' as result;
rollback;
