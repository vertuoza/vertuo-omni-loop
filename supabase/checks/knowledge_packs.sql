-- A repository's knowledge and flow files at a commit, as a pack (PRD 2011 s10). The supabase workflow
-- runs it on every pull request, after `supabase db start` has applied the migrations and the demo seed:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/knowledge_packs.sql
-- knowledge_pack_put(), the service role's alone, keeps one pack per workspace that holds the repository
-- in a product, its files each with the sha256 of their content, and marks the pack of the latest commit
-- the newest; the same commit again changes nothing, an older commit arriving late is kept but not the
-- newest. A path that could leave the pack's folder, a hash that is not the content's, a sha out of shape
-- are refused and nothing is written. A member reads their workspace's packs; an account of another
-- workspace, of none, or signed out, nothing; nobody signed in writes them. An agent link reads, through
-- knowledge_pack_for_token(), only its own workspace's packs, and is refused a repository its workspace
-- neither lists nor owns (law BR-PRODUCT-63): a link of another workspace gets no pack of this one.
-- One transaction, rolled back at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000020110a1', 'ada@packs.test'),
  ('00000000-0000-4000-8000-0000020110c1', 'carl@packs.test'),
  ('00000000-0000-4000-8000-0000020110e1', 'eve@packs.test');
-- Ada belongs to Vertuoza, Carl to Acme, Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme-packs', 'Acme', 'acme-packs');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values ('vertuoza', '00000000-0000-4000-8000-0000020110a1'::uuid),
               ('acme-packs', '00000000-0000-4000-8000-0000020110c1'::uuid)) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;
insert into public.businesses (workspace_id, name)
select w.id, w.name from public.workspaces w
 where w.slug in ('vertuoza', 'acme-packs') and not exists (select 1 from public.businesses b where b.workspace_id = w.id);
insert into public.products (workspace_id, business_id, name, key)
select b.workspace_id, b.id, case w.slug when 'vertuoza' then 'Pack Mobile' else 'Acme Packs' end, 'packs'
  from public.businesses b join public.workspaces w on w.id = b.workspace_id
 where w.slug in ('vertuoza', 'acme-packs');
-- Pack Mobile holds vertuoza/pack-api; vertuoza/pack-web is tracked but in no product. Acme Packs holds
-- acme-packs/api, and Acme also tracks vertuoza/pack-api, in no product of its own.
insert into public.repositories (workspace_id, full_name)
select w.id, r.name
  from (values ('vertuoza', 'vertuoza/pack-api'), ('vertuoza', 'vertuoza/pack-web'),
               ('acme-packs', 'acme-packs/api'), ('acme-packs', 'vertuoza/pack-api')) as r (slug, name)
  join public.workspaces w on w.slug = r.slug;
insert into public.product_repositories (product_id, workspace_id, repository, added_by)
select p.id, p.workspace_id, r.name, 'person'
  from (values ('vertuoza', 'vertuoza/pack-api'), ('acme-packs', 'acme-packs/api')) as r (slug, name)
  join public.workspaces w on w.slug = r.slug
  join public.products p on p.workspace_id = w.id and p.key = 'packs';
-- Two agent links (business) and a kit token: Ada's for Vertuoza, Carl's for Acme, Ada's kit token.
insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four, scope, expires_at)
select w.id, t.made_by, t.name, encode(sha256(convert_to(t.token, 'UTF8')), 'hex'), right(t.token, 4), t.scope, t.expires_at
  from (values ('vertuoza', '00000000-0000-4000-8000-0000020110a1'::uuid, 'ada link', 'omb_packs_vertuoza_0001', 'business', null::timestamptz),
               ('acme-packs', '00000000-0000-4000-8000-0000020110c1'::uuid, 'carl link', 'omb_packs_acme_0002', 'business', null),
               ('vertuoza', '00000000-0000-4000-8000-0000020110a1'::uuid, 'ada kit', 'omk_packs_vertuoza_0003', 'kit', now() + interval '30 days'))
       as t (slug, made_by, name, token, scope, expires_at)
  join public.workspaces w on w.slug = t.slug;

