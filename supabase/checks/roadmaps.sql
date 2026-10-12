-- Who may read and write the roadmaps (PRD 1162). The supabase workflow runs it on every pull request,
-- after `supabase db start` has applied the migrations:
--   psql <db> -v ON_ERROR_STOP=1 -f supabase/checks/roadmaps.sql
-- Accounts each with its own JWT. roadmap_push() files a roadmap in the workspace its repository belongs
-- to for the caller, with its PRD rows in the table's order and its product matched by name among the
-- workspace's own; a second push, by any member, replaces its document, questions and PRD rows; a
-- product named but unknown, or another workspace's, is stored as none and said in the answer. Nobody
-- signed in writes the two tables directly, and a roadmap never points at another workspace's product.
-- A member of the workspace reads the roadmap and its PRDs; an account of another workspace, of none,
-- or signed out, nothing. A loop's tick keeps the repositories it touched. A roadmap's prerequisites
-- (PRD 1218) are stored in order with their cards and the state their last result gives, replaced by
-- each roadmap_prerequisites_push(), and read by the workspace's members alone. One transaction, rolled back
-- at the end. Any `FAIL:` stops the run.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com'),
  ('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test'),
  ('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
-- Ada and Bob belong to Vertuoza; Carl to Acme, which owns the GitHub organisation acme; Eve to none.
insert into public.workspaces (slug, name, github_org) values ('acme', 'Acme', 'acme');
insert into public.workspace_members (workspace_id, user_id)
select w.id, m.user_id
  from (values
         ('vertuoza', '00000000-0000-4000-8000-0000000000a1'::uuid),
         ('vertuoza', '00000000-0000-4000-8000-0000000000b1'::uuid),
         ('acme',     '00000000-0000-4000-8000-0000000000c1'::uuid)
       ) as m (slug, user_id)
  join public.workspaces w on w.slug = m.slug;
-- Each workspace sells one product: Vertuoza Crew for Vertuoza, Anvils for Acme.
insert into public.businesses (workspace_id, name)
select id, name from public.workspaces where slug in ('vertuoza', 'acme');
insert into public.products (workspace_id, business_id, name)
select b.workspace_id, b.id, case w.slug when 'vertuoza' then 'Vertuoza Crew' else 'Anvils' end
  from public.businesses b join public.workspaces w on w.id = b.workspace_id
 where w.slug in ('vertuoza', 'acme');

-- Act as a signed-in account for the rest of the transaction: the claims of its access token.
create function pg_temp.sign_in(uid text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'email', email, 'role', 'authenticated')::text, true);
$$;

-- A push of roadmap 1200 of vertuoza/vertuo-omni-loop, its fields overridden by `extra`.
create function pg_temp.push_body(extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'repo', 'Vertuoza/Vertuo-Omni-Loop', 'number', 1200, 'title', 'Vertuoza Crew — from skeleton to earned autonomy',
    'milestone', 'A company grants its first mandate after a trial week.', 'product', 'vertuoza crew', 'target', '2027-03-31',
    'source', 'https://claude.ai/artifact/crew',
    'questions', jsonb_build_array(jsonb_build_object('id', 'Q5', 'question', 'Who signs a mandate?', 'recommendation', null,
                                                      'blocks', jsonb_build_array('P3.4'), 'kind', 'person', 'answer', null)),
    'document', E'---\nroadmap: 1200\n---\n',
    'prds', jsonb_build_array(
      jsonb_build_object('id', 'P1.1', 'prd', 1201, 'title', 'Crew API and worker skeleton', 'repos', jsonb_build_array('Crew'),
                         'blockers', jsonb_build_array(), 'wave', 1, 'state', 'merged',
                         'startedAt', '2026-10-01T09:00:00Z', 'endedAt', '2026-10-03T17:00:00Z'),
      jsonb_build_object('id', 'P3.4', 'prd', 1213, 'title', 'Stateless think endpoint', 'repos', jsonb_build_array('ai-domain'),
                         'blockers', jsonb_build_array('P1.1'), 'wave', 2, 'state', 'waiting',
                         'waitsOn', 'waits on crew#88 (P1.1 Crew API and worker skeleton): CI red',
                         'waitsOnUrl', 'https://github.com/vertuoza/crew/pull/88'))
  ) || extra;
