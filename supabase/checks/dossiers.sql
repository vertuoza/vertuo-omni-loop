-- Who may read and write the dossiers (PRD 216). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/dossiers.sql
-- Accounts each with its own JWT. A dossier belongs to a workspace: every member of it reads the
-- dossier and its versions; an account of another workspace, or of none, reads nothing. Nobody signed
-- in writes the tables: dossier_open() and dossier_push() do, and they refuse an account in no
-- workspace. A version is added only when its content's hash differs from the latest of its kind, and
-- is never updated or deleted. Only the opener deletes a draft; nobody deletes a numbered dossier. The
-- service role (the fallback) adds versions through the same rule, and a draft numbered to its dossier
-- merges into it. Later steps of PRD 216 append their own checks: dossier_rounds() gives each member
-- the same brainstorm and delivery rounds of a dossier, once each, and nothing its caller could not
-- read; dossier_list() lists each dossier of the caller's workspaces with its repositories, its latest
-- versions, its question counts and its last activity, and nothing of another workspace. One
-- transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- A second workspace, Acme, owns the GitHub organisation acme, and a third, Globex, owns globex and has
-- no member here. Ada joined Vertuoza first, then Acme; Bob belongs to Vertuoza, Carl to Acme, Eve to
-- none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme'), ('globex', 'Globex', 'globex');
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

  -- A repository Vertuoza owns is Vertuoza's (PRD 459): a push from Acme is refused, naming Vertuoza,
  -- and adds nothing to Vertuoza's dossier.
  begin
    pushed := public.dossier_push('vertuoza/vertuo-omni-loop', 7, 'Team inbox', null, '[{"kind": "spec", "content": "spec one"}]');
    raise exception 'FAIL: a push from another workspace went through for a repository Vertuoza owns: %', pushed;
  exception when insufficient_privilege then
    if sqlerrm <> 'you are not a member of Vertuoza, which owns vertuoza/vertuo-omni-loop' then
      raise exception 'FAIL: the refusal of a push for a repository another workspace owns reads %', sqlerrm;
    end if;
  end;
  begin
    perform public.dossier_open('An idea', 'vertuoza/vertuo-omni-loop', null);
    raise exception 'FAIL: an account of another workspace opened a draft for a repository Vertuoza owns';
  exception when insufficient_privilege then
    if sqlerrm <> 'you are not a member of Vertuoza, which owns vertuoza/vertuo-omni-loop' then
      raise exception 'FAIL: the refusal of a draft for a repository another workspace owns reads %', sqlerrm;
    end if;
  end;

  -- Where the rest goes (PRD 459): a repository Acme owns, and one no workspace owns, go to Acme; one
  -- Globex owns is refused, naming Globex. Undone at the end of the block.
  begin
    if (select w.slug from public.dossiers d join public.workspaces w on w.id = d.workspace_id
         where d.id = public.dossier_open('An api', 'acme/api', null)) <> 'acme' then
      raise exception 'FAIL: a member''s draft of a repository their workspace owns did not go to it';
    end if;
    pushed := public.dossier_push('nobody/tools', 7, 'Tools', null, '[{"kind": "spec", "content": "spec one"}]');
    if (select w.slug from public.dossiers d join public.workspaces w on w.id = d.workspace_id where d.id = (pushed ->> 'id')::uuid) <> 'acme' then
      raise exception 'FAIL: a push for a repository no workspace owns did not go to the workspace its caller joined first';
    end if;
    begin
      perform public.dossier_open('A web', 'globex/web', null);
      raise exception 'FAIL: a draft of a repository another workspace owns was opened';
    exception when insufficient_privilege then
      if sqlerrm <> 'you are not a member of Globex, which owns globex/web' then
        raise exception 'FAIL: the refusal of a draft for a Globex repository reads %', sqlerrm;
      end if;
    end;
    begin
      perform public.dossier_push('globex/web', 7, 'A web', null, '[{"kind": "spec", "content": "spec one"}]');
      raise exception 'FAIL: a push for a repository another workspace owns went through';
    exception when insufficient_privilege then
      if sqlerrm <> 'you are not a member of Globex, which owns globex/web' then
        raise exception 'FAIL: the refusal of a push for a Globex repository reads %', sqlerrm;
      end if;
    end;
    raise exception 'undo' using errcode = 'U0459';
  exception when sqlstate 'U0459' then null;
  end;
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
  begin
    perform public.dossier_open('An idea', 'nobody/tools', null);
    raise exception 'FAIL: an account in no workspace opened a draft for a repository no workspace owns';
  exception when insufficient_privilege then
    if sqlerrm <> 'no workspace owns nobody/tools yet — install the Omni App' then
      raise exception 'FAIL: the refusal of a draft by an account in no workspace reads %', sqlerrm;
    end if;
  end;
  begin
    perform public.dossier_push('nobody/tools', 7, 'Tools', null, '[{"kind": "spec", "content": "spec three"}]');
    raise exception 'FAIL: an account in no workspace pushed for a repository no workspace owns';
  exception when insufficient_privilege then
    if sqlerrm <> 'no workspace owns nobody/tools yet — install the Omni App' then
      raise exception 'FAIL: the refusal of a push by an account in no workspace reads %', sqlerrm;
    end if;
  end;
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