create function pg_temp.sign_in(uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.hash(token text) returns text language sql immutable as $$
  select encode(sha256(convert_to(token, 'UTF8')), 'hex');
$$;
create function pg_temp.ws(slug text) returns uuid language sql as $$
  select w.id from public.workspaces w where w.slug = ws.slug;
$$;

-- Runs a call that must be refused with `code`, its message holding `words` when given.
create function pg_temp.refused(stmt text, code text, why text, words text default null) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
  if words is not null and position(words in sqlerrm) = 0 then
    raise exception 'FAIL: % said "%", not naming "%"', why, sqlerrm, words;
  end if;
end;
$$;

-- A commit's sha, from one letter.
create function pg_temp.sha(c text) returns text language sql immutable as $$ select repeat(c, 40) $$;
-- The packs and their files, as one value to compare before and after a refusal.
create function pg_temp.packs_of() returns text language sql security definer as $$
  select coalesce((select string_agg(row(p.*)::text, ';' order by p.id) from public.knowledge_packs p), '')
      || '|' || coalesce((select string_agg(row(f.*)::text, ';' order by f.pack_id, f.path) from public.knowledge_pack_files f), '');
$$;
-- Two files: a knowledge page and the flow config.
create function pg_temp.files(page text default E'# Rules\n') returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('path', '.omni-loop/knowledge/product/rules.md', 'content', page),
    jsonb_build_object('path', '.omni-loop/config.yml', 'content', E'flow:\n  do-work.start: []\n'));
$$;

-- ── What the migration added, and who may write it ──
do $$
begin
  if has_table_privilege('authenticated', 'public.knowledge_packs', 'insert, update, delete, truncate')
     or has_table_privilege('authenticated', 'public.knowledge_pack_files', 'insert, update, delete, truncate')
     or has_table_privilege('service_role', 'public.knowledge_packs', 'insert, update, delete, truncate')
     or has_table_privilege('service_role', 'public.knowledge_pack_files', 'insert, update, delete, truncate') then
    raise exception 'FAIL: the packs are written other than through knowledge_pack_put()';
  end if;
  if has_table_privilege('anon', 'public.knowledge_packs', 'select') or has_table_privilege('anon', 'public.knowledge_pack_files', 'select') then
    raise exception 'FAIL: anon may read the packs';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.knowledge_packs'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.knowledge_pack_files'::regclass) then
    raise exception 'FAIL: the packs are not under row-level security';
  end if;
  if has_function_privilege('authenticated', 'public.knowledge_pack_put(text, text, timestamptz, jsonb)', 'execute')
     or has_function_privilege('anon', 'public.knowledge_pack_put(text, text, timestamptz, jsonb)', 'execute')
     or not has_function_privilege('service_role', 'public.knowledge_pack_put(text, text, timestamptz, jsonb)', 'execute') then
    raise exception 'FAIL: knowledge_pack_put() is not the service role''s alone';
  end if;
  if not has_function_privilege('anon', 'public.knowledge_pack_for_token(text, text, text)', 'execute') then
    raise exception 'FAIL: an agent link cannot call knowledge_pack_for_token()';
  end if;
end $$;

-- ── The App keeps vertuoza/pack-api at commit a: one pack, in the workspace that holds it in a product ──
set local role service_role;
do $$
declare
  answer jsonb := public.knowledge_pack_put('Vertuoza/Pack-API', pg_temp.sha('a'), '2026-12-12 09:00+00', pg_temp.files());
  pack   uuid;
