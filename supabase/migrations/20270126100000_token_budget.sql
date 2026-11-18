-- A mission pauses and asks once it reaches its token budget (PRD 3040 s2, docs:
-- .omni-loop/delivery/inbox/3040-token-budget/spec.md, sections 1 to 3, criteria 2, 3, 5 to 9). It runs after
-- 20270126090000_product_mcp_member.sql, and builds on 20270124090000_fleet_level.sql (a fleet's setting on teams),
-- 20270124100000_mission_level.sql (mission_mandate_ok()), 20270125160000_qa_turn.sql (runner_jobs.tokens and the kinds of
-- a mission event) and 20270122093000_missions.sql.
--
-- - teams.daily_tokens: a virtual fleet's daily cap, the tokens its missions may spend over the last 24 hours. Null, the
--   default, is no cap; otherwise a whole number above 0. set_fleet_daily_tokens() is its only writer a person reaches: a
--   workspace owner alone sets or clears it (anyone else 42501); 0 or a negative number is refused (22023, hint
--   daily_tokens).
-- - mission_mandate_ok(): the mandate also takes an optional `tokens`, the mission's own budget over every job it sent: a
--   whole number from 1 to 10^9. A mandate without it, every mission made before, stays valid and has no budget.
--   set_mission_tokens() sets or clears it: any member of the mission's workspace on a draft, an owner alone once it runs,
--   waits or is paused, nobody once it is delivered or stopped.
-- - job_counted_tokens(), mission_tokens() and fleet_tokens_24h(): what counts toward a cap, input + output + cache writes
--   of each ended job (cache reads left out, a job with no tokens 0). mission_tokens() adds every ended job the mission
--   sent; fleet_tokens_24h() every ended job of the fleet's missions whose end is in the 24 hours up to a time (now by
--   default), with the end of the oldest one that counted, from which the supervisor dates `Resume tomorrow`. Both run as
--   their caller: a member reads their workspace's counts, anyone else 0.
-- - mission_budget_stops: one row per budget stop the supervisor records (the service role): whose cap (a mission's or its
--   fleet's), its value, what was spent, the missions it paused, and the person's answer, raised (with the new cap),
--   tomorrow (a fleet's cap only) or stopped, who gave it and when. One open stop per mission's cap and per fleet's cap, so
--   a replayed run records no second one. What a stop was never changes, and its answer is written once, never rewritten
--   (BR-PRODUCT-12). A member of its workspace reads it; anyone else nothing; nobody deletes one.
-- - answer_mission_budget_stop(): the only way a stop is answered, as the signed-in person: any member stops or resumes
--   tomorrow, an owner alone raises the cap, which it saves in the same statement (the mission's mandate or the fleet's
--   daily cap). The supervisor acts on the answer; nobody answers for a person, not the service role either.
-- - mission_events.kind takes budget-stop (the supervisor recorded a stop, role supervisor, actor agent) and budget-answer
--   (a person answered it, actor their login).
--
-- Laws kept: an answer never changes after it is given (BR-PRODUCT-12); a mission event and a stop are only ever added
-- (N-PRODUCT-16); no AI key is read or written, the caps hold counts (BR-PRODUCT-59); no membership, ask session or agent
-- link is read or written (BR-PRODUCT-28, 29, 39, 63, 64). A stop holds counts, ids and an answer: no credential, log excerpt
-- or person's words (L-GDPR-1, L-GDPR-2); it records a decision and is kept for good (L-GDPR-4).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/token_budget.sql.
-- Rollback: once no stop and no budget event exists, a follow-up migration drops answer_mission_budget_stop(),
-- mission_budget_stops and its two trigger functions, fleet_tokens_24h(), mission_tokens(), job_counted_tokens(),
-- set_mission_tokens(), set_fleet_daily_tokens() and teams.daily_tokens, and restores mission_mandate_ok() of
-- 20270124100000_mission_level.sql and mission_events_kind_check of 20270125160000_qa_turn.sql. A mission whose mandate holds
-- `tokens` has it removed first.

-- ── The fleet's daily cap ───────────────────────────────────────────────────────

alter table public.teams add column if not exists daily_tokens bigint;
alter table public.teams drop constraint if exists teams_daily_tokens;
alter table public.teams add constraint teams_daily_tokens check (daily_tokens is null or daily_tokens > 0);

comment on column public.teams.daily_tokens is
  'A Virtual Fleet''s daily cap (PRD 3040): the tokens (input + output + cache writes) its missions may spend over the last 24 hours. Null, the default, is no cap. Only a workspace owner sets it, through set_fleet_daily_tokens().';

-- An owner sets or clears a virtual fleet's daily cap.
create or replace function public.set_fleet_daily_tokens(p_workspace uuid, p_fleet text, p_tokens bigint) returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  made public.teams;
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace sets a fleet''s daily cap.' using errcode = '42501';
  end if;
  if p_tokens is not null and p_tokens <= 0 then
    raise exception 'Tokens per day: a whole number above 0, or none for no cap.' using errcode = '22023', hint = 'daily_tokens';
  end if;
  update public.teams t set daily_tokens = p_tokens
   where t.workspace_id = p_workspace and t.name = p_fleet and t.kind = 'virtual'
  returning * into made;
  if made.name is null then
    raise exception 'Fleet: no virtual fleet of that name.' using errcode = '22023', hint = 'fleet';
  end if;
  return made;
end;
$$;

-- ── A mission's budget: the mandate's tokens ────────────────────────────────────

-- As 20270124100000_mission_level.sql, the optional `tokens` added: a whole number from 1 to 10^9.
create or replace function public.mission_mandate_ok(p_mandate jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  -- Never null, which a check reads as passing: an empty object, or none, is refused.
  if p_mandate is null or jsonb_typeof(p_mandate) <> 'object' or not (p_mandate ? 'parallel')
     or exists (select 1 from jsonb_object_keys(p_mandate) k where k not in ('parallel', 'level', 'hardToRevert', 'ownPrds', 'tokens')) then
    return false;
  end if;
  if not (jsonb_typeof(p_mandate -> 'parallel') = 'number' and (p_mandate ->> 'parallel') in ('1', '2', '3', '4')) then
    return false;
  end if;
  if p_mandate ? 'level' and not (jsonb_typeof(p_mandate -> 'level') = 'string'
                                  and (p_mandate ->> 'level') in ('with-you', 'own-branch', 'alone')) then
    return false;
  end if;
  if p_mandate ? 'hardToRevert' and not (jsonb_typeof(p_mandate -> 'hardToRevert') = 'number'
                                         and (p_mandate ->> 'hardToRevert')::numeric between 0 and 1) then
    return false;
  end if;
  if p_mandate ? 'ownPrds' and not (jsonb_typeof(p_mandate -> 'ownPrds') = 'number'
                                    and (p_mandate ->> 'ownPrds') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10')) then
    return false;
  end if;
  -- One test at a time: only a whole number's text is cast.
  if p_mandate ? 'tokens' then
    if not (jsonb_typeof(p_mandate -> 'tokens') = 'number' and (p_mandate ->> 'tokens') ~ '^[1-9][0-9]{0,9}$') then
      return false;
    end if;
    if (p_mandate ->> 'tokens')::bigint > 1000000000 then
      return false;
    end if;
  end if;
  return true;
end;
$$;

comment on column public.missions.mandate is
  'How a mission runs: {parallel: 1 to 4, level: with-you | own-branch | alone, hardToRevert: 0 to 1, ownPrds: 0 to 10, tokens: 1 to 10^9}; only parallel is required, a mission without a level reads as with-you, one without tokens has no token budget (PRD 3040). It never merges into the default branch and never answers for a person, whatever the mandate.';

-- A member sets a draft mission's budget; once it runs, waits or is paused, an owner alone changes it.
create or replace function public.set_mission_tokens(p_mission uuid, p_tokens bigint) returns public.missions
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.missions;
  made public.missions;
begin
  select * into m from public.missions x where x.id = p_mission and x.workspace_id in (select public.my_workspaces()) for update;
  if auth.uid() is null or m.id is null then
    raise exception 'Only a member of the mission''s workspace sets its token budget.' using errcode = '42501';
  end if;
  if p_tokens is not null and p_tokens not between 1 and 1000000000 then
    raise exception 'Token budget: a whole number from 1 to 1000000000, or none for no budget.' using errcode = '22023', hint = 'tokens';
  end if;
  if m.status in ('delivered', 'stopped') then
    raise exception 'Token budget: a delivered or stopped mission keeps the one it had.' using errcode = '22023', hint = 'status';
  end if;
  if m.status <> 'draft' and not public.is_owner(m.workspace_id) then
    raise exception 'Only an owner of the workspace changes the token budget of a mission that started.' using errcode = '42501';
  end if;
  update public.missions x
     set mandate = case when p_tokens is null then x.mandate - 'tokens' else x.mandate || jsonb_build_object('tokens', p_tokens) end,
         updated_at = now()
   where x.id = p_mission
  returning * into made;
  return made;
end;
$$;

-- ── What counts ─────────────────────────────────────────────────────────────────

-- A job's counted tokens: input + output + cache writes, cache reads left out; 0 for a job with none. The column's check
-- (runner_jobs_tokens_shape) holds the four counts to whole numbers >= 0.
create or replace function public.job_counted_tokens(p_tokens jsonb) returns bigint
language sql immutable
set search_path = ''
as $$
  select case when p_tokens is null then 0::bigint
              else coalesce((p_tokens ->> 'input')::bigint, 0) + coalesce((p_tokens ->> 'output')::bigint, 0)
                   + coalesce((p_tokens ->> 'cacheWrite')::bigint, 0) end
$$;

-- What a mission spent: every ended job it sent.
create or replace function public.mission_tokens(p_mission uuid) returns bigint
language sql stable
set search_path = ''
as $$
  select coalesce(sum(public.job_counted_tokens(j.tokens)), 0)::bigint
    from public.runner_jobs j
   where j.mission_id = p_mission and j.ended_at is not null
$$;

-- What a fleet's missions spent in the 24 hours up to `p_at`, by each job's end, and the end of the oldest job that counted
-- (null when none did): it leaves the window 24 hours after.
create or replace function public.fleet_tokens_24h(p_workspace uuid, p_fleet text, p_at timestamptz default now())
returns table (tokens bigint, oldest_end timestamptz)
language sql stable
set search_path = ''
as $$
  select coalesce(sum(public.job_counted_tokens(j.tokens)), 0)::bigint,
         min(j.ended_at) filter (where public.job_counted_tokens(j.tokens) > 0)
    from public.runner_jobs j
    join public.missions m on m.id = j.mission_id
   where m.workspace_id = p_workspace and m.fleet = p_fleet
     and j.ended_at > p_at - interval '24 hours' and j.ended_at <= p_at
$$;

create index if not exists runner_jobs_mission_ended_idx on public.runner_jobs (mission_id, ended_at)
  where mission_id is not null and ended_at is not null;

-- ── A budget stop and its answer ────────────────────────────────────────────────

create table if not exists public.mission_budget_stops (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  fleet        text not null,
  cap          text not null check (cap in ('mission', 'fleet')),
  mission_id   uuid references public.missions (id) on delete cascade,
  cap_tokens   bigint not null check (cap_tokens > 0),
  spent        bigint not null check (spent >= 0),
  missions     uuid[] not null check (cardinality(missions) between 1 and 100 and array_position(missions, null) is null),
  answer       text check (answer is null or answer in ('raised', 'tomorrow', 'stopped')),
  raised_to    bigint check (raised_to is null or raised_to > 0),
  answered_by  uuid references auth.users (id) on delete set null,
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint mission_budget_stops_whose check ((cap = 'mission') = (mission_id is not null)),
  constraint mission_budget_stops_one_mission check (cap <> 'mission' or missions = array[mission_id]),
  constraint mission_budget_stops_answered check ((answer is null) = (answered_at is null)),
  constraint mission_budget_stops_raised check ((answer is not distinct from 'raised') = (raised_to is not null)),
  constraint mission_budget_stops_tomorrow check (answer is distinct from 'tomorrow' or cap = 'fleet'),
  foreign key (workspace_id, fleet) references public.teams (workspace_id, name) on update cascade
);

-- One open stop per cap: a replayed run, or two at once, records the second one nowhere.
create unique index if not exists mission_budget_stops_open_mission on public.mission_budget_stops (mission_id)
  where cap = 'mission' and answer is null;
create unique index if not exists mission_budget_stops_open_fleet on public.mission_budget_stops (workspace_id, fleet)
  where cap = 'fleet' and answer is null;
create index if not exists mission_budget_stops_fleet_idx on public.mission_budget_stops (workspace_id, fleet, created_at desc);
create index if not exists mission_budget_stops_missions_idx on public.mission_budget_stops using gin (missions);

comment on table public.mission_budget_stops is
  'A mission''s budget stops (PRD 3040): one row per stop the supervisor recorded when a mission''s budget or its fleet''s daily cap was reached, and the person''s answer, written once. Read by the workspace''s members, recorded by the service role, answered through answer_mission_budget_stop().';
comment on column public.mission_budget_stops.fleet is 'The fleet of the missions it paused: whose daily cap, for a fleet''s cap.';
comment on column public.mission_budget_stops.cap is 'Whose cap was reached: mission (this mission''s budget) or fleet (this fleet''s daily cap).';
comment on column public.mission_budget_stops.mission_id is 'The mission whose budget was reached, for a mission''s cap; null for a fleet''s.';
comment on column public.mission_budget_stops.cap_tokens is 'The cap''s value when it was reached.';
comment on column public.mission_budget_stops.spent is 'What was spent then (input + output + cache writes): the mission''s, or the fleet''s over the last 24 hours.';
comment on column public.mission_budget_stops.missions is 'The missions it paused, each of its fleet: the one mission for a mission''s cap.';
comment on column public.mission_budget_stops.answer is 'null while it waits; raised (the cap was raised to raised_to), tomorrow (resume once the fleet''s last 24 hours are under the cap, a fleet''s cap only) or stopped. Written once, never rewritten.';
comment on column public.mission_budget_stops.raised_to is 'The new cap, for a raised answer.';
comment on column public.mission_budget_stops.answered_by is 'The member who answered: set by answer_mission_budget_stop(), never by the caller.';
comment on column public.mission_budget_stops.answered_at is 'When it was answered: set by the database.';

-- A stop starts unanswered, its missions its fleet's, its time the database's.
create or replace function public.mission_budget_stops_start() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.answer is not null or new.raised_to is not null or new.answered_by is not null or new.answered_at is not null then
    raise exception 'A budget stop starts unanswered: a person answers it.' using errcode = '22023', hint = 'answer';
  end if;
  if exists (select 1 from unnest(new.missions) as p (id)
              where not exists (select 1 from public.missions m
                                 where m.id = p.id and m.workspace_id = new.workspace_id and m.fleet = new.fleet)) then
    raise exception 'Missions: each one of the stop''s fleet.' using errcode = '22023', hint = 'missions';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists mission_budget_stops_start on public.mission_budget_stops;
create trigger mission_budget_stops_start before insert on public.mission_budget_stops
  for each row execute function public.mission_budget_stops_start();

-- What a stop was never changes; it changes only by its answer, written once and dated by the database.
create or replace function public.mission_budget_stops_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.workspace_id, new.fleet, new.cap, new.mission_id, new.cap_tokens, new.spent, new.missions, new.created_at)
     is distinct from (old.id, old.workspace_id, old.fleet, old.cap, old.mission_id, old.cap_tokens, old.spent, old.missions, old.created_at) then
    raise exception 'A budget stop''s cap, value, spending, missions and time never change.' using errcode = '42501';
  end if;
  if old.answer is not null then
    raise exception 'A budget stop''s answer is given once: it was %.', old.answer using errcode = '42501';
  end if;
  if new.answer is null then
    raise exception 'A budget stop changes only by its answer.' using errcode = '22023', hint = 'answer';
  end if;
  new.answered_at := now();
  return new;
end;
$$;

drop trigger if exists mission_budget_stops_keep on public.mission_budget_stops;
create trigger mission_budget_stops_keep before update on public.mission_budget_stops
  for each row execute function public.mission_budget_stops_keep();

-- A member answers a stop, once, as themselves: stopped, or tomorrow for a fleet's cap; an owner alone raises the cap above
-- the one reached, and the new cap is saved with the answer.
create or replace function public.answer_mission_budget_stop(p_stop uuid, p_answer text, p_tokens bigint default null)
returns public.mission_budget_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.mission_budget_stops;
  made public.mission_budget_stops;
begin
  select * into s from public.mission_budget_stops b
   where b.id = p_stop and b.workspace_id in (select public.my_workspaces()) for update;
  if auth.uid() is null or s.id is null then
    raise exception 'Only a member of the workspace answers its budget stops.' using errcode = '42501';
  end if;
  if p_answer is null or p_answer not in ('raised', 'tomorrow', 'stopped') then
    raise exception 'Answer: one of raised, tomorrow or stopped.' using errcode = '22023', hint = 'answer';
  end if;
  if s.answer is not null then
    raise exception 'Answer: this stop was answered already (%).', s.answer using errcode = '22023', hint = 'answer';
  end if;
  if p_answer = 'tomorrow' and s.cap <> 'fleet' then
    raise exception 'Answer: Resume tomorrow is for a fleet''s daily cap.' using errcode = '22023', hint = 'answer';
  end if;
  if p_answer <> 'raised' and p_tokens is not null then
    raise exception 'Tokens: only a raised cap names a new number.' using errcode = '22023', hint = 'tokens';
  end if;
  if p_answer = 'raised' then
    if not public.is_owner(s.workspace_id) then
      raise exception 'Only an owner of the workspace raises a cap.' using errcode = '42501';
    end if;
    if p_tokens is null or p_tokens <= s.cap_tokens or (s.cap = 'mission' and p_tokens > 1000000000) then
      raise exception 'Tokens: a whole number above the cap reached (%)%.', s.cap_tokens,
        case when s.cap = 'mission' then ', up to 1000000000' else '' end using errcode = '22023', hint = 'tokens';
    end if;
    if s.cap = 'mission' then
      update public.missions m set mandate = m.mandate || jsonb_build_object('tokens', p_tokens), updated_at = now()
       where m.id = s.mission_id;
    else
      update public.teams t set daily_tokens = p_tokens where t.workspace_id = s.workspace_id and t.name = s.fleet;
    end if;
  end if;
  update public.mission_budget_stops b
     set answer = p_answer, raised_to = p_tokens, answered_by = auth.uid()
   where b.id = s.id
  returning * into made;
  return made;
end;
$$;

alter table public.mission_budget_stops enable row level security;

drop policy if exists "a member reads their workspace's budget stops" on public.mission_budget_stops;
create policy "a member reads their workspace's budget stops" on public.mission_budget_stops
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). The service role records a stop and
-- never answers one; nobody deletes one: it goes with its workspace or its mission.
revoke all on public.mission_budget_stops from public, anon, authenticated, service_role;
grant select on public.mission_budget_stops to authenticated;
grant select, insert on public.mission_budget_stops to service_role;

-- ── What a mission did: its budget stops ────────────────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written',
  'repair-started', 'retro', 'repair-ended', 'bug-reported', 'checked', 'budget-stop', 'budget-answer'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent), not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd), repair-started, retro, repair-ended and bug-reported (PRD 2980: a repair was sent, its retro named the cause, it ended, or the App filed an Omni Loop bug report; actor agent, each one sentence and one link, naming its fingerprint''s first 8 characters), checked (PRD 3001: a verdict of QA, role qa, actor agent, its round and its bugs'' issues in its sentence, linking its comment), or budget-stop and budget-answer (PRD 3040: the supervisor recorded a budget stop, role supervisor, actor agent, naming whose cap and its value; a person answered it, actor their login).';

-- ── Who may call what ───────────────────────────────────────────────────────────

revoke execute on function public.set_fleet_daily_tokens(uuid, text, bigint) from public, anon;
grant execute on function public.set_fleet_daily_tokens(uuid, text, bigint) to authenticated;
revoke execute on function public.set_mission_tokens(uuid, bigint) from public, anon;
grant execute on function public.set_mission_tokens(uuid, bigint) to authenticated;
revoke execute on function public.job_counted_tokens(jsonb) from public, anon;
grant execute on function public.job_counted_tokens(jsonb) to authenticated, service_role;
revoke execute on function public.mission_tokens(uuid) from public, anon;
grant execute on function public.mission_tokens(uuid) to authenticated, service_role;
revoke execute on function public.fleet_tokens_24h(uuid, text, timestamptz) from public, anon;
grant execute on function public.fleet_tokens_24h(uuid, text, timestamptz) to authenticated, service_role;
revoke execute on function public.mission_budget_stops_start(), public.mission_budget_stops_keep() from public, anon, authenticated;
revoke execute on function public.answer_mission_budget_stop(uuid, text, bigint) from public, anon;
grant execute on function public.answer_mission_budget_stop(uuid, text, bigint) to authenticated;