-- ── The questions that shaped a dossier: dossier_rounds() (PRD 216, step 3) ──
-- Written as the database owner, past row-level security, so each row is dated where the rules need it:
-- Vertuoza's PRD 30 of vertuoza/tiles, opened 10 hours ago in the Claude session sess-r, and PRD 31,
-- opened 5 hours ago in the same Claude session, which ends PRD 30's brainstorm. Acme holds a dossier of
-- its own for the same repository, number and Claude session, opened 7 hours ago: it belongs to another
-- workspace, so it ends nothing of Vertuoza's. A draft with neither a Claude session nor a number.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  vertuoza constant uuid := (select id from public.workspaces where slug = 'vertuoza');
  acme constant uuid := (select id from public.workspaces where slug = 'acme');
  ada constant uuid := '00000000-0000-4000-8000-0000000000a1';
  bob constant uuid := '00000000-0000-4000-8000-0000000000b1';
  carl constant uuid := '00000000-0000-4000-8000-0000000000c1';
  asked constant jsonb := '[{"question": "Square or hexagonal tiles?", "header": "Shape", "multiSelect": false,
                             "options": [{"label": "Square (Recommended)", "description": "cheaper"}, {"label": "Hexagonal", "description": "prettier"}]}]';
  s_ada uuid;
  s_bob uuid;
  s_stones uuid;
  s_carl uuid;
