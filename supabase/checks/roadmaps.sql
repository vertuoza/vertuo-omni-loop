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
-- each roadmap_prerequisites_push(), and read by the workspace's members alone. A roadmap born on the
-- server (PRD 2011) is a dossier of kind roadmap in its product, crew-R1, numbered by the product's own
-- counter apart from its PRDs; its rows name 912 or crew-12; each push adds a version only of what
-- changed; it is approved pinning its roadmap.md, which a change voids; any member pushes it, an account
-- of another workspace or of none finds no product of its key. One transaction, rolled back at the end;
-- then two creates at once, in two sessions on rows they commit and delete, take two numbers with no
-- gap. Any `FAIL:` stops the run.

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

-- ── A roadmap born on the server, in its product (PRD 2011 s1) ──
-- Vertuoza Crew takes the key crew. Its roadmaps are dossiers of kind roadmap, crew-R1, crew-R2, numbered
-- by the product's own counter, apart from its PRDs.
update public.products p set key = 'crew'
  from public.workspaces w where w.id = p.workspace_id and w.slug = 'vertuoza' and p.name = 'Vertuoza Crew';
update public.products p set key = 'anvils'
  from public.workspaces w where w.id = p.workspace_id and w.slug = 'acme' and p.name = 'Anvils';

-- A product roadmap's push, its fields overridden by `extra`: one PRD of a repository, one of the product.
create function pg_temp.product_body(extra jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'title', 'Crew goes mobile', 'milestone', 'A crew member approves from the phone.', 'target', '2027-06-30',
    'source', 'pasted', 'questions', jsonb_build_array(), 'document', E'---\nroadmap: crew-R1\n---\n',
    'prds', jsonb_build_array(
      jsonb_build_object('id', 'P1.1', 'prd', '912', 'title', 'Phone sign-in', 'repos', jsonb_build_array('crew'),
                         'blockers', jsonb_build_array(), 'wave', 1, 'state', 'building', 'startedAt', '2026-10-01T09:00:00Z'),
      jsonb_build_object('id', 'P1.2', 'prd', 'crew-12', 'title', 'Approve on the phone', 'repos', jsonb_build_array('crew', 'crew-app'),
                         'blockers', jsonb_build_array('P1.1'), 'wave', 2, 'state', 'waiting'))
  ) || extra;
$$;