$$;

create table pg_temp.ids (name text primary key, id uuid);
grant all on pg_temp.ids to authenticated;

-- ── Signed out: nothing ──
set local role anon;
do $$
begin
  begin perform 1 from public.roadmaps limit 1; raise exception 'FAIL: anon read the roadmaps';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.roadmap_prds limit 1; raise exception 'FAIL: anon read the roadmap PRDs';
  exception when insufficient_privilege then null; end;
  begin perform public.roadmap_push(pg_temp.push_body()); raise exception 'FAIL: anon pushed a roadmap';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── Ada pushes the roadmap, then pushes it again ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  ws      uuid := (select id from public.workspaces where slug = 'vertuoza');
  crew    uuid := (select p.id from public.products p join public.workspaces w on w.id = p.workspace_id where w.slug = 'vertuoza');
  answer  jsonb;
  roadmap uuid;
begin
  answer := public.roadmap_push(pg_temp.push_body());
  roadmap := (answer ->> 'roadmapId')::uuid;
  insert into pg_temp.ids values ('crew', roadmap);
  if (answer ->> 'created')::boolean is not true or answer ->> 'product' <> 'Vertuoza Crew' or answer -> 'unknownProduct' <> 'null'::jsonb then
    raise exception 'FAIL: a first push did not answer a new roadmap filed under its product: %', answer;
  end if;
  if not exists (
    select 1 from public.roadmaps
     where id = roadmap and workspace_id = ws and repo = 'vertuoza/vertuo-omni-loop' and number = 1200 and product_id = crew
       and target_date = '2027-03-31' and source = 'https://claude.ai/artifact/crew' and questions -> 0 ->> 'kind' = 'person'
       and pushed_by = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: the roadmap was not stored in the repository''s workspace, under its product';
  end if;
  if (select array_agg(row_id order by position) from public.roadmap_prds where roadmap_id = roadmap) <> '{P1.1,P3.4}'
     or not exists (select 1 from public.roadmap_prds where roadmap_id = roadmap and row_id = 'P1.1' and repos = '{crew}' and state = 'merged' and ended_at is not null)
     or not exists (select 1 from public.roadmap_prds where roadmap_id = roadmap and row_id = 'P3.4' and blockers = '{P1.1}' and wave = 2
                      and waits_on like 'waits on crew#88%' and waits_on_url = 'https://github.com/vertuoza/crew/pull/88') then
    raise exception 'FAIL: the roadmap''s PRDs were not stored in the table''s order';
  end if;

  -- A second push replaces the document and the PRD rows, and keeps the roadmap.
  answer := public.roadmap_push(pg_temp.push_body(jsonb_build_object(
    'document', E'---\nroadmap: 1200\ntitle: v2\n---\n', 'product', 'Widgets',
    'prds', jsonb_build_array(jsonb_build_object('id', 'P1.1', 'prd', 1201, 'title', 'Crew API', 'wave', 1, 'state', 'building',
                                                 'startedAt', '2026-10-01T09:00:00Z')))));
  if (answer ->> 'roadmapId')::uuid <> roadmap or (answer ->> 'created')::boolean then
    raise exception 'FAIL: a second push did not answer the same roadmap: %', answer;
  end if;
  if answer -> 'product' <> 'null'::jsonb or answer ->> 'unknownProduct' <> 'Widgets' then
    raise exception 'FAIL: an unknown product was not said in the answer: %', answer;
  end if;
  if (select count(*) from public.roadmaps where number = 1200) <> 1
     or not exists (select 1 from public.roadmaps where id = roadmap and document like '%title: v2%' and product_id is null)
     or (select count(*) from public.roadmap_prds where roadmap_id = roadmap) <> 1
     or not exists (select 1 from public.roadmap_prds where roadmap_id = roadmap and state = 'building' and repos = '{}' and blockers = '{}') then
    raise exception 'FAIL: a second push did not replace the document and the PRD rows';
  end if;

  -- Another workspace's product, by its name, matches none: filed under none.
  answer := public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1300, 'product', 'Anvils')));
  if answer -> 'product' <> 'null'::jsonb or answer ->> 'unknownProduct' <> 'Anvils'
     or exists (select 1 from public.roadmaps where number = 1300 and product_id is not null) then
    raise exception 'FAIL: another workspace''s product was matched: %', answer;
  end if;

  -- Malformed pushes are refused.
  begin perform public.roadmap_push(pg_temp.push_body('{"repo": "widgets"}')); raise exception 'FAIL: a repository not owner/name was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.roadmap_push(pg_temp.push_body() - 'prds'); raise exception 'FAIL: a roadmap without its PRDs was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.roadmap_push(pg_temp.push_body() - 'number'); raise exception 'FAIL: a roadmap without its number was taken';
  exception when invalid_parameter_value then null; end;
  begin perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('target', 'soon'))); raise exception 'FAIL: a target that is not a date was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('prds', jsonb_build_array(
      jsonb_build_object('id', 'P1.1', 'prd', 1201, 'title', 'x', 'wave', 1, 'state', 'shipped')))));
    raise exception 'FAIL: an unknown state was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('prds', jsonb_build_array(
      jsonb_build_object('id', 'P1.1', 'prd', 1201, 'title', 'x', 'wave', 1, 'state', 'waiting'),
      jsonb_build_object('id', 'P1.1', 'prd', 1202, 'title', 'y', 'wave', 1, 'state', 'waiting')))));
    raise exception 'FAIL: an id used twice was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('prds', jsonb_build_array(
      jsonb_build_object('id', 'P1.1', 'prd', 1201, 'title', 'x', 'wave', 1, 'state', 'waiting', 'repos', jsonb_build_array('crew api'))))));
    raise exception 'FAIL: a repository that is not a name was taken';
  exception when invalid_parameter_value then null; end;
  -- A refused push changed nothing.
  if (select count(*) from public.roadmap_prds where roadmap_id = roadmap) <> 1 then
    raise exception 'FAIL: a refused push changed the roadmap''s PRDs';
  end if;

  -- Nothing is written but through the function.
  begin
    insert into public.roadmaps (workspace_id, repo, number, title, milestone, document) values (ws, 'vertuoza/planted', 1, 't', 'm', 'd');
    raise exception 'FAIL: a signed-in account wrote a roadmap directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.roadmaps set title = 'planted' where id = roadmap;
    raise exception 'FAIL: a signed-in account changed a roadmap directly';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.roadmap_prds (roadmap_id, position, row_id, prd, title, wave, state) values (roadmap, 9, 'P9', 9, 'planted', 1, 'merged');
    raise exception 'FAIL: a signed-in account wrote a roadmap PRD directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.roadmap_prds where roadmap_id = roadmap;
    raise exception 'FAIL: a signed-in account deleted a roadmap PRD directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A roadmap never points at another workspace's product, whoever writes it ──