begin
  insert into ids
  select 'q-' || x.name, x.id from (values
    ('prd30', gen_random_uuid()), ('prd31', gen_random_uuid()), ('acme30', gen_random_uuid()), ('draft', gen_random_uuid())
  ) as x (name, id);
  insert into public.dossiers (id, workspace_id, home_repo, prd, title, opened_by, claude_session_id, created_at, numbered_at) values
    ((select id from ids where name = 'q-prd30'), vertuoza, 'vertuoza/tiles', 30, 'Tiles', ada, 'sess-r', now() - interval '10 hours', now() - interval '9 hours'),
    ((select id from ids where name = 'q-prd31'), vertuoza, 'vertuoza/tiles', 31, 'Grout', ada, 'sess-r', now() - interval '5 hours', now() - interval '4 hours'),
    ((select id from ids where name = 'q-acme30'), acme, 'vertuoza/tiles', 30, 'Tiles at Acme', carl, 'sess-r', now() - interval '7 hours', now() - interval '7 hours'),
    ((select id from ids where name = 'q-draft'), vertuoza, 'vertuoza/tiles', null, 'Sealant', ada, null, now() - interval '12 hours', null);

  -- The ask sessions: each lands in its workspace by its owner and repository, as PRD 144 places it.
  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (ada, 'tiles · main', 'Vertuoza/Tiles', 'main', 'sess-r') returning id into s_ada;
  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (bob, 'tiles · feat/tiles--s2', 'vertuoza/tiles', 'feat/tiles--s2', 'sess-bob') returning id into s_bob;
  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (bob, 'stones · feat/stones', 'vertuoza/stones', 'feat/stones', 'sess-stones') returning id into s_stones;
  -- Carl's, of Acme, for a repository Vertuoza owns: opened before PRD 459 refused that, when it still
  -- landed in his own workspace. Written as it was then, past the trigger that now refuses it.
  alter table public.ask_sessions disable trigger ask_sessions_place;
  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id, workspace_id)
  values (carl, 'tiles at acme', 'vertuoza/tiles', 'main', 'sess-r', acme) returning id into s_carl;
  alter table public.ask_sessions enable trigger ask_sessions_place;
  if (select w.slug from public.ask_sessions s join public.workspaces w on w.id = s.workspace_id where s.id = s_carl) <> 'acme'
     or (select w.slug from public.ask_sessions s join public.workspaces w on w.id = s.workspace_id where s.id = s_ada) <> 'vertuoza' then
    raise exception 'FAIL: the ask sessions of the rounds checks did not land in the workspaces they need';
  end if;

  -- The rounds, each dated. Their names say which dossier each belongs to, and by which rule.
  with asked_at (name, session_id, ago, prd, skill) as (values
    ('q-before',     s_ada,    interval '11 hours', null::integer, '/omni:brainstorm'),  -- before PRD 30 opened: no dossier's
    ('q-brainstorm', s_ada,    interval '9 hours',  null,          '/omni:brainstorm'),  -- PRD 30, brainstorm
    ('q-both',       s_ada,    interval '8 hours',  30,            '/omni:brainstorm'),  -- PRD 30, both rules: brainstorm
    ('q-moved',      s_ada,    interval '6 hours',  null,          '/omni:brainstorm'),  -- PRD 30, brainstorm: Acme's dossier ends nothing
    ('q-next',       s_ada,    interval '4 hours',  null,          '/omni:brainstorm'),  -- PRD 31, brainstorm
    ('q-delivery',   s_bob,    interval '2 hours',  30,            '/omni:do-work'),     -- PRD 30, delivery
    ('q-delivery31', s_bob,    interval '90 minutes', 31,          '/omni:do-work'),     -- PRD 31, delivery
    ('q-stones',     s_stones, interval '1 hour',   30,            '/omni:do-work'),     -- PRD 30 of another repository: none
    ('q-acme',       s_carl,   interval '3 hours',  30,            '/omni:do-work')      -- Acme's dossier only
  ), made as (
    insert into public.ask_rounds (session_id, questions, created_at, prd, skill)
    select a.session_id, asked, now() - a.ago, a.prd, a.skill from asked_at a
    returning id, session_id, created_at
  )
  insert into ids
  select a.name, m.id from made m join asked_at a on a.session_id = m.session_id and now() - a.ago = m.created_at;

  -- Answered: in the terminal (so by the session's owner), on the page by Bob, or moved to the terminal.
  update public.ask_rounds set status = 'answered', answers = '{"Square or hexagonal tiles?": "Square (Recommended)"}', answered_via = 'terminal'
   where id = (select id from ids where name = 'q-brainstorm');
  update public.ask_rounds set status = 'answered', answers = '{"Square or hexagonal tiles?": "Hexagonal"}', answered_via = 'page',
         category = 'ux-ui', category_by = 'model'
   where id = (select id from ids where name = 'q-delivery');
  update public.ask_rounds set status = 'abandoned' where id = (select id from ids where name = 'q-moved');
  if (select count(*) from ids where name like 'q-%') <> 13 then
    raise exception 'FAIL: the rounds checks did not set up their rows';
  end if;
end $$;

create function pg_temp.rounds_of(dossier text) returns text language sql as $$
  select coalesce(string_agg(coalesce(i.name, 'unknown') || ':' || r.rule, ' ' order by r.ordinality), '')
    from public.dossier_rounds((select id from ids where name = dossier)) with ordinality as r
    left join ids i on i.id = r.round_id and i.name like 'q-%'
$$;
grant execute on function pg_temp.rounds_of(text) to authenticated;

-- ── Bob, a member: each dossier's rounds by the two rules, once each, in the order they were asked ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  got text;
  found_round record;
begin
  got := pg_temp.rounds_of('q-prd30');
  if got <> 'q-brainstorm:brainstorm q-both:brainstorm q-moved:brainstorm q-delivery:delivery' then
    raise exception 'FAIL: PRD 30 did not read its brainstorm and delivery rounds, once each, in order: %', got;
  end if;
  got := pg_temp.rounds_of('q-prd31');
  if got <> 'q-next:brainstorm q-delivery31:delivery' then
    raise exception 'FAIL: PRD 31 did not read the rounds after its opening and its own delivery rounds: %', got;
  end if;
  got := pg_temp.rounds_of('q-draft');
  if got <> '' then raise exception 'FAIL: a draft with no Claude session and no number read rounds: %', got; end if;
  got := pg_temp.rounds_of('q-acme30');
  if got <> '' then raise exception 'FAIL: a member read the rounds of another workspace''s dossier: %', got; end if;

  -- Each round as PRD 144 keeps it, with who asked it, where, and who answered.
  select * into found_round from public.dossier_rounds((select id from ids where name = 'q-prd30')) r
   where r.round_id = (select id from ids where name = 'q-delivery');
  if found_round.asked_by is distinct from '00000000-0000-4000-8000-0000000000b1'::uuid
     or found_round.repo is distinct from 'vertuoza/tiles' or found_round.branch is distinct from 'feat/tiles--s2'
     or found_round.status is distinct from 'answered' or found_round.answered_via is distinct from 'page'
     or found_round.answered_by is distinct from '00000000-0000-4000-8000-0000000000b1'::uuid
     or found_round.answers is distinct from '{"Square or hexagonal tiles?": "Hexagonal"}'::jsonb
     or found_round.category is distinct from 'ux-ui' or found_round.category_by is distinct from 'model'
     or found_round.prd is distinct from 30 or found_round.skill is distinct from '/omni:do-work' or found_round.answered_at is null
     or found_round.questions -> 0 ->> 'question' is distinct from 'Square or hexagonal tiles?' then
    raise exception 'FAIL: a delivery round did not come back as PRD 144 keeps it: %', row_to_json(found_round);
  end if;
  select * into found_round from public.dossier_rounds((select id from ids where name = 'q-prd30')) r
   where r.round_id = (select id from ids where name = 'q-brainstorm');
  if found_round.asked_by is distinct from '00000000-0000-4000-8000-0000000000a1'::uuid
     or found_round.answered_by is distinct from '00000000-0000-4000-8000-0000000000a1'::uuid
     or found_round.answered_via is distinct from 'terminal' or found_round.repo is distinct from 'Vertuoza/Tiles'
     or found_round.category is not null then
    raise exception 'FAIL: a brainstorm round did not name who asked it and who answered it: %', row_to_json(found_round);
  end if;

  -- Nothing the caller could not read on their own.
  if exists (
    select 1 from public.dossier_rounds((select id from ids where name = 'q-prd30')) r
     where not exists (select 1 from public.ask_rounds a where a.id = r.round_id)) then
    raise exception 'FAIL: dossier_rounds() returned a round its caller cannot read';
  end if;
end $$;

-- ── Ada, a member of both workspaces: each dossier reads its own workspace's rounds only ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  got text;
begin
  got := pg_temp.rounds_of('q-prd30');
  if got <> 'q-brainstorm:brainstorm q-both:brainstorm q-moved:brainstorm q-delivery:delivery' then
    raise exception 'FAIL: a member of two workspaces read another workspace''s rounds on PRD 30: %', got;
  end if;
  got := pg_temp.rounds_of('q-acme30');
  if got <> 'q-acme:brainstorm' then
    raise exception 'FAIL: Acme''s dossier did not read Acme''s rounds alone: %', got;
  end if;
end $$;

-- ── Carl, of another workspace: nothing of Vertuoza's ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if pg_temp.rounds_of('q-prd30') <> '' or pg_temp.rounds_of('q-prd31') <> '' then
    raise exception 'FAIL: an account of another workspace read the rounds of a Vertuoza dossier';
  end if;
  if pg_temp.rounds_of('q-acme30') <> 'q-acme:brainstorm' then
    raise exception 'FAIL: a member of Acme did not read the rounds of an Acme dossier';
  end if;
end $$;

-- ── Eve, in no workspace: nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.dossier_rounds((select id from ids where name = 'q-prd30')))
     or exists (select 1 from public.dossier_rounds((select id from ids where name = 'q-acme30'))) then
    raise exception 'FAIL: an account in no workspace read a dossier''s rounds';
  end if;