-- Runs a call that must be refused with `code`.
create function pg_temp.refused(stmt text, code text, why text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % ran: %', why, stmt;
exception when others then
  if sqlstate <> code then raise exception 'FAIL: % answered % (%), not %', why, sqlstate, sqlerrm, code; end if;
end;
$$;

-- What the migration added, and who may write it.
do $$
begin
  if has_column_privilege('authenticated', 'public.products', 'roadmap_seq', 'update')
     or has_column_privilege('authenticated', 'public.roadmaps', 'dossier_id', 'update')
     or has_column_privilege('authenticated', 'public.roadmap_prds', 'prd_id', 'insert') then
    raise exception 'FAIL: a roadmap''s number, dossier or PRD id is written other than through roadmap_product_push()';
  end if;
  if not has_column_privilege('authenticated', 'public.roadmap_prds', 'prd_id', 'select')
     or not has_column_privilege('authenticated', 'public.roadmaps', 'dossier_id', 'select') then
    raise exception 'FAIL: a member cannot read a roadmap''s dossier or its rows'' PRD ids';
  end if;
  -- Every row a git-born push wrote names its PRD as text too.
  if exists (select 1 from public.roadmap_prds where prd is not null and prd_id <> prd::text)
     or not exists (select 1 from public.roadmap_prds where prd = 1201 and prd_id = '1201') then
    raise exception 'FAIL: a git-born roadmap''s rows do not name their PRD as text';
  end if;
end $$;

set local role anon;
select pg_temp.refused($q$select public.roadmap_product_push('crew', null, pg_temp.product_body())$q$, '42501', 'anon pushing a product roadmap');
reset role;

set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000a1', 'ada@vertuoza.com');
do $$
declare
  ws      uuid := (select id from public.workspaces where slug = 'vertuoza');
  crew    uuid := (select p.id from public.products p where p.key = 'crew' and p.workspace_id = (select id from public.workspaces where slug = 'vertuoza'));
  answer  jsonb;
  second  jsonb;
  dossier uuid;
  roadmap uuid;
  made    uuid;
begin
  -- The first create: crew-R1, a dossier of kind roadmap born on the server, with no repository.
  answer := public.roadmap_product_push('crew', null, pg_temp.product_body());
  dossier := (answer ->> 'dossierId')::uuid;
  roadmap := (answer ->> 'roadmapId')::uuid;
  insert into pg_temp.ids values ('crew-R1', roadmap), ('crew-R1 dossier', dossier);
  if answer ->> 'roadmap' <> 'crew-R1' or (answer ->> 'created')::boolean is not true or answer -> 'product' ->> 'name' <> 'Vertuoza Crew'
     or answer -> 'added' <> '[{"kind": "roadmap", "version": 1}, {"kind": "roadmap-prds", "version": 1}]'::jsonb
     or answer -> 'unchanged' <> '[]'::jsonb then
    raise exception 'FAIL: a first product push did not answer crew-R1 with its two versions: %', answer;
  end if;
  if not exists (select 1 from public.dossiers d
                  where d.id = dossier and d.kind = 'roadmap' and d.product_id = crew and d.product_seq = 1 and d.workspace_id = ws
                    and d.home_repo is null and d.prd is null and d.birthplace = 'server' and d.numbered_at is not null
                    and d.title = 'Crew goes mobile') then
    raise exception 'FAIL: crew-R1 is not a roadmap dossier of Crew, numbered 1, born on the server';
  end if;
  if not exists (select 1 from public.roadmaps r
                  where r.id = roadmap and r.dossier_id = dossier and r.repo is null and r.number is null and r.product_id = crew
                    and r.workspace_id = ws and r.document = E'---\nroadmap: crew-R1\n---\n' and r.target_date = '2027-06-30'
                    and r.pushed_by = '00000000-0000-4000-8000-0000000000a1') then
    raise exception 'FAIL: crew-R1''s roadmap is not keyed by its dossier, in its product';
  end if;
  -- A row names a PRD of a repository (912) or of the product (crew-12).
  if (select string_agg(row_id || '=' || prd_id || ':' || coalesce(prd::text, '-'), ' ' order by position)
        from public.roadmap_prds where roadmap_id = roadmap) <> 'P1.1=912:912 P1.2=crew-12:-' then
    raise exception 'FAIL: the rows do not name 912 and crew-12: %',
      (select string_agg(row_id || '=' || prd_id || ':' || coalesce(prd::text, '-'), ' ') from public.roadmap_prds where roadmap_id = roadmap);
  end if;

  -- The second create: crew-R2. The product's PRDs count apart: crew-1 is a PRD beside crew-R1.
  second := public.roadmap_product_push('crew', null, pg_temp.product_body(jsonb_build_object('title', 'Crew offline')));
  if second ->> 'roadmap' <> 'crew-R2' or (select roadmap_seq from public.products where id = crew) <> 2 then
    raise exception 'FAIL: a second create did not take crew-R2: %', second;
  end if;
  answer := public.dossier_push(null, null, 'Phone sign-in', null, '[]', 'prd', null, 'crew');
  if answer ->> 'prdId' <> 'crew-1' or (select prd_count from public.products where id = crew) <> 1 then
    raise exception 'FAIL: a product PRD did not take crew-1 beside crew-R1';
  end if;
  if (select count(*) from public.dossiers where product_id = crew and product_seq = 1) <> 2 then
    raise exception 'FAIL: crew-1 and crew-R1 are not two dossiers';
  end if;

  -- The same push again adds no version.
  answer := public.roadmap_product_push('crew', 1, pg_temp.product_body());
  if (answer ->> 'roadmapId')::uuid <> roadmap or (answer ->> 'created')::boolean or answer -> 'added' <> '[]'::jsonb
     or answer -> 'unchanged' <> '["roadmap", "roadmap-prds"]'::jsonb then
    raise exception 'FAIL: pushing crew-R1 unchanged added a version: %', answer;
  end if;
  -- One changed file adds one version of that file only.
  answer := public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object('document', E'---\nroadmap: crew-R1\ntitle: v2\n---\n')));
  if answer -> 'added' <> '[{"kind": "roadmap", "version": 2}]'::jsonb or answer -> 'unchanged' <> '["roadmap-prds"]'::jsonb then
    raise exception 'FAIL: a push changing roadmap.md alone did not add one version of it alone: %', answer;
  end if;
  if (select string_agg(kind || ':' || n, ' ' order by kind)
        from (select kind, count(*) n from public.dossier_versions where dossier_id = dossier group by kind) v) <> 'roadmap:2 roadmap-prds:1' then
    raise exception 'FAIL: crew-R1 does not keep two versions of roadmap.md and one of its rows';
  end if;
  if (select document from public.roadmaps where id = roadmap) <> E'---\nroadmap: crew-R1\ntitle: v2\n---\n' then
    raise exception 'FAIL: the roadmap does not keep its last document';
  end if;
  -- A row that moved adds a version of the rows alone, and replaces them.
  answer := public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object(
    'document', E'---\nroadmap: crew-R1\ntitle: v2\n---\n',
    'prds', jsonb_build_array(jsonb_build_object('id', 'P1.1', 'prd', 912, 'title', 'Phone sign-in', 'wave', 1, 'state', 'merged')))));
  if answer -> 'added' <> '[{"kind": "roadmap-prds", "version": 2}]'::jsonb
     or (select string_agg(prd_id || ':' || state, ' ') from public.roadmap_prds where roadmap_id = roadmap) <> '912:merged' then
    raise exception 'FAIL: a push moving a row did not add a version of the rows alone and replace them: %', answer;
  end if;

  -- Its human work and prerequisites: stored as a git-born roadmap's are, each a version of its own.
  answer := public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object(
    'document', E'---\nroadmap: crew-R1\ntitle: v2\n---\n',
    'prds', jsonb_build_array(jsonb_build_object('id', 'P1.1', 'prd', 912, 'title', 'Phone sign-in', 'wave', 1, 'state', 'merged')),
    'humanWork', jsonb_build_array(jsonb_build_object('key', 'outbox:crew-12/s2-01', 'prd', 'crew-12', 'repo', 'vertuoza/crew',
                                                      'source', 'outbox', 'text', 'Which sign-in?', 'ruleKind', 'business')),
    'prerequisites', jsonb_build_array(jsonb_build_object('id', 'p1', 'category', 'local', 'need', 'Docker runs', 'check', 'base:docker',
                                                          'blocks', 'all', 'who', 'check')),
    'prerequisiteResult', jsonb_build_object('machine', 'ada-mac', 'checkedAt', '2026-10-15T09:00:00Z',
                                             'rows', jsonb_build_array(jsonb_build_object('id', 'p1', 'state', 'ok'))))));
  if answer -> 'added' <> '[{"kind": "roadmap-human-work", "version": 1}, {"kind": "roadmap-prerequisites", "version": 1}]'::jsonb then
    raise exception 'FAIL: the human work and the prerequisites were not each a version of their own: %', answer;
  end if;
  if not exists (select 1 from public.roadmap_human_work where roadmap_id = roadmap and key = 'outbox:crew-12/s2-01' and prd is null and state = 'open')
     or not exists (select 1 from public.roadmap_prerequisites where roadmap_id = roadmap and row_id = 'p1' and blocks_all and state = 'ok')
     or not exists (select 1 from public.roadmaps where id = roadmap and prerequisites_machine = 'ada-mac') then
    raise exception 'FAIL: a product roadmap''s human work and prerequisites were not stored';
  end if;

  -- Approved on its page, pinning roadmap.md; a push changing it voids the approval, a push moving a row does not.
  made := (public.dossier_approve(dossier) ->> 'id')::uuid;
  if (select files from public.approvals where id = made) ->> 0 is null
     or (select jsonb_array_length(files) from public.approvals where id = made) <> 1
     or (select files -> 0 ->> 'kind' || ' ' || (files -> 0 ->> 'path') from public.approvals where id = made) <> 'roadmap roadmap.md' then
    raise exception 'FAIL: approving crew-R1 did not pin its roadmap.md alone';
  end if;
  perform public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object(
    'document', E'---\nroadmap: crew-R1\ntitle: v2\n---\n',
    'prds', jsonb_build_array(jsonb_build_object('id', 'P1.1', 'prd', 912, 'title', 'Phone sign-in', 'wave', 1, 'state', 'closed')))));
  if exists (select 1 from public.approval_voids where approval_id = made) then
    raise exception 'FAIL: a push moving a row voided crew-R1''s approval';
  end if;
  perform public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object('document', E'---\nroadmap: crew-R1\ntitle: v3\n---\n')));
  if not exists (select 1 from public.approval_voids where approval_id = made and kind = 'roadmap') then
    raise exception 'FAIL: a push changing roadmap.md left crew-R1''s approval in force';
  end if;
  if public.dossier_approve(dossier) ->> 'roadmap' <> 'crew-R1' then
    raise exception 'FAIL: approving crew-R1 again did not answer its id';
  end if;

  -- The refusals.
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', 9, pg_temp.product_body())$q$, 'P0002', 'a roadmap the product does not have');
  perform pg_temp.refused($q$select public.roadmap_product_push('nope', null, pg_temp.product_body())$q$, 'P0002', 'a key no product holds');
  perform pg_temp.refused($q$select public.roadmap_product_push('Crew', null, pg_temp.product_body())$q$, '22023', 'a key out of shape');
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', 0, pg_temp.product_body())$q$, '22023', 'a roadmap number of 0');
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', null, pg_temp.product_body() - 'document')$q$, '22023', 'a roadmap without its document');
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', null, pg_temp.product_body() - 'prds')$q$, '22023', 'a roadmap without its PRDs');
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object('prds', jsonb_build_array(
    jsonb_build_object('id', 'P1.1', 'prd', 'Crew 12', 'title', 'x', 'wave', 1, 'state', 'waiting')))))$q$, '22023', 'a PRD that is neither 912 nor crew-12');
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object('prds', jsonb_build_array(
    jsonb_build_object('id', 'P1.1', 'prd', 'crew-0', 'title', 'x', 'wave', 1, 'state', 'waiting')))))$q$, '22023', 'a product PRD numbered 0');
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', 1, pg_temp.product_body(jsonb_build_object('prds', jsonb_build_array(
    jsonb_build_object('id', 'P1.1', 'title', 'x', 'wave', 1, 'state', 'waiting')))))$q$, '22023', 'a row naming no PRD');
  if (select roadmap_seq from public.products where id = crew) <> 2 then
    raise exception 'FAIL: a refused create took a number';
  end if;
  -- A roadmap dossier takes only a roadmap's versions, and only through roadmap_product_push().
  perform pg_temp.refused($q$select public.dossier_push('vertuoza/vertuo-omni-loop', 77, 'x', null, '[]', 'roadmap')$q$, '22023', 'dossier_push() of a roadmap');
  if not public.dossier_takes('roadmap', 'roadmap-prds') or public.dossier_takes('roadmap', 'spec') or public.dossier_takes('prd', 'roadmap') then
    raise exception 'FAIL: a roadmap dossier takes other versions than a roadmap''s, or a PRD takes a roadmap''s';
  end if;
  -- Nothing is written but through the function.
  begin
    insert into public.roadmaps (workspace_id, dossier_id, title, milestone, document) values (ws, dossier, 't', 'm', 'd');
    raise exception 'FAIL: a signed-in account wrote a product roadmap directly';
  exception when insufficient_privilege then null; end;
  begin
    update public.products set roadmap_seq = 0 where id = crew;
    raise exception 'FAIL: a signed-in account reset a product''s roadmap counter';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A row of a git-born roadmap still takes its PRD as a number, and the two columns stay in step.
