-- Who may read and write the dossiers (PRD 216). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/dossiers.sql
-- Accounts each with its own JWT. A dossier belongs to a workspace: every member of it reads the
-- dossier and its versions; an account of another workspace, or of none, reads nothing. Nobody signed
-- in writes the tables: dossier_open() and dossier_push() do, and they refuse an account in no
-- workspace. A version is added only when its content's hash differs from the latest of its kind, and
-- is never updated or deleted. Only the opener deletes a draft; nobody deletes a numbered dossier. The
-- service role (the fallback) adds versions through the same rule, and a draft numbered to its dossier
-- merges into it. Later steps of PRD 216 append their own checks. One transaction, rolled back at the
-- end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme, owns the GitHub organisation acme. Ada joined Vertuoza first, then Acme;
-- Bob belongs to Vertuoza, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id, joined_at)
select w.id, m.user_id, m.joined_at
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid, now() - interval '2 days'),
         ('acme',     '00000000-0000-4000-8000-0000000000a1'::uuid, now() - interval '1 day'),
         ('vertuoza', '00000000-0000-4000-8000-0000000000b1'::uuid, now() - interval '1 day'),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid, now() - interval '1 day')
       ) as m (slug, user_id, joined_at)
  join public.workspaces w on w.slug = m.slug;

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- The ids the blocks below share.
create temporary table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated, service_role;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.dossiers limit 1; raise exception 'FAIL: anon read the dossiers';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.dossier_versions limit 1; raise exception 'FAIL: anon read the dossier versions';
  exception when insufficient_privilege then null; end;
  begin perform public.dossier_open('An idea', 'vertuoza/vertuo-omni-loop', null); raise exception 'FAIL: anon opened a draft';
  exception when insufficient_privilege then null; end;
  begin perform public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'An idea', null, '[]'); raise exception 'FAIL: anon pushed a dossier';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada opens a draft, and a push numbers it and lands versions ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  draft uuid;
  other uuid;
  pushed jsonb;
  n int;