end $$;
reset role;

-- ── Signed out: refused ──
set local role anon;
do $$
begin
  begin
    perform public.dossier_rounds('00000000-0000-4000-8000-000000000000');
    raise exception 'FAIL: anon called dossier_rounds()';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── dossier_rounds() runs as its caller, and only the signed-in may call it ──
do $$
begin
  if (select p.prosecdef from pg_proc p where p.oid = 'public.dossier_rounds(uuid)'::regprocedure) then
    raise exception 'FAIL: dossier_rounds() is security definer: PRD 144''s access rules would not decide what it reads';
  end if;
  if has_function_privilege('anon', 'public.dossier_rounds(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.dossier_rounds(uuid)', 'execute') then
    raise exception 'FAIL: dossier_rounds() is callable by anon, or not by the signed-in';
  end if;
end $$;

-- ── The history: dossier_list() (PRD 216, step 4) ──
-- Written as the database owner, past row-level security. Vertuoza's plan repository is
-- vertuoza/vertuo-omni-loop (the sectors migration); Acme's becomes acme/plans here. PRD 40 of Vertuoza's
-- plan repository, opened 3 days ago in the Claude session sess-l: its spec at v2 (the second read from
-- GitHub) and its before/after page at v1, no plan; a brainstorm question asked in
-- Vertuoza/Vertuo-AI-Domain and answered, a delivery question asked in its home repository named in
-- another case; its planet surveyed in vertuo-core (twice, once in another case) and vertuo-web, a zone
-- opened in vertuo-mobile, and PRD 41's planet surveyed in vertuo-mobile. PRD 40 of vertuoza/tiles,
-- which the fallback created: not the plan repository, so the planet's regions are not its own, and
-- nothing else happened to it since it was numbered 4 days ago. A draft opened 6 days ago, untouched.
-- Acme's PRD 40 of acme/plans, its planet surveyed in acme-core.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  vertuoza constant uuid := (select id from public.workspaces where slug = 'vertuoza');
  acme constant uuid := (select id from public.workspaces where slug = 'acme');
  ada constant uuid := '00000000-0000-4000-8000-0000000000a1';
  bob constant uuid := '00000000-0000-4000-8000-0000000000b1';
  carl constant uuid := '00000000-0000-4000-8000-0000000000c1';
  asked constant jsonb := '[{"question": "Monthly or weekly reminders?", "header": "Cadence", "multiSelect": false,
                             "options": [{"label": "Monthly", "description": "calmer"}, {"label": "Weekly", "description": "sooner"}]}]';
  plan40 constant uuid := gen_random_uuid();
  tiles40 constant uuid := gen_random_uuid();
  draft constant uuid := gen_random_uuid();
  acme40 constant uuid := gen_random_uuid();
  s_brainstorm uuid;
  s_delivery uuid;
  r_brainstorm uuid;
