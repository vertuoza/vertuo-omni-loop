-- Missions (PRD 2842 s2, docs: .omni-loop/delivery/inbox/2842-missions/spec.md): a goal a person states
-- once, that a Virtual Fleet (20270122090000_virtual_fleets.sql) then delivers on its own. The kit's
-- `omni mission push <n>` sends mission <n>'s `mission.md` and `mission.html` to its page, a dossier of
-- kind `mission`, through mission_push(), which also keeps the mission's own row in step with its brief.
--
-- - dossiers.kind takes `mission`, numbered by the mission's issue (never a draft); dossier_versions.kind
--   takes `mission-record` (mission.md) and `brief` (mission.html); dossier_takes() pairs them.
-- - missions: one row per mission, keyed by its workspace (repo_workspace(), as a roadmap is placed), its
--   repository and its number: the Virtual Fleet that takes it, its title, goal, measures (0 to 5, each
--   {sign, read, target}), scope ({prds, roadmaps}, at least one), mandate ({parallel}, 1 to 4), its
--   status (`draft` until a person starts it), what it waits on, who started it and when it wakes next.
-- - mission_events: what a mission did, append only: an update or a delete is refused; only the
--   mission's deletion cascades to them. Each is signed by its role and its actor, `agent` or a member's
--   login, never a person's words: no credential, no transcript, no log excerpt.
-- - runner_jobs.mission_id and runner_jobs.mission_key (unique): the job a mission sent, under a key that
--   never repeats (`mission:<id>:prd:<n>:run:<k>`), so a replay inserts nothing twice.
-- - mission_push(): the only writer a signed-in person reaches. Any member of the workspace pushes, as the
--   mission is the workspace's: the first push creates the dossier and the mission in `draft`; a later one
--   adds a version only of a file that changed, and updates the brief's fields only when one changed,
--   never the status. A fleet that is not one of the workspace's active Virtual Fleets is refused.
--
-- A member of the workspace reads the missions and their events; anyone else reads nothing, and nobody
-- signed in writes the tables directly: the service role does (the supervisor, Start, Pause, Resume).
--
-- Proven by supabase/checks/missions.sql.
-- Rollback: a follow-up migration drops mission_push(), the three shape functions, mission_events,
-- missions, runner_jobs.mission_key and runner_jobs.mission_id, deletes the dossiers of kind mission, and
-- restores the three kind checks and dossier_takes() of 20261210100000_product_roadmaps.sql.

-- ── The mission's page: a dossier kind ──────────────────────────────────────────

alter table public.dossiers drop constraint dossiers_kind_check;
alter table public.dossiers add constraint dossiers_kind_check check (kind in ('prd', 'visual', 'bug', 'concept', 'roadmap', 'mission'));

comment on column public.dossiers.kind is
  'prd, visual (a visual fix), bug (a bug fix), concept (PRD 1272), roadmap (PRD 2011: a roadmap born on the server, keyed by its product and product_seq) or mission (PRD 2842: a mission''s brief). For a fix, a concept or a mission, prd holds its issue''s number: it is never a draft.';

alter table public.dossier_versions drop constraint dossier_versions_kind_check;
alter table public.dossier_versions add constraint dossier_versions_kind_check
  check (kind in ('spec', 'plan', 'before-after', 'variations', 'bug-record', 'voice', 'concept-record', 'vision', 'board', 'debate',
                  'roadmap', 'roadmap-prds', 'roadmap-human-work', 'roadmap-prerequisites', 'mission-record', 'brief'));