begin
  if answer ->> 'repository' <> 'vertuoza/pack-api' or answer ->> 'sha' <> pg_temp.sha('a')
     or jsonb_array_length(answer -> 'packs') <> 1
     or answer -> 'packs' -> 0 ->> 'workspace' <> pg_temp.ws('vertuoza')::text
     or (answer -> 'packs' -> 0 ->> 'created')::boolean is not true or (answer -> 'packs' -> 0 ->> 'newest')::boolean is not true
     or (answer -> 'packs' -> 0 ->> 'files')::integer <> 2 then
    raise exception 'FAIL: a first pack did not answer one new newest pack of two files in Vertuoza: %', answer;
  end if;
  pack := (answer -> 'packs' -> 0 ->> 'packId')::uuid;
  -- Acme tracks vertuoza/pack-api but holds it in none of its products: it gets no pack.
  if exists (select 1 from public.knowledge_packs p where p.workspace_id = pg_temp.ws('acme-packs')) then
    raise exception 'FAIL: a workspace that holds the repository in no product got its pack';
  end if;
  if (select string_agg(f.path || ' ' || f.sha256, ' | ' order by f.path) from public.knowledge_pack_files f where f.pack_id = pack)
     <> '.omni-loop/config.yml ' || pg_temp.hash(E'flow:\n  do-work.start: []\n')
        || ' | .omni-loop/knowledge/product/rules.md ' || pg_temp.hash(E'# Rules\n') then
    raise exception 'FAIL: the pack''s files are not kept with the sha256 of their content';
  end if;
  if not exists (select 1 from public.knowledge_packs p
                  where p.id = pack and p.repository = 'vertuoza/pack-api' and p.sha = pg_temp.sha('a')
                    and p.committed_at = '2026-12-12 09:00+00' and p.newest) then
    raise exception 'FAIL: the pack does not hold its repository, commit and date';
  end if;
  -- The same commit again: nothing new, nothing changed, even with other words.
  answer := public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('a'), '2026-12-12 09:00+00', pg_temp.files(E'# Other\n'));
  if (answer -> 'packs' -> 0 ->> 'created')::boolean or (answer -> 'packs' -> 0 ->> 'packId')::uuid <> pack
     or (select count(*) from public.knowledge_packs) <> 1
     or (select f.sha256 from public.knowledge_pack_files f where f.pack_id = pack and f.path like '%rules.md') <> pg_temp.hash(E'# Rules\n') then
    raise exception 'FAIL: the same commit again made or changed a pack: %', answer;
  end if;
  -- A sender's sha256 is taken when it is the content's.
  answer := public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('b'), '2026-12-12 10:00+00', jsonb_build_array(
    jsonb_build_object('path', '.omni-loop/knowledge/product/rules.md', 'content', E'# Rules, b\n', 'sha256', pg_temp.hash(E'# Rules, b\n'))));
  if (answer -> 'packs' -> 0 ->> 'newest')::boolean is not true
     or (select count(*) from public.knowledge_packs where newest) <> 1
     or (select p.sha from public.knowledge_packs p where p.newest) <> pg_temp.sha('b') then
    raise exception 'FAIL: the later commit b is not the one newest pack: %', answer;
  end if;
  -- Commit c, older than b, arrives late: kept, not the newest.
  answer := public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('c'), '2026-12-12 09:30+00', pg_temp.files());
  if (answer -> 'packs' -> 0 ->> 'created')::boolean is not true or (answer -> 'packs' -> 0 ->> 'newest')::boolean
     or (select p.sha from public.knowledge_packs p where p.newest) <> pg_temp.sha('b') then
    raise exception 'FAIL: an older commit arriving late took the newest pack: %', answer;
  end if;
  -- A pack with no file: the knowledge folder was removed at commit d.
  answer := public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('d'), '2026-12-12 11:00+00', '[]'::jsonb);
  if (answer -> 'packs' -> 0 ->> 'files')::integer <> 0 or (select p.sha from public.knowledge_packs p where p.newest) <> pg_temp.sha('d') then
    raise exception 'FAIL: an empty pack at the latest commit is not the newest: %', answer;
  end if;
  -- A repository no workspace holds in a product: nothing kept, said as no pack.
  answer := public.knowledge_pack_put('vertuoza/pack-web', pg_temp.sha('e'), now(), pg_temp.files());
  if answer -> 'packs' <> '[]'::jsonb or exists (select 1 from public.knowledge_packs where repository = 'vertuoza/pack-web') then
    raise exception 'FAIL: a repository in no product got a pack: %', answer;
  end if;
end $$;

-- ── A malformed pack is refused, and nothing is written ──
do $$
declare
  before text := pg_temp.packs_of();