do $$
begin
  update public.roadmaps
     set product_id = (select p.id from public.products p join public.workspaces w on w.id = p.workspace_id where w.slug = 'acme')
   where id = (select id from pg_temp.ids where name = 'crew');
  raise exception 'FAIL: a roadmap was filed under another workspace''s product';
exception when foreign_key_violation then null;
end $$;

-- ── Bob, of the same workspace: reads Ada's roadmap, and pushes it too ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  roadmap uuid := (select id from pg_temp.ids where name = 'crew');
  answer  jsonb;
begin
  if not exists (select 1 from public.roadmaps where id = roadmap)
     or (select count(*) from public.roadmap_prds where roadmap_id = roadmap) <> 1 then
    raise exception 'FAIL: a member of the workspace did not read the roadmap and its PRDs';
  end if;
  answer := public.roadmap_push(pg_temp.push_body());
  if (answer ->> 'roadmapId')::uuid <> roadmap
     or not exists (select 1 from public.roadmaps where id = roadmap and pushed_by = '00000000-0000-4000-8000-0000000000b1') then
    raise exception 'FAIL: another member of the workspace could not push the roadmap';
  end if;
end $$;
reset role;

-- ── Carl, of another workspace, and Eve, of none: read nothing, push nothing there ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.roadmaps) or exists (select 1 from public.roadmap_prds) then
    raise exception 'FAIL: an account of another workspace read a roadmap';
  end if;
  begin
    perform public.roadmap_push(pg_temp.push_body());
    raise exception 'FAIL: an account of another workspace pushed a roadmap of its repository';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.roadmaps) then raise exception 'FAIL: an account in no workspace read a roadmap'; end if;
  begin
    perform public.roadmap_push(pg_temp.push_body());
    raise exception 'FAIL: an account in no workspace pushed a roadmap';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A loop's tick keeps the repositories it touched ──
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  loop_a uuid := (public.loop_push('start', null, '{"repo": "vertuoza/plan", "prds": [1213], "plan": {}}') ->> 'loopId')::uuid;
begin
  perform public.loop_push('tick', loop_a, '{"step": 1, "steps": 2, "prd": 1213, "action": "ultra-wave", "result": "wave 1 built", "repos": ["Crew", "ai-domain"], "nextWakeAt": null}');
  perform public.loop_push('tick', loop_a, '{"step": 2, "steps": 2, "prd": 1213, "action": "wait", "result": "CI running", "nextWakeAt": null}');
  if (select array_agg(repos::text order by step) from public.loop_ticks where loop_id = loop_a) <> '{"{crew,ai-domain}","{}"}' then
    raise exception 'FAIL: a tick did not keep its repositories, or one without them did not keep none';
  end if;
  begin
    perform public.loop_push('tick', loop_a, '{"step": 2, "steps": 2, "prd": 1213, "action": "wait", "result": "x", "repos": ["crew api"], "nextWakeAt": null}');
    raise exception 'FAIL: a tick''s repository that is not a name was taken';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;