-- As 20261210100000_product_roadmaps.sql, with a mission's two kinds.
create or replace function public.dossier_takes(p_dossier_kind text, p_version_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_dossier_kind
           when 'prd' then p_version_kind in ('spec', 'plan', 'before-after', 'voice')
           when 'visual' then p_version_kind in ('before-after', 'variations')
           when 'bug' then p_version_kind = 'bug-record'
           when 'concept' then p_version_kind in ('concept-record', 'vision', 'board', 'debate')
           when 'roadmap' then p_version_kind in ('roadmap', 'roadmap-prds', 'roadmap-human-work', 'roadmap-prerequisites')
           when 'mission' then p_version_kind in ('mission-record', 'brief')
           else false
         end
$$;

-- ── The shape of a brief's fields ───────────────────────────────────────────────
-- The kit's schema (kit/lib/mission/brief.ts) refuses a malformed brief first, naming the field; these
-- hold the table to the same shape whoever writes it.

-- 0 to 5 measures, each exactly {sign, read, target}, each a text of 1 to 200 characters.
create function public.mission_measures_ok(p_measures jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  m jsonb;
begin
  if p_measures is null or jsonb_typeof(p_measures) <> 'array' or jsonb_array_length(p_measures) > 5 then
    return false;
  end if;
  for m in select value from jsonb_array_elements(p_measures) loop
    -- One test at a time: the keys of a value that is no object cannot be read.
    if jsonb_typeof(m) <> 'object' then
      return false;
    end if;
    if (select array_agg(k order by k) from jsonb_object_keys(m) k) is distinct from array['read', 'sign', 'target']
       or exists (select 1 from jsonb_each(m) f
                   where jsonb_typeof(f.value) <> 'string' or char_length(btrim(f.value #>> '{}')) not between 1 and 200) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Exactly {prds, roadmaps}: lists of distinct positive numbers, 50 PRDs and 10 roadmaps at most, one of
-- either at least.
create function public.mission_scope_ok(p_scope jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  list text;
  total integer := 0;
begin
  -- One test at a time: the keys of a value that is no object, or the length of no list, cannot be read.
  if p_scope is null or jsonb_typeof(p_scope) <> 'object' then
    return false;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p_scope) k) is distinct from array['prds', 'roadmaps'] then
    return false;
  end if;
  foreach list in array array['prds', 'roadmaps'] loop
    if jsonb_typeof(p_scope -> list) <> 'array' then
      return false;
    end if;
    -- Each CASE in parentheses: PL/pgSQL would read its THEN as the IF's.
    if jsonb_array_length(p_scope -> list) > (case list when 'prds' then 50 else 10 end)
       or exists (select 1 from jsonb_array_elements(p_scope -> list) e
                   where (case when jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[1-9][0-9]{0,9}$' then true
                               else (e.value #>> '{}')::bigint > 2147483647 end))
       or (select count(distinct e.value) from jsonb_array_elements(p_scope -> list) e) <> jsonb_array_length(p_scope -> list) then
      return false;
    end if;
    total := total + jsonb_array_length(p_scope -> list);
  end loop;
  return total >= 1;
end;
$$;

-- Exactly {parallel}: how many PRDs may run at once, 1 to 4.
create function public.mission_mandate_ok(p_mandate jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  -- Never null, which a check reads as passing: an empty object, or none, is refused.
  if p_mandate is null or jsonb_typeof(p_mandate) <> 'object'
     or (select array_agg(k) from jsonb_object_keys(p_mandate) k) is distinct from array['parallel'] then
    return false;
  end if;
  return jsonb_typeof(p_mandate -> 'parallel') = 'number' and (p_mandate ->> 'parallel') in ('1', '2', '3', '4');
end;
$$;

-- ── The missions ────────────────────────────────────────────────────────────────

create table public.missions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  repo         text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  fleet        text not null,
  number       integer not null check (number > 0),
  title        text not null check (char_length(title) between 1 and 200),
  goal         text not null check (char_length(goal) between 1 and 500),
  measures     jsonb not null default '[]'::jsonb constraint missions_measures_shape check (public.mission_measures_ok(measures)),
  scope        jsonb not null constraint missions_scope_shape check (public.mission_scope_ok(scope)),
  mandate      jsonb not null default '{"parallel": 2}'::jsonb constraint missions_mandate_shape check (public.mission_mandate_ok(mandate)),
  status       text not null default 'draft' check (status in ('draft', 'running', 'waiting', 'paused', 'delivered', 'stopped')),
  waiting_on   text check (waiting_on is null or char_length(waiting_on) between 1 and 300),
  started_by   uuid references auth.users (id) on delete set null,
  next_wake_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint missions_number_key unique (workspace_id, repo, number),
  foreign key (workspace_id, fleet) references public.teams (workspace_id, name) on update cascade
);

create index missions_workspace_idx on public.missions (workspace_id, updated_at desc);
create index missions_wake_idx on public.missions (next_wake_at) where status in ('running', 'waiting');

comment on table public.missions is
  'A mission (PRD 2842): a goal a Virtual Fleet delivers on its own. One row per mission, created in draft by mission_push(), moved by the service role, read by the workspace''s members.';
comment on column public.missions.workspace_id is 'The workspace the repository belongs to for the person who pushed it first (repo_workspace()), never sent.';
comment on column public.missions.repo is 'owner/name, in lower case: the repository holding the mission''s folder.';
comment on column public.missions.fleet is 'The Virtual Fleet that takes it (public.teams of kind virtual): its heroes are the mission''s team, its runners take its jobs.';
comment on column public.missions.number is 'The mission issue''s number: its id in the repository.';
comment on column public.missions.goal is 'One sentence: what changes, and for whom.';
comment on column public.missions.measures is 'The signs it worked once deployed, 0 to 5: [{sign, read, target}], read is how the sign is read.';
comment on column public.missions.scope is 'The PRDs and roadmaps of the repository it delivers: {prds: [n], roadmaps: [n]}, one at least.';
comment on column public.missions.mandate is 'How many PRDs may run at once: {parallel: 1 to 4}. It never merges and never answers for a person, whatever the mandate.';
comment on column public.missions.status is 'draft, running, waiting (on a person, named in waiting_on), paused, delivered or stopped.';
comment on column public.missions.waiting_on is 'What a person must do for it to carry on (approve, answer or merge, and which PRD), or why it stopped and how to resume.';
comment on column public.missions.started_by is 'The member who pressed Start; null while a draft.';
comment on column public.missions.next_wake_at is 'When the supervisor checks it next, while it runs or waits.';

-- ── What a mission did ──────────────────────────────────────────────────────────

create table public.mission_events (
  id         uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  at         timestamptz not null default now(),
  role       text not null check (role in ('pm', 'engineer', 'architect', 'qa', 'reviewer', 'supervisor')),
  actor      text not null check (actor = 'agent' or actor ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$'),
  kind       text not null check (kind in ('started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
                                           'prd-merged', 'held', 'stopped', 'delivered')),
  prd        integer check (prd is null or prd > 0),
  job_id     uuid,
  link       text check (link is null or (link ~ '^https?://' and char_length(link) <= 500)),
  sentence   text not null check (char_length(sentence) between 1 and 300)
);

create index mission_events_mission_idx on public.mission_events (mission_id, at desc);

comment on table public.mission_events is
  'What a mission did (PRD 2842), append only: one row per decision or end, signed by its role and actor. No credential, no transcript, no log excerpt.';
comment on column public.mission_events.actor is '`agent`, or the GitHub login of the member who acted (Start, Pause, Resume): never a person''s words.';
comment on column public.mission_events.job_id is 'The runner job it is about, when one: a job of public.runner_jobs, kept even once that job is gone.';
comment on column public.mission_events.link is 'Where to read more: a pull request, a PRD''s page, an answer. It links to a person''s words, never holds them.';

-- Nobody updates an event, and nobody deletes one: only its mission's deletion cascades to it (a
-- referential action runs inside a trigger, a direct delete does not).
create function public.mission_events_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'A mission event is never changed or deleted: record a new one.' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger mission_events_append_only
  before update or delete on public.mission_events
  for each row execute function public.mission_events_append_only();

-- ── The jobs a mission sent ─────────────────────────────────────────────────────

alter table public.runner_jobs
  add column mission_id uuid references public.missions (id) on delete set null,
  add column mission_key text constraint runner_jobs_mission_key_shape
    check (mission_key is null or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:prd:[1-9][0-9]*:run:[1-9][0-9]*$'),
  add constraint runner_jobs_mission_key_key unique (mission_key);

create index runner_jobs_mission_idx on public.runner_jobs (mission_id) where mission_id is not null;

comment on column public.runner_jobs.mission_id is 'The mission that sent the job (PRD 2842); null for any other job.';
comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>: unique, so a replay of the supervisor, or two runs at once, insert the job once.';

-- ── Who reads and writes them ───────────────────────────────────────────────────

alter table public.missions enable row level security;
alter table public.mission_events enable row level security;

create policy "a member reads their workspace's missions" on public.missions
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

create policy "a member reads their workspace's mission events" on public.mission_events
  for select to authenticated
  using (mission_id in (select m.id from public.missions m where m.workspace_id in (select public.my_workspaces())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the tables: mission_push() does, as its owner, and the service role does.
revoke all on public.missions, public.mission_events from public, anon, authenticated, service_role;
grant select on public.missions, public.mission_events to authenticated;
grant select, insert, update on public.missions to service_role;
grant select, insert on public.mission_events to service_role;

-- ── The only writer a signed-in person reaches ──────────────────────────────────

-- One push of the kit's `omni mission push <n>`: mission <n> of `p_repo`, titled `p_title`, its brief's
-- fields as `p_brief` ({fleet, goal, measures, scope, mandate}, read from mission.md by the kit's schema)
-- and its files as `p_artifacts` ([{kind, content}]: `mission-record`, mission.md, required; `brief`,
-- mission.html). Answers {id, added, unchanged, mission: {id, status, created}}: `id` the mission's
-- dossier. Refused: 42501 signed out, or a repository no workspace of the caller owns; 22023 a malformed
-- argument or a fleet that is no active Virtual Fleet of the workspace, the field as the hint; 23514 a
-- field the table's checks refuse.
create function public.mission_push(p_repo text, p_mission integer, p_title text, p_brief jsonb, p_artifacts jsonb)
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
  v_fleet := btrim(coalesce(brief ->> 'fleet', ''));
  v_goal := btrim(coalesce(brief ->> 'goal', ''));
  if char_length(v_goal) not between 1 and 500 then
    raise exception 'goal: one sentence of 1 to 500 characters.' using errcode = '22023', hint = 'goal';
  end if;
  if not public.mission_measures_ok(coalesce(brief -> 'measures', '[]'::jsonb)) then
    raise exception 'measures: 0 to 5, each a sign, how it is read and a target.' using errcode = '22023', hint = 'measures';
  end if;
  if not public.mission_scope_ok(brief -> 'scope') then
    raise exception 'scope: PRDs and roadmaps of the repository, one at least.' using errcode = '22023', hint = 'scope';
  end if;
  if not public.mission_mandate_ok(coalesce(brief -> 'mandate', '{"parallel": 2}'::jsonb)) then
    raise exception 'mandate: parallel is 1 to 4.' using errcode = '22023', hint = 'mandate';
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
  -- status, who started it or when it wakes.
  v_created := not exists (select 1 from public.missions m
                            where m.workspace_id = pick.workspace_id and m.repo = v_repo and m.number = p_mission);
  insert into public.missions as m (workspace_id, repo, fleet, number, title, goal, measures, scope, mandate)
  values (pick.workspace_id, v_repo, v_fleet, p_mission, v_title, v_goal, coalesce(brief -> 'measures', '[]'::jsonb),
          brief -> 'scope', coalesce(brief -> 'mandate', '{"parallel": 2}'::jsonb))
  on conflict (workspace_id, repo, number) do update
     set fleet = excluded.fleet, title = excluded.title, goal = excluded.goal, measures = excluded.measures,
         scope = excluded.scope, mandate = excluded.mandate, updated_at = now()
   where (m.fleet, m.title, m.goal, m.measures, m.scope, m.mandate)
         is distinct from (excluded.fleet, excluded.title, excluded.goal, excluded.measures, excluded.scope, excluded.mandate);
  select m.* into made from public.missions m
   where m.workspace_id = pick.workspace_id and m.repo = v_repo and m.number = p_mission;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged,
    'mission', jsonb_build_object('id', made.id, 'status', made.status, 'created', v_created));
end;
$$;

revoke execute on function public.mission_measures_ok(jsonb), public.mission_scope_ok(jsonb), public.mission_mandate_ok(jsonb) from public, anon;
grant execute on function public.mission_measures_ok(jsonb), public.mission_scope_ok(jsonb), public.mission_mandate_ok(jsonb) to authenticated, service_role;
revoke execute on function public.mission_push(text, integer, text, jsonb, jsonb) from public, anon;
grant execute on function public.mission_push(text, integer, text, jsonb, jsonb) to authenticated;