do $$
declare
  roadmap uuid := (select id from pg_temp.ids where name = 'crew');
begin
  insert into public.roadmap_prds (roadmap_id, position, row_id, prd, title, wave, state) values (roadmap, 7, 'P7', 1207, 'by number', 1, 'waiting');
  insert into public.roadmap_prds (roadmap_id, position, row_id, prd_id, title, wave, state) values (roadmap, 8, 'P8', '1208', 'by text', 1, 'waiting');
  update public.roadmap_prds set prd = 1217 where roadmap_id = roadmap and row_id = 'P7';
  if (select string_agg(prd_id || ':' || prd, ' ' order by position) from public.roadmap_prds where roadmap_id = roadmap and position in (7, 8))
     <> '1217:1217 1208:1208' then
    raise exception 'FAIL: a row''s two PRD columns are not kept in step';
  end if;
  begin
    insert into public.roadmap_prds (roadmap_id, position, row_id, prd, prd_id, title, wave, state) values (roadmap, 9, 'P9', 1209, '1210', 'x', 1, 'waiting');
    raise exception 'FAIL: a row naming two different PRDs was stored';
  exception when check_violation then null; end;
  -- A roadmap is keyed by its issue or by its dossier, never both, never neither.
  begin
    update public.roadmaps set dossier_id = (select id from pg_temp.ids where name = 'crew-R1 dossier') where id = roadmap;
    raise exception 'FAIL: a git-born roadmap took a dossier';
  exception when check_violation or unique_violation then null; end;
  begin
    update public.roadmaps set number = null where id = roadmap;
    raise exception 'FAIL: a git-born roadmap lost its number';
  exception when check_violation then null; end;
  delete from public.roadmap_prds where roadmap_id = roadmap and position in (7, 8);