begin
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), jsonb_build_array(
      jsonb_build_object('path', '.omni-loop/knowledge/../../etc/passwd', 'content', 'x')))$q$, '22023', 'a path climbing out', '..');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), jsonb_build_array(
      jsonb_build_object('path', '/etc/passwd', 'content', 'x')))$q$, '22023', 'an absolute path');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), jsonb_build_array(
      jsonb_build_object('path', '.omni-loop//rules.md', 'content', 'x')))$q$, '22023', 'an empty segment');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), jsonb_build_array(
      jsonb_build_object('path', E'.omni-loop\\rules.md', 'content', 'x')))$q$, '22023', 'a backslash');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), jsonb_build_array(
      jsonb_build_object('path', 'a.md', 'content', 'x'), jsonb_build_object('path', 'a.md', 'content', 'y')))$q$, '22023', 'one path twice', 'a.md');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), jsonb_build_array(
      jsonb_build_object('path', 'a.md', 'content', 'x', 'sha256', pg_temp.hash('y'))))$q$, '22023', 'a hash that is not the content''s', 'a.md');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), jsonb_build_array(
      jsonb_build_object('path', 'a.md')))$q$, '22023', 'a file with no content');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), '{}'::jsonb)$q$, '22023', 'files not a list');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', 'abc', now(), pg_temp.files())$q$, '22023', 'a short sha');
  perform pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), null, pg_temp.files())$q$, '22023', 'no commit date');
  perform pg_temp.refused($q$select public.knowledge_pack_put('not a repo', pg_temp.sha('f'), now(), pg_temp.files())$q$, '22023', 'a repository out of shape');
  if pg_temp.packs_of() <> before then
    raise exception 'FAIL: a refused pack wrote something';
  end if;
end $$;
-- Acme's own repository gets Acme's pack.
select public.knowledge_pack_put('acme-packs/api', pg_temp.sha('9'), now(), pg_temp.files(E'# Acme secret\n'));
reset role;

-- ── Ada, a member, reads Vertuoza's packs and none of Acme's ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020110a1');
do $$
begin
  if (select count(*) from public.knowledge_packs) <> 4
     or exists (select 1 from public.knowledge_packs where workspace_id <> pg_temp.ws('vertuoza'))
     or exists (select 1 from public.knowledge_pack_files where content like '%Acme secret%')
     or (select count(*) from public.knowledge_pack_files) <> 5 then
    raise exception 'FAIL: a member does not read exactly their workspace''s packs and files';
  end if;
end $$;
select pg_temp.refused($q$insert into public.knowledge_packs (workspace_id, repository, sha, committed_at)
  values (pg_temp.ws('vertuoza'), 'vertuoza/pack-api', pg_temp.sha('f'), now())$q$, '42501', 'a member writing a pack');
select pg_temp.refused($q$update public.knowledge_pack_files set content = 'changed'$q$, '42501', 'a member changing a file');
select pg_temp.refused($q$delete from public.knowledge_packs$q$, '42501', 'a member deleting packs');
select pg_temp.refused($q$select public.knowledge_pack_put('vertuoza/pack-api', pg_temp.sha('f'), now(), pg_temp.files())$q$, '42501', 'a member putting a pack');
reset role;

-- ── Carl, of Acme, reads only Acme's; Eve, of no workspace, and anyone signed out, nothing ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020110c1');
do $$
begin
  if (select count(*) from public.knowledge_packs) <> 1 or (select repository from public.knowledge_packs) <> 'acme-packs/api'
     or exists (select 1 from public.knowledge_pack_files where content not like '%Acme secret%' and path like '%rules.md') then
    raise exception 'FAIL: a member of Acme reads a pack of Vertuoza';
  end if;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000020110e1');
do $$
begin
  if exists (select 1 from public.knowledge_packs) or exists (select 1 from public.knowledge_pack_files) then
    raise exception 'FAIL: an account of no workspace reads a pack';
  end if;
end $$;
reset role;
set local role anon;
select pg_temp.refused($q$select 1 from public.knowledge_packs$q$, '42501', 'anon reading the packs');
reset role;

-- ── An agent link reads only its own workspace's packs (law BR-PRODUCT-63) ──
set local role anon;
do $$
declare
  ada  text := pg_temp.hash('omb_packs_vertuoza_0001');
  carl text := pg_temp.hash('omb_packs_acme_0002');
  got  jsonb;