-- ── The human work a roadmap waits on (PRD 1217) ──
-- Ada pushes roadmap 1400 with two pieces of human work: each new key stored with its rule kind, open.
-- The next push without one closes it at that push; a push without `humanWork` closes nothing; a key
-- back is open again; a stored key keeps its kind. Nobody signed in writes the table, and an account
-- of another workspace reads none of it.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  secret  jsonb := jsonb_build_object('key', 'outbox:1213/s2-01', 'prd', 1213, 'repo', 'AI-Domain', 'source', 'outbox',
                                      'text', 'The think endpoint needs its token', 'act', 'Add the secret CREW_TOKEN to ai-domain.',
                                      'url', 'https://github.com/vertuoza/ai-domain/pull/9', 'ruleKind', 'dev-ops');
  ask     jsonb := jsonb_build_object('key', 'question:Q5', 'prd', null, 'repo', 'vertuoza/vertuo-omni-loop', 'source', 'question',
                                      'text', 'Who signs a mandate?', 'act', null, 'url', null, 'ruleKind', 'business');
  roadmap uuid;
  closed  timestamptz;
begin
  roadmap := (public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', jsonb_build_array(secret, ask)))) ->> 'roadmapId')::uuid;
  insert into pg_temp.ids values ('human', roadmap);
  if (select count(*) from public.roadmap_human_work where roadmap_id = roadmap and state = 'open' and kind_by = 'rule' and done_at is null) <> 2
     or not exists (select 1 from public.roadmap_human_work where roadmap_id = roadmap and key = 'outbox:1213/s2-01' and kind = 'dev-ops'
                      and prd = 1213 and repo = 'ai-domain' and source = 'outbox' and act like 'Add the secret%')
     or not exists (select 1 from public.roadmap_human_work where roadmap_id = roadmap and key = 'question:Q5' and kind = 'business'
                      and prd is null and act is null and url is null) then
    raise exception 'FAIL: a new key was not stored open with its rule kind';
  end if;

  -- The question is answered: the next push no longer carries it, and it is done at that push.
  perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', jsonb_build_array(secret))));
  closed := (select done_at from public.roadmap_human_work where roadmap_id = roadmap and key = 'question:Q5' and state = 'done');
  if closed is null or exists (select 1 from public.roadmap_human_work where roadmap_id = roadmap and key = 'outbox:1213/s2-01' and state <> 'open') then
    raise exception 'FAIL: a key missing from the push was not done, or one carried was closed';
  end if;

  -- A push from a kit without the field, or with it null, changes nothing stored.
  perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400)));
  perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', null)));
  if (select array_agg(state order by key) from public.roadmap_human_work where roadmap_id = roadmap) <> '{open,done}'
     or (select done_at from public.roadmap_human_work where roadmap_id = roadmap and key = 'question:Q5') <> closed then
    raise exception 'FAIL: a push without humanWork changed the stored human work';
  end if;

  begin
    update public.roadmap_human_work set kind = 'delivery-ops' where roadmap_id = roadmap;
    raise exception 'FAIL: a signed-in account changed human work directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- The token item is classified by someone else (Jev, from s3): written here as the owner. The question