end $$;

-- Bob, of the same workspace, reads crew-R1, its rows and its versions, and pushes it too.
set local role authenticated;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000b1', 'bob@vertuoza.com');
do $$
declare
  dossier uuid := (select id from pg_temp.ids where name = 'crew-R1 dossier');
  pushed  jsonb;
begin
  if not exists (select 1 from public.roadmaps where dossier_id = dossier)
     or not exists (select 1 from public.dossiers where id = dossier and kind = 'roadmap')
     or (select count(*) from public.dossier_versions where dossier_id = dossier) < 4 then
    raise exception 'FAIL: a member does not read a product roadmap and its versions';
  end if;
  pushed := public.roadmap_product_push('crew', 1, pg_temp.product_body());
  if pushed ->> 'roadmap' <> 'crew-R1'
     or (select pushed_by from public.roadmaps where dossier_id = dossier) <> '00000000-0000-4000-8000-0000000000b1' then
    raise exception 'FAIL: a member could not push a product roadmap';
  end if;
end $$;

-- Carl, of another workspace, and Eve, of none: read none of it, and find no product keyed crew.
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000c1', 'carl@acme.test');
do $$
begin
  if exists (select 1 from public.roadmaps where dossier_id is not null)
     or exists (select 1 from public.dossiers where kind = 'roadmap') then
    raise exception 'FAIL: an account of another workspace read a product roadmap';
  end if;
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', 1, pg_temp.product_body())$q$, 'P0002', 'another workspace pushing crew-R1');
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', null, pg_temp.product_body())$q$, 'P0002', 'another workspace creating a crew roadmap');
  perform pg_temp.refused(format('select public.dossier_approve(%L)', (select id from pg_temp.ids where name = 'crew-R1 dossier')),
                          '42501', 'another workspace approving crew-R1');