begin
  -- Vertuoza's link reads the newest pack of its repository, its files with their hashes, in path order.
  got := public.knowledge_pack_for_token(ada, 'vertuoza/pack-api');
  if got ->> 'repository' <> 'vertuoza/pack-api' or got ->> 'sha' <> pg_temp.sha('d') or (got ->> 'newest')::boolean is not true
     or got -> 'files' <> '[]'::jsonb then
    raise exception 'FAIL: a link did not read its repository''s newest pack: %', got;
  end if;
  -- Or the pack of one commit.
  got := public.knowledge_pack_for_token(ada, 'Vertuoza/Pack-Api', pg_temp.sha('a'));
  if got ->> 'sha' <> pg_temp.sha('a') or (got ->> 'newest')::boolean
     or got -> 'files' <> jsonb_build_array(
          jsonb_build_object('path', '.omni-loop/config.yml', 'sha256', pg_temp.hash(E'flow:\n  do-work.start: []\n'), 'content', E'flow:\n  do-work.start: []\n'),
          jsonb_build_object('path', '.omni-loop/knowledge/product/rules.md', 'sha256', pg_temp.hash(E'# Rules\n'), 'content', E'# Rules\n')) then
    raise exception 'FAIL: a link did not read the pack of commit a, its files in path order: %', got;
  end if;
  -- A listed repository with no pack, and a commit with none: no pack, not a refusal.
  if public.knowledge_pack_for_token(ada, 'vertuoza/pack-web') is not null
     or public.knowledge_pack_for_token(ada, 'vertuoza/pack-api', pg_temp.sha('7')) is not null then
    raise exception 'FAIL: a link read a pack that does not exist';
  end if;
  -- Acme's link: the repository Acme tracks but holds in no product has no pack of Acme's, and never Vertuoza's.
  if public.knowledge_pack_for_token(carl, 'vertuoza/pack-api') is not null
     or public.knowledge_pack_for_token(carl, 'vertuoza/pack-api', pg_temp.sha('a')) is not null then
    raise exception 'FAIL: a link of another workspace read a pack of Vertuoza';
  end if;
  got := public.knowledge_pack_for_token(carl, 'acme-packs/api');
  if got -> 'files' -> 1 ->> 'content' <> E'# Acme secret\n' then
    raise exception 'FAIL: Acme''s link did not read Acme''s pack: %', got;
  end if;
  -- A repository the workspace neither lists nor owns is refused, named, before any read.
  perform pg_temp.refused(format('select public.knowledge_pack_for_token(%L, ''acme-packs/api'')', ada), '42501',
    'Vertuoza''s link reading Acme''s repository', 'acme-packs/api');
  perform pg_temp.refused(format('select public.knowledge_pack_for_token(%L, ''vertuoza/pack-web'')', carl), '42501',
    'Acme''s link reading a repository Acme does not list', 'vertuoza/pack-web');
  perform pg_temp.refused(format('select public.knowledge_pack_for_token(%L, ''not a repo'')', ada), '22023', 'a repository out of shape');
  perform pg_temp.refused(format('select public.knowledge_pack_for_token(%L, ''vertuoza/pack-api'', ''abc'')', ada), '22023', 'a sha out of shape');
  -- A kit token, an unknown link and no link at all read nothing.
  perform pg_temp.refused(format('select public.knowledge_pack_for_token(%L, ''vertuoza/pack-api'')', pg_temp.hash('omk_packs_vertuoza_0003')), '28000', 'a kit token');
  perform pg_temp.refused(format('select public.knowledge_pack_for_token(%L, ''vertuoza/pack-api'')', pg_temp.hash('omb_nobody')), '28000', 'an unknown link');
  perform pg_temp.refused('select public.knowledge_pack_for_token(null, ''vertuoza/pack-api'')', '28000', 'no link');
end $$;
reset role;

-- ── A link stops when its maker leaves (BR-PRODUCT-64) ──
delete from public.workspace_members where user_id = '00000000-0000-4000-8000-0000020110a1';
set local role anon;
select pg_temp.refused(format('select public.knowledge_pack_for_token(%L, ''vertuoza/pack-api'')', pg_temp.hash('omb_packs_vertuoza_0001')),
  '28000', 'a link whose maker left');
reset role;

rollback;

select 'knowledge packs checks passed' as result;
