-- A mission from a goal alone (PRD omni-loop-24 s3, docs: the PRD's spec on its page, Solution 1 and 3). It runs after
-- 20270129120000_mission_skill.sql, and builds on 20270129090000_mission_alone_store.sql (which last set mission_scope_ok() and
-- mission_mandate_ok()), 20270127100000_omni_bug_team.sql (which last set mission_push() and missions_scope_shape) and
-- 20270124100000_mission_level.sql (missions_level_guard()).
--
-- It only adds: no column, row or table is dropped, and no row is rewritten.
--
-- - mission_requests: what the New mission box keeps when a person presses Start, before the mission exists: the workspace,
--   the repository the mission is written in, the fleet's key, the goal word for word (1 to 300 characters, one line), who
--   pressed Start (their id and their GitHub login), the runner job that writes the mission, and, once it is pushed, the
--   mission's number. A member of the workspace reads it; nobody writes it but mission_request_make() and mission_push(); a
--   request is never deleted but with its workspace, and only its mission number is ever filled, once.
-- - mission_request_make(): a member presses Start. Run as the signed-in person: refused (42501) to anyone who is no member, and
--   to a member who is no owner when the fleet is below `alone` (a goal-only mission works alone, and starting at `alone` above
--   the fleet's level is an owner's telling); refused (22023) on a repository whose phase 0 is a pull request, a goal that is
--   blank, over 300 characters or not one line, and, with no repository named, when the fleet's runners hold several; P0002 no
--   such fleet or repository. Nothing is saved when it refuses. Otherwise it saves the request and queues one runner job for
--   the fleet's runners, `/omni:mission --request <id>`: the goal never travels in the line.
-- - missions_scope_shape and mission_push(): a `prds` mission whose scope names nothing is a goal-only one, kept only at `alone`
--   with `ownPrds` 1 to 10 (kit/lib/mission/brief.ts). A brief naming `request`, a request of the same workspace, repository
--   and fleet that no other mission took, whose person is still a member and an owner or on a fleet at `alone`, starts the
--   mission it files as that person: `started_by` is theirs, the `started` event is signed with their login, the request takes
--   the mission's number and the mission's job is added on the App's ledger, due at once. Any other request is ignored: the
--   push files a draft, as before.
-- - missions_level_guard(): the person whose level is checked is the request's, while mission_push() files a mission for a
--   request it starts (a transaction-local setting it alone sets), the signed-in person otherwise, as before.
--
-- Laws kept: only a person merges into the default branch (N-PRODUCT-15): nothing here merges; a person's words are never
-- reworded (BL-ASK-1): the goal is stored as typed; a member reads their own workspace's requests only (BR-PRODUCT-63, never#5);
-- the request records a decision of a person, kept with their workspace (L-GDPR-1, L-GDPR-4); an agent never acts in a person's
-- name (never#10): the start is the person's own press of Start, recorded once; no membership, ask session, AI key or agent
-- link is read or written beyond membership checks (BR-PRODUCT-28, 29, 39, 59, 64); no game ledger row is touched (N-PRODUCT-16).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/missions.sql (its mission requests section).
-- Rollback: once no request is kept and no mission's scope is empty but an omni-bugs one, a follow-up migration drops
-- mission_request_make(), mission_requests with its trigger function and mission_goal_only_ok(), and restores mission_push() and
-- missions_scope_shape of 20270127100000_omni_bug_team.sql and missions_level_guard() of 20270124100000_mission_level.sql.

-- ── A goal-only scope ───────────────────────────────────────────────────────────

-- A goal-only mission's scope and mandate (PRD omni-loop-24): the scope names no PRD and no roadmap, and the mandate runs at
-- `alone` with the PM writing 1 to 10 PRDs.
create or replace function public.mission_goal_only_ok(p_scope jsonb, p_mandate jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(p_scope = '{"prds": [], "roadmaps": []}'::jsonb
                  and jsonb_typeof(p_mandate) = 'object'
                  and p_mandate ->> 'level' = 'alone'
                  and jsonb_typeof(p_mandate -> 'ownPrds') = 'number'
                  and (p_mandate ->> 'ownPrds') in ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10'), false)
$$;

revoke execute on function public.mission_goal_only_ok(jsonb, jsonb) from public, anon;
grant execute on function public.mission_goal_only_ok(jsonb, jsonb) to authenticated, service_role;

alter table public.missions drop constraint if exists missions_scope_shape;
alter table public.missions add constraint missions_scope_shape check (
  case kind when 'omni-bugs' then scope = '{"prds": [], "roadmaps": []}'::jsonb
            else public.mission_scope_ok(scope) or public.mission_goal_only_ok(scope, mandate) end);

comment on column public.missions.scope is
  'The PRDs and roadmaps it delivers: {prds: [n | <key>-<n>], roadmaps: [n | <key>-R<n>]}, a repository''s numbers or a product''s ids (PRD omni-loop-21), one at least; empty for an omni-bugs mission, and for a goal-only one, which runs at alone with ownPrds 1 to 10 (PRD omni-loop-24).';

-- ── The requests ────────────────────────────────────────────────────────────────

create table if not exists public.mission_requests (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  repo            text not null constraint mission_requests_repo_shape check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' and char_length(repo) <= 200),
  fleet_key       text not null,
  goal            text not null constraint mission_requests_goal_shape
                    check (char_length(goal) between 1 and 300 and btrim(goal) <> '' and goal !~ '[[:cntrl:]]'),
  requested_by    uuid references auth.users (id) on delete set null,
  requested_login text not null constraint mission_requests_login_shape check (requested_login ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$'),
  job_id          uuid references public.runner_jobs (id) on delete set null,
  mission_number  integer constraint mission_requests_mission_shape check (mission_number is null or mission_number > 0),
  created_at      timestamptz not null default now(),
  foreign key (workspace_id, fleet_key) references public.teams (workspace_id, name) on update cascade
);

create index if not exists mission_requests_workspace_idx on public.mission_requests (workspace_id, fleet_key, created_at desc);

comment on table public.mission_requests is
  'PRD omni-loop-24: a goal a person gave a fleet with the New mission box, kept until the mission it became is pushed, and after. Written by mission_request_make() and mission_push() alone, read by the workspace''s members, kept with its workspace.';
comment on column public.mission_requests.repo is 'The repository the mission is written in, owner/name in lower case: the runner job''s.';
comment on column public.mission_requests.fleet_key is 'The Virtual Fleet that takes the mission (public.teams name): its runners take the job.';
comment on column public.mission_requests.goal is 'The goal as the person typed it, word for word: 1 to 300 characters, one line.';
comment on column public.mission_requests.requested_by is 'The member who pressed Start: the mission starts as theirs.';
comment on column public.mission_requests.requested_login is 'Their GitHub login, which signs the mission''s started event.';
comment on column public.mission_requests.job_id is 'The runner job /omni:mission --request <id> that writes the mission.';
comment on column public.mission_requests.mission_number is 'The mission it became (missions.number in the same repository), filled once when its brief is pushed; null until then.';

-- Only the mission number is ever filled, once; a request is never deleted but with its workspace.
create or replace function public.mission_requests_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 then
      raise exception 'A mission request is never deleted: it goes with its workspace.' using errcode = '42501';
    end if;
    return old;
  end if;
  -- A referential action (a fleet renamed, its job or its person gone) runs inside a trigger: it changes only its own column.
  if (new.id, new.workspace_id, new.repo, new.goal, new.requested_login, new.created_at)
        is distinct from (old.id, old.workspace_id, old.repo, old.goal, old.requested_login, old.created_at)
     or (new.fleet_key is distinct from old.fleet_key and pg_trigger_depth() = 1)
     or (old.mission_number is not null and new.mission_number is distinct from old.mission_number)
     or (old.job_id is not null and new.job_id is not null and new.job_id <> old.job_id)
     or (new.requested_by is not null and new.requested_by is distinct from old.requested_by) then
    raise exception 'A mission request is never changed: only its mission''s number is filled, once.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists mission_requests_keep on public.mission_requests;
create trigger mission_requests_keep
  before update or delete on public.mission_requests
  for each row execute function public.mission_requests_keep();

alter table public.mission_requests enable row level security;

drop policy if exists "a member reads their workspace's mission requests" on public.mission_requests;
create policy "a member reads their workspace's mission requests" on public.mission_requests
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

revoke all on public.mission_requests from public, anon, authenticated, service_role;
grant select on public.mission_requests to authenticated, service_role;
revoke execute on function public.mission_requests_keep() from public, anon, authenticated;

-- ── Start pressed ───────────────────────────────────────────────────────────────

-- The signed-in member presses Start on fleet p_fleet of workspace p_workspace with goal p_goal, the mission written in
-- p_repo (null: the one repository of the workspace the fleet's runners hold). Answers {id, repo, fleet, goal, job}.
-- 42501 no member, a member who is no owner on a fleet below alone, or no GitHub login; 22023 a malformed value or phase 0
-- on a pull request, its field first in the message and in `hint`; P0002 no such fleet or repository. Nothing is kept on a
-- refusal.
create or replace function public.mission_request_make(p_workspace uuid, p_fleet text, p_goal text, p_repo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  v_fleet public.teams%rowtype;
  v_repo  text := nullif(lower(btrim(coalesce(p_repo, ''))), '');
  held    text[];
  v_phase text;
  v_login text;
  made    public.mission_requests%rowtype;
  v_job   uuid;
begin
  if caller is null or p_workspace is null
     or not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = caller) then
    raise exception 'Only a member of the workspace starts its fleet''s missions.' using errcode = '42501';
  end if;
  select t.* into v_fleet from public.teams t
   where t.workspace_id = p_workspace and t.name = btrim(coalesce(p_fleet, '')) and t.kind = 'virtual' and t.retired_at is null;
  if not found then
    raise exception 'Fleet: % is no Virtual Fleet of this workspace.', coalesce(nullif(btrim(coalesce(p_fleet, '')), ''), 'none')
      using errcode = 'P0002', hint = 'fleet';
  end if;
  if v_fleet.level <> 'alone' and not exists (select 1 from public.workspace_members m
                                               where m.workspace_id = p_workspace and m.user_id = caller and m.role = 'owner') then
    raise exception 'A goal-only mission works alone: an owner starts it, or raises the fleet to Works alone.' using errcode = '42501', hint = 'level';
  end if;
  if p_goal is null or char_length(p_goal) not between 1 and 300 or btrim(p_goal) = '' or p_goal ~ '[[:cntrl:]]' then
    raise exception 'Goal: one line of 1 to 300 characters.' using errcode = '22023', hint = 'goal';
  end if;
  if v_repo is null then
    select array_agg(distinct r.full_name order by r.full_name) into held
      from public.runners n
      cross join lateral unnest(n.repos) as h (repo)
      join public.repositories r on r.workspace_id = p_workspace and r.full_name = lower(h.repo) and r.removed_at is null
     where n.workspace_id = p_workspace and n.fleet = v_fleet.name;
    if coalesce(cardinality(held), 0) = 0 then
      raise exception 'Repository: no runner of % holds a repository of this workspace.', v_fleet.name using errcode = 'P0002', hint = 'repo';
    end if;
    if cardinality(held) > 1 then
      raise exception 'Repository: name the one the mission is written in, %.', array_to_string(held, ' or ') using errcode = '22023', hint = 'repo';
    end if;
    v_repo := held[1];
  end if;
  select r.phase0 into v_phase from public.repositories r
   where r.workspace_id = p_workspace and r.full_name = v_repo and r.removed_at is null;
  if not found then
    raise exception 'Repository: no repository % in this workspace.', v_repo using errcode = 'P0002', hint = 'repo';
  end if;
  if v_phase <> 'server' then
    raise exception 'A goal-only mission needs phase 0 on the server.' using errcode = '22023', hint = 'phase0';
  end if;
  select coalesce(nullif(p.github_login, ''), (
           select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
             from auth.identities i
            where i.user_id = caller and i.provider = 'github'
            order by i.created_at limit 1))
    into v_login
    from (select 1) one
    left join public.players p on p.workspace_id = p_workspace and p.user_id = caller;
  if v_login is null or v_login !~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$' then
    raise exception 'Sign in with GitHub first: a mission''s events carry the login of the member who started it.' using errcode = '42501', hint = 'login';
  end if;

  insert into public.mission_requests (workspace_id, repo, fleet_key, goal, requested_by, requested_login)
  values (p_workspace, v_repo, v_fleet.name, p_goal, caller, v_login)
  returning * into made;
  insert into public.runner_jobs (workspace_id, line, repo, to_fleet, sent_by)
  values (p_workspace, '/omni:mission --request ' || made.id::text, v_repo, v_fleet.name, caller)
  returning id into v_job;
  update public.mission_requests r set job_id = v_job where r.id = made.id;

  return jsonb_build_object('id', made.id, 'repo', made.repo, 'fleet', made.fleet_key, 'goal', made.goal, 'job', v_job);
end;
$$;

revoke execute on function public.mission_request_make(uuid, text, text, text) from public, anon;
grant execute on function public.mission_request_make(uuid, text, text, text) to authenticated;

-- ── Whose level the guard checks ────────────────────────────────────────────────

-- As 20270124100000_mission_level.sql, the person checked being the request's while mission_push() files a mission for a
-- request it starts (`omni.mission_request_by`, set local by mission_push() alone), the signed-in person otherwise.
create or replace function public.missions_level_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_fleet text;
  v_old text := case when tg_op = 'UPDATE' then old.mandate ->> 'level' else null end;
  v_by uuid := coalesce(nullif(current_setting('omni.mission_request_by', true), '')::uuid, auth.uid());
begin
  select t.level into v_fleet from public.teams t where t.workspace_id = new.workspace_id and t.name = new.fleet;
  v_fleet := coalesce(v_fleet, 'with-you');
  if new.mandate ->> 'level' is null then
    new.mandate := new.mandate || jsonb_build_object('level', coalesce(v_old, v_fleet));
    return new;
  end if;
  if new.mandate ->> 'level' is not distinct from v_old then
    return new;
  end if;
  if v_by is not null
     and public.fleet_level_rank(new.mandate ->> 'level') > public.fleet_level_rank(v_fleet)
     and not exists (select 1 from public.workspace_members m
                      where m.workspace_id = new.workspace_id and m.user_id = v_by and m.role = 'owner') then
    raise exception 'Only an owner of the workspace starts a mission above its fleet''s level.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.missions_level_guard() from public, anon, authenticated;

-- ── The push takes a goal-only brief, and starts a request's mission ─────────────

-- As 20270127100000_omni_bug_team.sql, with a goal-only scope (empty, at alone, ownPrds 1 to 10) and a brief's `request`.
create or replace function public.mission_push(p_repo text, p_mission integer, p_title text, p_brief jsonb, p_artifacts jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_title   text := btrim(coalesce(p_title, ''));
  brief     jsonb := coalesce(p_brief, 'null'::jsonb);
  v_kind    text;
  v_scope   jsonb;
  v_fleet   text;
  v_goal    text;
  pick      record;
  target    public.dossiers%rowtype;
  item      jsonb;
  kinds     text[] := '{}';
  v_version integer;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
  made      public.missions%rowtype;
  v_created boolean;
  was       text;
  asked     public.mission_requests%rowtype;
  v_started boolean := false;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
    raise exception 'A push names its repository as owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  if p_mission is null or p_mission <= 0 then
    raise exception 'A mission''s number is a positive whole number: its issue''s.' using errcode = '22023', hint = 'mission';
  end if;
  if char_length(v_title) not between 1 and 200 then
    raise exception 'A push carries a title of 1 to 200 characters.' using errcode = '22023', hint = 'title';
  end if;
  if jsonb_typeof(brief) is distinct from 'object' then
    raise exception 'A mission push carries its brief as an object.' using errcode = '22023', hint = 'brief';
  end if;
  -- One test at a time: a kind that is no text is refused before it is read as one.
  if brief ? 'kind' and jsonb_typeof(brief -> 'kind') is distinct from 'string' then
    raise exception 'kind: prds or omni-bugs.' using errcode = '22023', hint = 'kind';
  end if;
  v_kind := coalesce(brief ->> 'kind', 'prds');
  if v_kind not in ('prds', 'omni-bugs') then
    raise exception 'kind: prds or omni-bugs.' using errcode = '22023', hint = 'kind';
  end if;
  v_fleet := btrim(coalesce(brief ->> 'fleet', ''));
  v_goal := btrim(coalesce(brief ->> 'goal', ''));
  if char_length(v_goal) not between 1 and 500 then
    raise exception 'goal: one sentence of 1 to 500 characters.' using errcode = '22023', hint = 'goal';
  end if;
  if not public.mission_measures_ok(coalesce(brief -> 'measures', '[]'::jsonb)) then
    raise exception 'measures: 0 to 5, each a sign, how it is read and a target.' using errcode = '22023', hint = 'measures';
  end if;
  if v_kind = 'omni-bugs' then
    v_scope := coalesce(brief -> 'scope', '{"prds": [], "roadmaps": []}'::jsonb);
    if v_scope <> '{"prds": [], "roadmaps": []}'::jsonb then
      raise exception 'scope: an omni-bugs mission takes the reported bugs, no PRD and no roadmap.' using errcode = '22023', hint = 'scope';
    end if;
  else
    -- A goal-only brief (PRD omni-loop-24) names nothing: its PM writes the PRDs, at alone only.
    v_scope := coalesce(brief -> 'scope', '{"prds": [], "roadmaps": []}'::jsonb);
    if v_scope = '{"prds": [], "roadmaps": []}'::jsonb then
      if not public.mission_goal_only_ok(v_scope, brief -> 'mandate') then
        raise exception 'scope: a goal-only mission works alone, its PM writing 1 to 10 PRDs (ownPrds).' using errcode = '22023', hint = 'scope';
      end if;
    elsif not public.mission_scope_ok(v_scope) then
      raise exception 'scope: PRDs and roadmaps of the repository, one at least.' using errcode = '22023', hint = 'scope';
    end if;
  end if;
  if not public.mission_mandate_ok(coalesce(brief -> 'mandate', '{"parallel": 2}'::jsonb)) then
    raise exception 'mandate: parallel is 1 to 4.' using errcode = '22023', hint = 'mandate';
  end if;
  if brief ? 'request' and not (jsonb_typeof(brief -> 'request') = 'string'
                                and (brief ->> 'request') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'request: a mission request''s id, a uuid.' using errcode = '22023', hint = 'request';
  end if;
  if p_artifacts is null or jsonb_typeof(p_artifacts) <> 'array' then
    raise exception 'The artifacts are a list of {kind, content}.' using errcode = '22023', hint = 'artifacts';
  end if;
  for item in select value from jsonb_array_elements(p_artifacts) loop
    if jsonb_typeof(item) <> 'object' or not public.dossier_takes('mission', coalesce(item ->> 'kind', ''))
       or jsonb_typeof(item -> 'content') is distinct from 'string' then
      raise exception 'Each artifact is {kind, content}, its kind mission-record or brief.' using errcode = '22023', hint = 'artifacts';
    end if;
    if (item ->> 'kind') = any (kinds) then
      raise exception 'Each kind is sent once: % came twice.', item ->> 'kind' using errcode = '22023', hint = 'artifacts';
    end if;
    kinds := kinds || (item ->> 'kind');
  end loop;
  if not ('mission-record' = any (kinds)) then
    raise exception 'A mission push carries its mission.md, as mission-record.' using errcode = '22023', hint = 'artifacts';
  end if;

  select * into pick from public.repo_workspace(caller, v_repo);
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;
  if not exists (select 1 from public.teams t
                  where t.workspace_id = pick.workspace_id and t.name = v_fleet and t.kind = 'virtual' and t.retired_at is null) then
    raise exception 'fleet: % is no Virtual Fleet of this workspace.', coalesce(nullif(v_fleet, ''), 'none') using errcode = '22023', hint = 'fleet';
  end if;
  -- A mission's kind is its first push's.
  select m.kind into was from public.missions m
   where m.workspace_id = pick.workspace_id and m.repo = v_repo and m.number = p_mission;
  if was is not null and was <> v_kind then
    raise exception 'kind: mission #% is of kind %, which a push never changes.', p_mission, was using errcode = '22023', hint = 'kind';
  end if;

  -- The request it came from (PRD omni-loop-24): one of this workspace, repository and fleet that no other mission took, whose
  -- person is still a member, and an owner or on a fleet at alone. Any other is ignored. A later push of the same mission finds
  -- it again, so the level stays checked against the request's person, but starts nothing more.
  if brief ? 'request' then
    select r.* into asked from public.mission_requests r
     where r.id = (brief ->> 'request')::uuid and r.workspace_id = pick.workspace_id and r.repo = v_repo and r.fleet_key = v_fleet
       and (r.mission_number is null or r.mission_number = p_mission) and r.requested_by is not null
       and exists (select 1 from public.workspace_members m
                    where m.workspace_id = pick.workspace_id and m.user_id = r.requested_by
                      and (m.role = 'owner' or exists (select 1 from public.teams t
                                                        where t.workspace_id = pick.workspace_id and t.name = v_fleet and t.level = 'alone')))
       for update;
  end if;

  -- Its page: the dossier keyed by the workspace, the repository and the mission's number.
  insert into public.dossiers (workspace_id, home_repo, kind, prd, title, opened_by, numbered_at)
  values (pick.workspace_id, v_repo, 'mission', p_mission, v_title, caller, now())
  on conflict (workspace_id, home_repo, kind, prd) do nothing;
  select d.* into target from public.dossiers d
   where d.workspace_id = pick.workspace_id and d.home_repo = v_repo and d.kind = 'mission' and d.prd = p_mission
     for update;
  update public.dossiers d set title = v_title where d.id = target.id and d.title is distinct from v_title;

  for item in select value from jsonb_array_elements(p_artifacts) loop
    v_version := public.dossier_add_version(target.id, item ->> 'kind', item ->> 'content', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item ->> 'kind');
    else
      added := added || jsonb_build_object('kind', item ->> 'kind', 'version', v_version);
    end if;
  end loop;

  -- Its row: created in draft; a later push changes the brief's fields only when one changed, never the
  -- status, the kind, who started it or when it wakes. For a request's mission, the level is checked against the request's person.
  if asked.id is not null then
    perform set_config('omni.mission_request_by', asked.requested_by::text, true);
  end if;
  v_created := was is null;
  insert into public.missions as m (workspace_id, repo, fleet, number, title, goal, measures, scope, mandate, kind)
  values (pick.workspace_id, v_repo, v_fleet, p_mission, v_title, v_goal, coalesce(brief -> 'measures', '[]'::jsonb),
          v_scope, coalesce(brief -> 'mandate', '{"parallel": 2}'::jsonb), v_kind)
  on conflict (workspace_id, repo, number) do update
     set fleet = excluded.fleet, title = excluded.title, goal = excluded.goal, measures = excluded.measures,
         scope = excluded.scope, mandate = excluded.mandate, updated_at = now()
   where (m.fleet, m.title, m.goal, m.measures, m.scope, m.mandate)
         is distinct from (excluded.fleet, excluded.title, excluded.goal, excluded.measures, excluded.scope, excluded.mandate);
  perform set_config('omni.mission_request_by', '', true);
  select m.* into made from public.missions m
   where m.workspace_id = pick.workspace_id and m.repo = v_repo and m.number = p_mission;

  -- The request's mission starts as its person's own Start, once: their id, their login on the event, its job due at once.
  if asked.id is not null and asked.mission_number is null and made.status = 'draft' then
    update public.missions m set status = 'running', started_by = asked.requested_by, next_wake_at = now(), updated_at = now()
     where m.id = made.id and m.status = 'draft';
    insert into public.mission_events (mission_id, at, role, actor, kind, sentence)
    values (made.id, now(), 'supervisor', asked.requested_login, 'started', asked.requested_login || ' started the mission.');
    update public.mission_requests r set mission_number = p_mission where r.id = asked.id;
    perform public.background_job_refresh('mission', 'mission:' || made.id::text, v_repo, jsonb_build_object('mission', made.id), 0,
                                          'mission:' || made.id::text);
    v_started := true;
    select m.* into made from public.missions m where m.id = made.id;
  end if;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged,
    'mission', jsonb_build_object('id', made.id, 'status', made.status, 'created', v_created, 'started', v_started));
end;
$$;

-- `create or replace` keeps the grants; they are stated again so this file reads whole.
revoke execute on function public.mission_push(text, integer, text, jsonb, jsonb) from public, anon;
grant execute on function public.mission_push(text, integer, text, jsonb, jsonb) to authenticated;