end $$;
select pg_temp.sign_in('00000000-0000-4000-8000-0000000000e1', 'eve@example.com');
do $$
begin
  if exists (select 1 from public.roadmaps where dossier_id is not null) then
    raise exception 'FAIL: an account of no workspace read a product roadmap';
  end if;
  perform pg_temp.refused($q$select public.roadmap_product_push('crew', null, pg_temp.product_body())$q$, 'P0002', 'an account of no workspace');
end $$;
reset role;

select 'roadmaps checks passed' as result;
rollback;

-- ── Two creates of a product roadmap at once: two numbers, no gap (PRD 2011 s1) ──
-- Two sessions create a Mobile roadmap together: the first holds the product's row until it commits, the
-- second waits on it, then takes the next number. The rows are committed (each session must see them)
-- and deleted at the end.
begin;
create extension if not exists dblink schema extensions;
do $$
declare
  link   constant text := 'host=db port=5432 dbname=postgres user=postgres password=postgres';
  setup  constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000002011200';
    delete from auth.users where id = '00000000-0000-4000-8000-0000020112a1';
    insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000020112a1', 'race@roadmaps.test');
    insert into public.workspaces (id, slug, name, github_org) values ('00000000-0000-4000-8000-000002011200', 'rm-race', 'RM Race', 'rm-race');
    insert into public.workspace_members (workspace_id, user_id) values ('00000000-0000-4000-8000-000002011200', '00000000-0000-4000-8000-0000020112a1');
    insert into public.businesses (id, workspace_id, name) values ('00000000-0000-4000-8000-0000020112f0', '00000000-0000-4000-8000-000002011200', 'RM Race');
    insert into public.products (id, workspace_id, business_id, name, key) values
      ('00000000-0000-4000-8000-0000020112e1', '00000000-0000-4000-8000-000002011200', '00000000-0000-4000-8000-0000020112f0', 'Mobile', 'mobile');
  $s$;
  teardown constant text := $s$
    delete from public.workspaces where id = '00000000-0000-4000-8000-000002011200';
    delete from auth.users where id = '00000000-0000-4000-8000-0000020112a1';
  $s$;
  as_race constant text := $s$
    begin;
    set local role authenticated;
    set local request.jwt.claims to '{"sub": "00000000-0000-4000-8000-0000020112a1", "role": "authenticated"}';
  $s$;
  create_one constant text := $s$select public.roadmap_product_push('mobile', null, jsonb_build_object(
    'title', 'Race', 'milestone', 'Both get a number.', 'questions', '[]'::jsonb, 'document', 'race', 'prds', '[]'::jsonb)) ->> 'roadmap'$s$;
  first  text;
  second text;
  busy   integer;