begin
  draft := public.dossier_open('  A team inbox  ', 'Vertuoza/Vertuo-Omni-Loop', 'sess-a');
  if not exists (
    select 1 from public.dossiers d join public.workspaces w on w.id = d.workspace_id
     where d.id = draft and w.slug = 'vertuoza' and d.home_repo = 'vertuoza/vertuo-omni-loop' and d.prd is null
       and d.numbered_at is null and d.title = 'A team inbox' and d.opened_by = '00000000-0000-4000-8000-0000000000a1'
       and d.claude_session_id = 'sess-a') then
    raise exception 'FAIL: a draft did not open in the workspace of the repository, as its opener, with its Claude session';
  end if;
  other := public.dossier_open('acme widgets', 'acme/widgets', null);
  if (select w.slug from public.dossiers d join public.workspaces w on w.id = d.workspace_id where d.id = other) <> 'acme' then
    raise exception 'FAIL: a draft of an acme repository did not go to the workspace of the acme organisation';
  end if;

  -- Nothing is written but through the functions.
  begin
    insert into public.dossiers (workspace_id, home_repo, title) values ((select id from public.workspaces where slug = 'vertuoza'), 'vertuoza/planted', 'planted');
    raise exception 'FAIL: a signed-in account wrote a dossier directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.dossiers set title = 'renamed' where id = draft;
    raise exception 'FAIL: a signed-in account renamed a dossier directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.dossier_versions (dossier_id, kind, content, sha256, bytes, source)
    values (draft, 'spec', 'planted', repeat('0', 64), 7, 'kit');
    raise exception 'FAIL: a signed-in account wrote a version directly';
  exception when insufficient_privilege then null; end;
  begin
    perform public.dossier_add_version(draft, 'spec', 'planted', 'kit');
    raise exception 'FAIL: a signed-in account called the version rule itself';
  exception when insufficient_privilege then null; end;

  -- The push numbers the draft, takes the spec's title, and adds v1 of each kind.
  pushed := public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', draft,
    '[{"kind": "spec", "content": "spec one"}, {"kind": "plan", "content": "plan one"}]');
  if pushed <> jsonb_build_object('id', draft, 'added', '[{"kind": "spec", "version": 1}, {"kind": "plan", "version": 1}]'::jsonb, 'unchanged', '[]'::jsonb) then
    raise exception 'FAIL: the first push answered %', pushed;
  end if;
  if not exists (select 1 from public.dossiers where id = draft and prd = 7 and numbered_at is not null and title = 'Team inbox') then
    raise exception 'FAIL: a push did not number the draft or take the spec''s title';
  end if;
  if not exists (
    select 1 from public.dossier_versions
     where dossier_id = draft and kind = 'spec' and content = 'spec one' and bytes = 8 and source = 'kit'
       and uploaded_by = '00000000-0000-4000-8000-0000000000a1'
       and sha256 = encode(sha256(convert_to('spec one', 'UTF8')), 'hex')) then
    raise exception 'FAIL: a version was not stored whole, with its hash computed from the content, its size, its source and who uploaded it';
  end if;

  -- The same content again adds nothing; a change adds one; going back to an earlier state is still new.
  pushed := public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "spec", "content": "spec one"}]');
  if pushed -> 'added' <> '[]'::jsonb or pushed -> 'unchanged' <> '["spec"]'::jsonb or (pushed ->> 'id')::uuid <> draft then
    raise exception 'FAIL: an unchanged file was not reported unchanged on the dossier keyed by repository and PRD: %', pushed;
  end if;
  if (select count(*) from public.dossier_versions where dossier_id = draft) <> 2 then
    raise exception 'FAIL: dossier_push() added a version for an unchanged file';
  end if;
  pushed := public.dossier_push('VERTUOZA/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "spec", "content": "spec two"}]');
  if pushed -> 'added' <> '[{"kind": "spec", "version": 2}]'::jsonb then raise exception 'FAIL: a changed spec did not add v2: %', pushed; end if;
  pushed := public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "spec", "content": "spec one"}]');
  if pushed -> 'added' <> '[{"kind": "spec", "version": 3}]'::jsonb then raise exception 'FAIL: a spec back to its first state did not add v3: %', pushed; end if;
  insert into ids values ('dossier', draft), ('acme', other);

  -- A version is never updated or deleted.
  begin
    update public.dossier_versions set content = 'rewritten' where dossier_id = draft;
    raise exception 'FAIL: a version was rewritten';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.dossier_versions where dossier_id = draft;
    raise exception 'FAIL: a version was deleted';
  exception when insufficient_privilege then null; end;

  -- Nobody deletes a numbered dossier, its opener included.
  delete from public.dossiers where id = draft;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: the opener deleted a numbered dossier'; end if;

  -- The refusals.
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', '00000000-0000-4000-8000-00000000ffff', '[]');
    raise exception 'FAIL: a push named a draft that does not exist';
  exception when no_data_found then null; end;
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 9, 'Team inbox', other, '[]');
    raise exception 'FAIL: a push numbered a draft of another repository';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 8, 'Team inbox', draft, '[]');
    raise exception 'FAIL: a push renumbered a dossier';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "retro", "content": "x"}]');
    raise exception 'FAIL: a push took an artifact of an unknown kind';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "plan", "content": "a"}, {"kind": "plan", "content": "b"}]');
    raise exception 'FAIL: a push took the same kind twice';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, jsonb_build_array(jsonb_build_object('kind', 'before-after', 'content', repeat('x', 524289))));
    raise exception 'FAIL: a push stored an artifact over 512 KiB';
  exception when program_limit_exceeded then null; end;
  if (select count(*) from public.dossier_versions where dossier_id = draft) <> 4 then
    raise exception 'FAIL: a refused push left a version behind';
  end if;

  insert into ids values ('draft', public.dossier_open('Another idea', 'vertuoza/vertuo-omni-loop', null));
end $$;