begin
  if (select w.plan_repo from public.workspaces w where w.id = vertuoza) is distinct from 'vertuo-omni-loop' then
    raise exception 'FAIL: the history checks expect vertuoza/vertuo-omni-loop as Vertuoza''s plan repository';
  end if;
  update public.workspaces set plan_repo = 'plans' where id = acme;
  insert into ids values ('l-plan40', plan40), ('l-tiles40', tiles40), ('l-draft', draft), ('l-acme40', acme40);
  insert into public.dossiers (id, workspace_id, home_repo, prd, title, opened_by, claude_session_id, created_at, numbered_at) values
    (plan40,  vertuoza, 'vertuoza/vertuo-omni-loop', 40,   'Invoice reminders', ada,  'sess-l', now() - interval '3 days', now() - interval '71 hours'),
    (tiles40, vertuoza, 'vertuoza/tiles',            40,   'Tile sizes',        null, null,     now() - interval '5 days', now() - interval '4 days'),
    (draft,   vertuoza, 'vertuoza/tiles',            null, 'Grout colours',     bob,  null,     now() - interval '6 days', null),
    (acme40,  acme,     'acme/plans',                40,   'Acme reminders',    carl, null,     now() - interval '2 days', now() - interval '2 days');
  perform public.dossier_add_version(plan40, 'spec', 'reminders spec one', 'kit', ada);
  perform public.dossier_add_version(plan40, 'before-after', 'reminders page', 'kit', ada);
  perform public.dossier_add_version(plan40, 'spec', 'reminders spec two', 'github', null, 'a1b2c3d', 'b10b5ea');

  insert into public.ledger_events (workspace_id, id, at, type, planet, region) values
    (vertuoza, 'check:region:vertuo-core:40:surveyed',   now() - interval '60 hours', 'REGION_SURVEYED', 40, 'vertuo-core'),
    (vertuoza, 'check:region:vertuo-core:40:again',      now() - interval '50 hours', 'REGION_SURVEYED', 40, 'Vertuo-Core'),
    (vertuoza, 'check:region:vertuo-web:40:surveyed',    now() - interval '40 hours', 'REGION_SURVEYED', 40, 'vertuo-web'),
    (vertuoza, 'check:planet:40:charted',                now() - interval '70 hours', 'PLANET_CHARTED',  40, null),
    (vertuoza, 'check:zone:vertuo-mobile:40:opened',     now() - interval '30 hours', 'ZONE_OPENED',     40, 'vertuo-mobile'),
    (vertuoza, 'check:region:vertuo-mobile:41:surveyed', now() - interval '30 hours', 'REGION_SURVEYED', 41, 'vertuo-mobile'),
    (acme,     'check:region:acme-core:40:surveyed',     now() - interval '30 hours', 'REGION_SURVEYED', 40, 'acme-core');

  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (ada, 'vertuo-ai-domain · main', 'Vertuoza/Vertuo-AI-Domain', 'main', 'sess-l') returning id into s_brainstorm;
  insert into public.ask_sessions (owner, title, repo, branch, claude_session_id)
  values (bob, 'vertuo-omni-loop · feat/invoice-reminders--s1', 'Vertuoza/Vertuo-Omni-Loop', 'feat/invoice-reminders--s1', 'sess-lb')
  returning id into s_delivery;
  insert into public.ask_rounds (session_id, questions, created_at, prd, skill)
  values (s_brainstorm, asked, now() - interval '2 days', null, '/omni:brainstorm') returning id into r_brainstorm;
  insert into public.ask_rounds (session_id, questions, created_at, prd, skill)
  values (s_delivery, asked, now() - interval '1 hour', 40, '/omni:do-work');
  update public.ask_rounds set status = 'answered', answers = '{"Monthly or weekly reminders?": "Monthly"}', answered_via = 'terminal'
   where id = r_brainstorm;