-- comes back next: it is open again, and the token item keeps its kind while its text is refreshed.
update public.roadmap_human_work set kind = 'delivery-ops', kind_by = 'jev'
 where roadmap_id = (select id from pg_temp.ids where name = 'human') and key = 'outbox:1213/s2-01';
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  roadmap uuid := (select id from pg_temp.ids where name = 'human');
begin
  perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', jsonb_build_array(
    jsonb_build_object('key', 'outbox:1213/s2-01', 'prd', 1213, 'repo', 'ai-domain', 'source', 'outbox', 'text', 'Still no token',
                       'ruleKind', 'development'),
    jsonb_build_object('key', 'question:Q5', 'repo', 'vertuoza/vertuo-omni-loop', 'source', 'question', 'text', 'Who signs a mandate?',
                       'ruleKind', 'business')))));
  if not exists (select 1 from public.roadmap_human_work where roadmap_id = roadmap and key = 'question:Q5' and state = 'open' and done_at is null)
     or not exists (select 1 from public.roadmap_human_work where roadmap_id = roadmap and key = 'outbox:1213/s2-01'
                      and kind = 'delivery-ops' and kind_by = 'jev' and text = 'Still no token' and act is null and url is null) then
    raise exception 'FAIL: a key back was not reopened, or a stored key did not keep its kind';
  end if;

  -- Malformed human work is refused, and changes nothing.
  begin
    perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', '{"key": "park:1"}'::jsonb)));
    raise exception 'FAIL: human work that is not a list was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', jsonb_build_array(
      jsonb_build_object('key', 'park:1213', 'repo', 'ai-domain', 'source', 'park', 'text', 'x', 'ruleKind', 'legal')))));
    raise exception 'FAIL: an unknown kind was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', jsonb_build_array(
      jsonb_build_object('key', 'park:1213', 'repo', 'ai-domain', 'source', 'outbox', 'text', 'x', 'ruleKind', 'development')))));
    raise exception 'FAIL: a key that is not its source''s was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_push(pg_temp.push_body(jsonb_build_object('number', 1400, 'humanWork', jsonb_build_array(
      jsonb_build_object('key', 'park:1213', 'repo', 'ai-domain', 'source', 'park', 'text', 'x', 'ruleKind', 'development'),
      jsonb_build_object('key', 'park:1213', 'repo', 'ai-domain', 'source', 'park', 'text', 'y', 'ruleKind', 'development')))));
    raise exception 'FAIL: a key used twice was taken';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.roadmap_human_work where roadmap_id = roadmap and state = 'open') <> 2 then
    raise exception 'FAIL: a refused push changed the human work';
  end if;

  -- Nothing is written but through the function.
  begin
    insert into public.roadmap_human_work (roadmap_id, key, repo, source, text, kind, kind_by)
    values (roadmap, 'park:9', 'ai-domain', 'park', 'planted', 'development', 'rule');
    raise exception 'FAIL: a signed-in account wrote human work directly';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.roadmap_human_work where roadmap_id = roadmap;
    raise exception 'FAIL: a signed-in account deleted human work directly';
  exception when insufficient_privilege then null; end;
end $$;
-- Carl, of another workspace, and the signed out read none of it.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.roadmap_human_work) then raise exception 'FAIL: an account of another workspace read human work'; end if;
end $$;
reset role;
set local role anon;
do $$
begin
  begin perform 1 from public.roadmap_human_work limit 1; raise exception 'FAIL: anon read human work';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- ── A roadmap's prerequisites and their last result (PRD 1218) ──