-- ── Bob, a member who is not the opener: reads everything, deletes nothing, pushes the next version ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  did constant uuid := (select id from ids where name = 'dossier');
  draft constant uuid := (select id from ids where name = 'draft');
  acme constant uuid := (select id from ids where name = 'acme');
  pushed jsonb;
  n int;
begin
  if not exists (select 1 from public.dossiers where id = did) then raise exception 'FAIL: a member did not read a dossier of their workspace'; end if;
  if (select count(*) from public.dossier_versions where dossier_id = did) <> 4 then
    raise exception 'FAIL: a member did not read the versions of a dossier of their workspace';
  end if;
  if not exists (select 1 from public.dossiers where id = draft) then raise exception 'FAIL: a member did not read a draft of their workspace'; end if;
  if exists (select 1 from public.dossiers where id = acme) then
    raise exception 'FAIL: a member read a dossier of a workspace they do not belong to';
  end if;

  delete from public.dossiers where id = draft;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: a member deleted a draft they did not open'; end if;

  pushed := public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "plan", "content": "plan two"}]');
  if (pushed ->> 'id')::uuid <> did or pushed -> 'added' <> '[{"kind": "plan", "version": 2}]'::jsonb then
    raise exception 'FAIL: a member could not push the next version of their workspace''s dossier: %', pushed;
  end if;
  if (select uploaded_by from public.dossier_versions where dossier_id = did and kind = 'plan' and content = 'plan two') <> '00000000-0000-4000-8000-0000000000b1' then
    raise exception 'FAIL: a version does not name the member who uploaded it';
  end if;
end $$;

-- ── Carl, of another workspace: reads nothing of Vertuoza's, reaches none of its drafts ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
declare
  did constant uuid := (select id from ids where name = 'dossier');
  draft constant uuid := (select id from ids where name = 'draft');
  pushed jsonb;
  n int;
begin
  if exists (select 1 from public.dossiers where id in (did, draft)) then
    raise exception 'FAIL: an account read a dossier of another workspace';
  end if;
  if not exists (select 1 from public.dossiers where id = (select id from ids where name = 'acme')) then
    raise exception 'FAIL: a member of Acme did not read an Acme dossier';
  end if;
  if exists (select 1 from public.dossier_versions where dossier_id = did) then
    raise exception 'FAIL: an account read the versions of another workspace''s dossier';
  end if;
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', draft, '[]');
    raise exception 'FAIL: an account of another workspace numbered its draft';
  exception when no_data_found then null; end;
  delete from public.dossiers where id = draft;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: an account of another workspace deleted a draft'; end if;

  -- The same repository and PRD from Acme is Acme's own dossier, and adds nothing to Vertuoza's.
  pushed := public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "spec", "content": "spec one"}]');
  if (pushed ->> 'id')::uuid = did then raise exception 'FAIL: a push from another workspace reached Vertuoza''s dossier'; end if;
  if pushed -> 'added' <> '[{"kind": "spec", "version": 1}]'::jsonb then raise exception 'FAIL: Acme''s own dossier did not start at v1: %', pushed; end if;
end $$;

-- ── Eve, in no workspace: refused, and reads nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  begin
    perform public.dossier_open('An idea', 'vertuoza/vertuo-omni-loop', null);
    raise exception 'FAIL: an account in no workspace opened a draft';
  exception when insufficient_privilege then null; end;
  begin
    perform public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "spec", "content": "spec three"}]');
    raise exception 'FAIL: dossier_push() did not refuse an account in no workspace';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.dossiers) or exists (select 1 from public.dossier_versions) then
    raise exception 'FAIL: an account in no workspace read a dossier';
  end if;
end $$;

-- ── Only the opener deletes a draft ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  draft constant uuid := (select id from ids where name = 'draft');
  n int;
begin
  delete from public.dossiers where id = draft;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the opener could not delete their own draft'; end if;
end $$;
reset role;

-- ── The fallback, as the service role: the same version rule, and a draft numbered to its dossier merges into it ──
set local role service_role;
do $$
declare
  found_id uuid;