begin
  perform extensions.dblink_connect('rm_setup', link);
  perform extensions.dblink_exec('rm_setup', setup);
  perform extensions.dblink_connect('rm_one', link);
  perform extensions.dblink_connect('rm_two', link);
  begin
    perform extensions.dblink_exec('rm_one', as_race);
    perform extensions.dblink_exec('rm_two', as_race);
    select r into first from extensions.dblink('rm_one', create_one) as t (r text);
    perform extensions.dblink_send_query('rm_two', create_one);
    perform pg_sleep(0.3);
    busy := extensions.dblink_is_busy('rm_two');
    perform extensions.dblink_exec('rm_one', 'commit');
    select r into second from extensions.dblink_get_result('rm_two') as t (r text);
    perform * from extensions.dblink_get_result('rm_two') as t (r text);
    perform extensions.dblink_exec('rm_two', 'commit');
    if busy <> 1 then
      raise exception 'FAIL: the second roadmap create did not wait on the first';
    end if;
    if first <> 'mobile-R1' or second <> 'mobile-R2' then
      raise exception 'FAIL: two roadmap creates at once took % and %, not mobile-R1 and mobile-R2', first, second;
    end if;
    if (select string_agg(n::text, ',' order by n) from extensions.dblink('rm_setup',
          $s$select product_seq from public.dossiers where product_id = '00000000-0000-4000-8000-0000020112e1' and kind = 'roadmap'$s$) as t (n integer)) <> '1,2' then
      raise exception 'FAIL: two roadmap creates at once did not leave mobile-R1 and mobile-R2';
    end if;
  exception when others then
    perform extensions.dblink_disconnect('rm_one');
    perform extensions.dblink_disconnect('rm_two');
    perform extensions.dblink_exec('rm_setup', teardown);
    perform extensions.dblink_disconnect('rm_setup');
    raise;
  end;
  perform extensions.dblink_disconnect('rm_one');
  perform extensions.dblink_disconnect('rm_two');
  perform extensions.dblink_exec('rm_setup', teardown);
  perform extensions.dblink_disconnect('rm_setup');
end $$;
rollback;

select 'roadmaps: two creates at once passed' as result;