-- The prerequisites of roadmap 1200 and this machine's last result, its fields overridden by `extra`.
create function pg_temp.prerequisites_body(extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'repo', 'Vertuoza/Vertuo-Omni-Loop', 'number', 1200,
    'prerequisites', jsonb_build_array(
      jsonb_build_object('id', 'p1', 'category', 'local', 'need', 'Docker is running, for the database tests', 'check', 'base:docker',
                         'fix', null, 'blocks', jsonb_build_array('P1.1'), 'who', 'check', 'repos', jsonb_build_array(),
                         'card', jsonb_build_object('why', 'The tests start a database in Docker.', 'command', 'open -a Docker',
                                                    'whatItDoes', 'Starts the Docker app on your Mac.', 'whoCanDoIt', 'Anyone with this laptop.')),
      jsonb_build_object('id', 'p2', 'category', 'access', 'need', 'The dependencies install', 'check', 'base:install',
                         'fix', 'base:install', 'blocks', 'all', 'who', 'agent', 'repos', jsonb_build_array('Crew'), 'card', null),
      jsonb_build_object('id', 'p3', 'category', 'permissions', 'need', 'The Vercel preview has DATABASE_URL', 'check', null,
                         'fix', null, 'blocks', jsonb_build_array('P1.1'), 'who', 'person', 'repos', jsonb_build_array(),
                         'card', jsonb_build_object('why', 'The preview reads the database.', 'command', 'vercel env add DATABASE_URL preview',
                                                    'whatItDoes', 'Adds the secret to the previews.', 'whoCanDoIt', 'An admin of the Vercel project.'))),
    'result', jsonb_build_object('machine', 'pierre-mac', 'checkedAt', '2026-10-08T09:00:00Z', 'rows', jsonb_build_array(
      jsonb_build_object('id', 'p1', 'state', 'waits', 'detail', 'docker info exited 1'),
      jsonb_build_object('id', 'p2', 'state', 'fixed', 'detail', null),
      jsonb_build_object('id', 'p9', 'state', 'ok', 'detail', null)))
  ) || extra;
$$;

set local role anon;
do $$
begin
  begin perform 1 from public.roadmap_prerequisites limit 1; raise exception 'FAIL: anon read the roadmap prerequisites';
  exception when insufficient_privilege then null; end;
  begin perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body()); raise exception 'FAIL: anon pushed prerequisites';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  roadmap uuid := (select id from pg_temp.ids where name = 'crew');
  answer  jsonb;