begin
  insert into public.dossiers (workspace_id, home_repo, prd, title, numbered_at)
  values ((select id from public.workspaces where slug = 'vertuoza'), 'vertuoza/vertuo-omni-loop', 8, 'team-roster', now())
  returning id into found_id;
  insert into ids values ('fallback', found_id);
  if public.dossier_add_version(found_id, 'spec', 'spec from github', 'github', null, 'a1b2c3d', 'b10b5ea') is distinct from 1 then
    raise exception 'FAIL: the service role could not add a version through the version rule';
  end if;
  if public.dossier_add_version(found_id, 'spec', 'spec from github', 'github', null, 'e4f5a6b', 'b10b5ea') is not null then
    raise exception 'FAIL: the version rule added a version for an unchanged file';
  end if;
  begin
    update public.dossier_versions set content = 'rewritten' where dossier_id = found_id;
    raise exception 'FAIL: the service role rewrote a version';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.dossiers where id = found_id;
    raise exception 'FAIL: the service role deleted a dossier';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  found_id constant uuid := (select id from ids where name = 'fallback');
  draft uuid;
  pushed jsonb;
begin
  draft := public.dossier_open('A team roster', 'vertuoza/vertuo-omni-loop', 'sess-m');
  pushed := public.dossier_push('vertuoza/vertuo-omni-loop', 8, 'Team roster', draft,
    '[{"kind": "spec", "content": "spec from github"}, {"kind": "plan", "content": "roster plan"}]');
  if pushed <> jsonb_build_object('id', found_id, 'added', '[{"kind": "plan", "version": 1}]'::jsonb, 'unchanged', '["spec"]'::jsonb) then
    raise exception 'FAIL: a draft numbered to the fallback''s dossier did not land on it: %', pushed;
  end if;
  if exists (select 1 from public.dossiers where id = draft) then raise exception 'FAIL: a merged draft was not removed'; end if;
  if not exists (
    select 1 from public.dossiers
     where id = found_id and claude_session_id = 'sess-m' and opened_by = '00000000-0000-4000-8000-0000000000a1' and title = 'Team roster') then
    raise exception 'FAIL: a merged draft''s Claude session id and opener did not move over';
  end if;
end $$;
reset role;

-- ── Grants ──
do $$
begin
  if has_table_privilege('anon', 'public.dossiers', 'select, insert, update, delete, truncate')
     or has_table_privilege('anon', 'public.dossier_versions', 'select, insert, update, delete, truncate')
     or has_any_column_privilege('anon', 'public.dossiers', 'select')
     or has_any_column_privilege('anon', 'public.dossier_versions', 'select') then
    raise exception 'FAIL: anon holds a privilege on the dossier tables';
  end if;
  if has_table_privilege('authenticated', 'public.dossiers', 'insert, update, truncate')
     or has_any_column_privilege('authenticated', 'public.dossiers', 'insert, update')
     or has_table_privilege('authenticated', 'public.dossier_versions', 'insert, update, delete, truncate')
     or has_any_column_privilege('authenticated', 'public.dossier_versions', 'insert, update') then
    raise exception 'FAIL: a signed-in account may write the dossier tables other than by deleting a draft';
  end if;
  if has_table_privilege('service_role', 'public.dossier_versions', 'insert, update, delete, truncate')
     or has_any_column_privilege('service_role', 'public.dossier_versions', 'insert, update')
     or has_table_privilege('service_role', 'public.dossiers', 'delete, truncate') then
    raise exception 'FAIL: the service role may add versions other than through the version rule, or delete a dossier';
  end if;
  if has_function_privilege('anon', 'public.dossier_open(text, text, text)', 'execute')
     or has_function_privilege('anon', 'public.dossier_push(text, integer, text, uuid, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.dossier_add_version(uuid, text, text, text, uuid, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.dossier_add_version(uuid, text, text, text, uuid, text, text)', 'execute') then
    raise exception 'FAIL: an API role may call a dossier function it should not';
  end if;
end $$;

select 'dossier checks passed' as result;
rollback;