end $$;

-- The order dossier_list() gives the dossiers these checks named, as their names.
create function pg_temp.list_order() returns text language sql as $$
  select coalesce(string_agg(i.name, ' ' order by l.ordinality), '')
    from public.dossier_list() with ordinality as l
    join ids i on i.id = l.id and i.name in ('l-plan40', 'l-tiles40', 'l-draft', 'q-prd30', 'q-prd31', 'q-draft')
$$;
grant execute on function pg_temp.list_order() to authenticated;

-- ── Bob, a member: every dossier of his workspace, and nothing else, each as the history lists it ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  vertuoza constant uuid := (select id from public.workspaces where slug = 'vertuoza');
  plan40 constant uuid := (select id from ids where name = 'l-plan40');
  tiles40 constant uuid := (select id from ids where name = 'l-tiles40');
  draft constant uuid := (select id from ids where name = 'l-draft');
  listed record;
  got text;
begin
  if (select count(*) from public.dossier_list()) <> (select count(*) from public.dossiers) then
    raise exception 'FAIL: dossier_list() did not list every dossier a member reads, once each';
  end if;
  if exists (select 1 from public.dossier_list() l where l.workspace_id <> vertuoza) then
    raise exception 'FAIL: dossier_list() listed a dossier of a workspace its caller does not belong to';
  end if;

  -- PRD 40 of the plan repository: its home, its questions' repository and its planet's regions, once
  -- each and in lower case; its latest version of each kind it has; its rounds; its latest version's time.
  select * into listed from public.dossier_list() l where l.id = plan40;
  if listed.repos is distinct from array['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-core', 'vertuoza/vertuo-web'] then
    raise exception 'FAIL: a PRD of the plan repository did not list its home, its questions'' and its planet''s repositories: %', listed.repos;
  end if;
  if listed.latest -> 'spec' ->> 'version' is distinct from '2' or listed.latest -> 'spec' ->> 'source' is distinct from 'github'
     or (listed.latest -> 'spec' ->> 'id')::uuid is distinct from (select v.id from public.dossier_versions v where v.dossier_id = plan40 and v.content = 'reminders spec two')
     or listed.latest -> 'before-after' ->> 'version' is distinct from '1' or listed.latest -> 'before-after' ->> 'source' is distinct from 'kit'
     or listed.latest -> 'plan' is not null then
    raise exception 'FAIL: dossier_list() did not give the latest version of each kind a dossier has, and none of a kind it lacks: %', listed.latest;
  end if;
  if listed.asked is distinct from 2 or listed.answered is distinct from 1 then
    raise exception 'FAIL: dossier_list() did not count a dossier''s rounds asked and answered: % asked, % answered', listed.asked, listed.answered;
  end if;
  if listed.last_activity is distinct from (select max(v.created_at) from public.dossier_versions v where v.dossier_id = plan40)
     or listed.prd is distinct from 40 or listed.title is distinct from 'Invoice reminders' or listed.home_repo is distinct from 'vertuoza/vertuo-omni-loop' then
    raise exception 'FAIL: a dossier''s last activity is not its latest version, or its row is not its own: %', row_to_json(listed);
  end if;

  -- PRD 40 of another repository: the planet's regions are the plan repository's PRD's, not its own.
  select * into listed from public.dossier_list() l where l.id = tiles40;
  if listed.repos is distinct from array['vertuoza/tiles'] or listed.latest is distinct from '{}'::jsonb
     or listed.asked is distinct from 0 or listed.answered is distinct from 0 or listed.last_activity is distinct from now() - interval '4 days' then
    raise exception 'FAIL: a dossier of another repository, with nothing but its numbering, did not list as such: %', row_to_json(listed);
  end if;
  select * into listed from public.dossier_list() l where l.id = draft;
  if listed.prd is not null or listed.last_activity is distinct from now() - interval '6 days' then
    raise exception 'FAIL: an untouched draft did not list with its opening as its last activity: %', row_to_json(listed);
  end if;

  -- PRD 30 of vertuoza/tiles (the rounds checks): its rounds asked in Vertuoza/Tiles and vertuoza/tiles
  -- are its home, once; an answer given in this transaction is its last activity.
  select * into listed from public.dossier_list() l where l.id = (select id from ids where name = 'q-prd30');
  if listed.repos is distinct from array['vertuoza/tiles'] or listed.asked is distinct from 4 or listed.answered is distinct from 2
     or listed.last_activity is distinct from now() then
    raise exception 'FAIL: PRD 30 did not list its home once, its four rounds, two answered, and its latest answer as its last activity: %', row_to_json(listed);
  end if;

  -- Every row counts what dossier_rounds() returns, and numbers what its versions hold.
  if exists (
    select 1 from public.dossier_list() l
     where l.asked <> (select count(*) from public.dossier_rounds(l.id))
        or l.answered <> (select count(*) from public.dossier_rounds(l.id) r where r.status = 'answered')) then
    raise exception 'FAIL: dossier_list() counted rounds other than those dossier_rounds() returns';
  end if;
  if exists (
    select 1 from public.dossier_list() l cross join unnest(array['spec', 'plan', 'before-after']) as k (kind)
     where coalesce((l.latest -> k.kind ->> 'version')::integer, 0)
           <> (select count(*) from public.dossier_versions v where v.dossier_id = l.id and v.kind = k.kind)) then
    raise exception 'FAIL: dossier_list() numbered a latest version other than by its place among its kind''s';
  end if;

  -- Newest activity first.
  got := pg_temp.list_order();
  if got <> 'l-plan40 q-prd30 q-prd31 q-draft l-tiles40 l-draft' then
    raise exception 'FAIL: dossier_list() did not list the newest activity first: %', got;
  end if;

  -- One dossier, when named.
  if (select array_agg(l.id) from public.dossier_list(plan40) l) is distinct from array[plan40] then
    raise exception 'FAIL: dossier_list(p_dossier) did not list that dossier alone';
  end if;