begin
  answer := public.roadmap_prerequisites_push(pg_temp.prerequisites_body());
  if (answer ->> 'roadmapId')::uuid <> roadmap or (answer ->> 'prerequisites')::integer <> 3 then
    raise exception 'FAIL: the prerequisites push did not answer its roadmap and its count: %', answer;
  end if;
  if (select array_agg(row_id order by position) from public.roadmap_prerequisites where roadmap_id = roadmap) <> '{p1,p2,p3}'
     or not exists (select 1 from public.roadmap_prerequisites where roadmap_id = roadmap and row_id = 'p1' and category = 'local'
                      and check_with = 'base:docker' and fix_with is null and not blocks_all and blocks = '{P1.1}' and who = 'check'
                      and card ->> 'command' = 'open -a Docker' and state = 'waits' and detail = 'docker info exited 1')
     or not exists (select 1 from public.roadmap_prerequisites where roadmap_id = roadmap and row_id = 'p2' and fix_with = 'base:install'
                      and blocks_all and blocks = '{}' and repos = '{crew}' and card is null and state = 'fixed' and detail is null)
     or not exists (select 1 from public.roadmap_prerequisites where roadmap_id = roadmap and row_id = 'p3' and who = 'person' and state is null) then
    raise exception 'FAIL: the prerequisites were not stored in order, with their cards and the states their result gives';
  end if;
  if not exists (select 1 from public.roadmaps where id = roadmap and prerequisites_machine = 'pierre-mac'
                   and prerequisites_checked_at = '2026-10-08T09:00:00Z') then
    raise exception 'FAIL: the last result''s machine and time were not kept on the roadmap';
  end if;

  -- A roadmap push leaves them as they are; a later prerequisites push replaces them; none and no result clears them.
  perform public.roadmap_push(pg_temp.push_body());
  if (select count(*) from public.roadmap_prerequisites where roadmap_id = roadmap) <> 3 then
    raise exception 'FAIL: a roadmap push changed the stored prerequisites';
  end if;
  perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('result', jsonb_build_object(
    'machine', 'ci', 'checkedAt', '2026-10-09T09:00:00Z', 'rows', jsonb_build_array(jsonb_build_object('id', 'p3', 'state', 'ticked'))))));
  if (select array_agg(coalesce(state, '-') order by position) from public.roadmap_prerequisites where roadmap_id = roadmap) <> '{-,-,ticked}'
     or not exists (select 1 from public.roadmaps where id = roadmap and prerequisites_machine = 'ci') then
    raise exception 'FAIL: a later push did not replace the prerequisites and their result';
  end if;
  perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('prerequisites', jsonb_build_array(), 'result', null)));
  if exists (select 1 from public.roadmap_prerequisites where roadmap_id = roadmap)
     or not exists (select 1 from public.roadmaps where id = roadmap and prerequisites_machine is null and prerequisites_checked_at is null) then
    raise exception 'FAIL: a push of no prerequisites and no result did not clear them';
  end if;
  perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body());

  -- Malformed prerequisites are refused, and change nothing.
  begin
    perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('prerequisites', jsonb_build_array(
      jsonb_build_object('id', 'p1', 'category', 'hardware', 'need', 'x', 'blocks', 'all', 'who', 'check')))));
    raise exception 'FAIL: an unknown category was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('prerequisites', jsonb_build_array(
      jsonb_build_object('id', 'p1', 'category', 'local', 'need', 'x', 'fix', 'base:install', 'blocks', 'all', 'who', 'check')))));
    raise exception 'FAIL: a fix on a row that is not an agent''s was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('prerequisites', jsonb_build_array(
      jsonb_build_object('id', 'p1', 'category', 'local', 'need', 'x', 'blocks', 'all', 'who', 'check'),
      jsonb_build_object('id', 'p1', 'category', 'local', 'need', 'y', 'blocks', 'all', 'who', 'check')))));
    raise exception 'FAIL: a prerequisite id used twice was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('result', jsonb_build_object(
      'machine', 'ci', 'checkedAt', '2026-10-09T09:00:00Z', 'rows', jsonb_build_array(jsonb_build_object('id', 'p1', 'state', 'passed'))))));
    raise exception 'FAIL: an unknown state was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('result', jsonb_build_object(
      'machine', 'ci', 'rows', jsonb_build_array()))));
    raise exception 'FAIL: a result without its time was taken';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body(jsonb_build_object('number', 4242)));
    raise exception 'FAIL: the prerequisites of a roadmap not pushed yet were taken';
  exception when invalid_parameter_value then null; end;
  if (select count(*) from public.roadmap_prerequisites where roadmap_id = roadmap) <> 3 then
    raise exception 'FAIL: a refused prerequisites push changed them';
  end if;

  -- Nothing is written but through the function.
  begin
    insert into public.roadmap_prerequisites (roadmap_id, position, row_id, category, need, who) values (roadmap, 9, 'p9', 'local', 'planted', 'check');
    raise exception 'FAIL: a signed-in account wrote a prerequisite directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.roadmap_prerequisites set state = 'ok' where roadmap_id = roadmap;
    raise exception 'FAIL: a signed-in account changed a prerequisite directly';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Carl, of another workspace: reads none of them, pushes none there.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.roadmap_prerequisites) then
    raise exception 'FAIL: an account of another workspace read a roadmap''s prerequisites';
  end if;
  begin
    perform public.roadmap_prerequisites_push(pg_temp.prerequisites_body());
    raise exception 'FAIL: an account of another workspace pushed a roadmap''s prerequisites';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select 'roadmaps checks passed' as result;
rollback;