end $$;

-- ── Ada, a member of both workspaces: each dossier with its own workspace's repositories ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
begin
  if (select l.repos from public.dossier_list() l where l.id = (select id from ids where name = 'l-acme40'))
     is distinct from array['acme/plans', 'acme/acme-core'] then
    raise exception 'FAIL: a PRD of Acme''s plan repository did not list its planet''s regions as Acme''s repositories';
  end if;
  if (select l.repos from public.dossier_list() l where l.id = (select id from ids where name = 'l-plan40'))
     is distinct from array['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-ai-domain', 'vertuoza/vertuo-core', 'vertuoza/vertuo-web'] then
    raise exception 'FAIL: a member of two workspaces read another workspace''s regions on a Vertuoza PRD';
  end if;
  if (select count(*) from public.dossier_list()) <> (select count(*) from public.dossiers) then
    raise exception 'FAIL: dossier_list() did not list every dossier of both workspaces to a member of both';
  end if;
end $$;

-- ── Carl, of another workspace: lists nothing of Vertuoza's ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
declare
  vertuoza constant uuid := (select id from public.workspaces where slug = 'vertuoza');
begin
  if exists (select 1 from public.dossier_list() l where l.workspace_id = vertuoza)
     or exists (select 1 from public.dossier_list((select id from ids where name = 'l-plan40'))) then
    raise exception 'FAIL: an account of another workspace listed a Vertuoza dossier';
  end if;
  if (select l.repos from public.dossier_list() l where l.id = (select id from ids where name = 'l-acme40'))
     is distinct from array['acme/plans', 'acme/acme-core'] then
    raise exception 'FAIL: a member of Acme did not list an Acme dossier with its repositories';
  end if;
end $$;

-- ── Eve, in no workspace: lists nothing ──
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.dossier_list()) then
    raise exception 'FAIL: an account in no workspace listed a dossier';
  end if;
end $$;
reset role;

-- ── Signed out: refused ──
set local role anon;
do $$
begin
  begin
    perform public.dossier_list();
    raise exception 'FAIL: anon called dossier_list()';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── dossier_list() runs as its caller, and only the signed-in may call it ──
do $$
begin
  if (select p.prosecdef from pg_proc p where p.oid = 'public.dossier_list(uuid)'::regprocedure) then
    raise exception 'FAIL: dossier_list() is security definer: row-level security would not decide what it lists';
  end if;
  if has_function_privilege('anon', 'public.dossier_list(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.dossier_list(uuid)', 'execute') then
    raise exception 'FAIL: dossier_list() is callable by anon, or not by the signed-in';
  end if;
end $$;

select 'dossier checks passed' as result;
rollback;
