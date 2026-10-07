-- The loops (PRD 1139, s2, docs: .omni-loop/delivery/inbox/1139-loop-drive/spec.md): a person's
-- `/loop /omni:drive` session, told to the app by the kit's `omni loop push` through POST /api/loops,
-- so the Loop page shows who runs a loop, on what, what it did tick by tick and what it waits on.
--
-- - loops: one row per loop. Its owner, the workspace the repository belongs to for them
--   (repo_workspace(), as a heartbeat is placed), the repository, the PRDs it drives, its stored state
--   (running, parked or stopped), the PRDs parked on a person with what each waits on, and its times:
--   started, last push, last tick, next wake, stopped. Whether a running loop is live, sleeping or
--   silent is read from those times (apps/galaxy/src/loop/state.ts), never stored.
-- - loop_ticks: the ledger, one row per tick: the step of the plan it took, the PRD, the action, a
--   one-line result, the PRD's page link, the sub-PRs it merged, the outbox items it opened, and the
--   next wake it set.
-- - loop_plans: every version of the loop's plan, with the one-line reason it was written. Version 1
--   comes with the start; a tick that replanned adds the next one. A version is never rewritten.
-- - loop_push(): the only writer. `start` opens a loop (refused while the caller already runs one on
--   the repository, unless it is silent and `takeOver` is sent), `tick` appends to the ledger and moves
--   the next wake, `park` records a PRD waiting on a person, `stop` ends the loop: parked when PRDs
--   still wait on people, stopped otherwise. Only the loop's owner pushes to it.
--
-- No path, prompt or transcript is stored: numbers, short plain-words lines, links and the plan the
-- kit computed. A member of the workspace reads the three tables; anyone else reads nothing, and
-- nobody signed in writes them directly.
--
-- Rollback: a follow-up migration drops loop_push(), loop_plans, loop_ticks and loops. Nothing else
-- reads them.

create table public.loops (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  repo         text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  prds         integer[] not null check (cardinality(prds) between 1 and 50 and 0 < all (prds)),
  state        text not null default 'running' check (state in ('running', 'parked', 'stopped')),
  parked       jsonb not null default '[]'::jsonb check (jsonb_typeof(parked) = 'array'),
  started_at   timestamptz not null default now(),
  seen_at      timestamptz not null default now(),
  last_tick_at timestamptz,
  next_wake_at timestamptz,
  stopped_at   timestamptz,
  constraint loops_stopped_shape check ((state = 'running') = (stopped_at is null))
);

create index loops_workspace_idx on public.loops (workspace_id, seen_at desc);
create index loops_owner_repo_idx on public.loops (user_id, repo) where state = 'running';

comment on table public.loops is
  'A person''s /omni:drive loop (PRD 1139): one row per loop, written by its owner through loop_push(), read by the workspace''s members.';
comment on column public.loops.workspace_id is 'The workspace the repository belongs to for the owner (repo_workspace()), never sent.';
comment on column public.loops.repo is 'owner/name, in lower case.';
comment on column public.loops.prds is 'The PRDs the loop drives, by number.';
comment on column public.loops.state is 'running until it stops; then parked when PRDs wait on people, else stopped. Live, sleeping and silent are read from the times.';
comment on column public.loops.parked is 'The PRDs parked on a person: [{prd, who, what, link, at}], one per PRD; a later tick of that PRD takes it out.';
comment on column public.loops.seen_at is 'The last push of any kind.';
comment on column public.loops.last_tick_at is 'The last tick; null before the first.';
comment on column public.loops.next_wake_at is 'When the loop said it would tick next; null before its first tick ends.';
comment on column public.loops.stopped_at is 'When the loop stopped, parked or not; null while it runs.';

create table public.loop_ticks (
  id           bigint generated always as identity primary key,
  loop_id      uuid not null references public.loops (id) on delete cascade,
  at           timestamptz not null default now(),
  step         integer not null check (step > 0),
  steps        integer not null check (steps >= step),
  prd          integer not null check (prd > 0),
  action       text not null check (action ~ '^[a-z][a-z-]{0,39}$'),
  result       text not null check (char_length(result) between 1 and 300),
  link         text check (link is null or (link ~ '^https?://' and char_length(link) <= 500)),
  merged       integer[] not null default '{}' check (cardinality(merged) <= 50 and 0 < all (merged)),
  items        text[] not null default '{}' check (cardinality(items) <= 50),
  next_wake_at timestamptz
);

create index loop_ticks_loop_idx on public.loop_ticks (loop_id, id);

comment on table public.loop_ticks is 'A loop''s ledger (PRD 1139): one row per tick, appended by loop_push(), never rewritten.';
comment on column public.loop_ticks.step is 'The step of the loop plan the tick took (step 7 of 23).';
comment on column public.loop_ticks.action is 'What the tick did: the skill it ran (wave, yolo, yolo-fix, pr-care), or wait or park.';
comment on column public.loop_ticks.result is 'One line in plain words.';
comment on column public.loop_ticks.link is 'The PRD''s page.';
comment on column public.loop_ticks.merged is 'The sub-PRs the tick merged, by number.';
comment on column public.loop_ticks.items is 'The outbox items the tick opened, by id.';

create table public.loop_plans (
  loop_id    uuid not null references public.loops (id) on delete cascade,
  version    integer not null check (version > 0),
  reason     text not null check (char_length(reason) between 1 and 300),
  plan       jsonb not null check (jsonb_typeof(plan) = 'object'),
  created_at timestamptz not null default now(),
  primary key (loop_id, version)
);

comment on table public.loop_plans is 'Every version of a loop''s plan (PRD 1139), with the one-line reason it was written; never rewritten.';
comment on column public.loop_plans.plan is 'The plan `omni next --plan` computed, as the kit sent it.';

-- ── The only writer ─────────────────────────────────────────────────────────────

-- A running loop no tick has reached for a while: its session died. It is silent 5 minutes after the
-- next wake it set; before its first tick has set one, an hour after its last push (a first tick may
-- run a whole wave).
create function public.loop_is_silent(l public.loops, at timestamptz) returns boolean
language sql
immutable
set search_path = ''
as $$
  select l.state = 'running' and case
    when l.next_wake_at is not null then at >= l.next_wake_at + interval '5 minutes'
    else at >= l.seen_at + interval '60 minutes'
  end;
$$;

-- One push of the kit's `omni loop push`. `p_event` is start, tick, park or stop; `p_loop` the loop's
-- id (null for start); `p_body` the event's fields:
--   start  {repo, prds, plan, reason?, takeOver?}
--   tick   {step, steps, prd, action, result, link?, merged?, items?, nextWakeAt, replan?: {reason, plan}}
--   park   {prd, who, what, link?}
--   stop   {}
-- Answers {loopId, state, planVersion}. Refused: 42501 signed out, a repository no workspace of the
-- caller owns, or a loop another account owns; P0002 no such loop; 55000 a second running loop of the
-- caller on the repository (naming it), a take-over of a loop that is not silent, or a push to a loop
-- that has stopped; 22023 a malformed argument.
create function public.loop_push(p_event text, p_loop uuid default null, p_body jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  body      jsonb := coalesce(p_body, '{}'::jsonb);
  v_repo    text;
  v_prds    integer[];
  v_loop    public.loops;
  v_running public.loops;
  v_version integer;
  v_prd     integer;
  pick      record;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if jsonb_typeof(body) <> 'object' then
    raise exception 'A push carries its fields as an object.' using errcode = '22023';
  end if;
  if p_event is null or p_event not in ('start', 'tick', 'park', 'stop') then
    raise exception 'A push is start, tick, park or stop.' using errcode = '22023';
  end if;

  if p_event = 'start' then
    v_repo := lower(btrim(coalesce(body ->> 'repo', '')));
    if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
      raise exception 'A loop names its repository as owner/name.' using errcode = '22023';
    end if;
    if jsonb_typeof(body -> 'prds') <> 'array' or jsonb_typeof(body -> 'plan') is distinct from 'object' then
      raise exception 'A loop starts with the PRDs it drives and its plan.' using errcode = '22023';
    end if;
    begin
      v_prds := array(select jsonb_array_elements_text(body -> 'prds')::integer);
    exception when invalid_text_representation then
      raise exception 'A loop''s PRDs are numbers.' using errcode = '22023';
    end;
    if cardinality(v_prds) not between 1 and 50 or not (0 < all (v_prds)) then
      raise exception 'A loop drives 1 to 50 PRDs, by number.' using errcode = '22023';
    end if;

    select * into pick from public.repo_workspace(caller, v_repo);
    if pick.workspace_id is null then
      raise exception '%', pick.refusal using errcode = '42501';
    end if;

    -- One running loop per person and repository: a second is refused naming the first, unless the
    -- first is silent and the push takes it over.
    select * into v_running from public.loops l
     where l.user_id = caller and l.repo = v_repo and l.state = 'running'
     order by l.started_at desc limit 1 for update;
    if v_running.id is not null then
      if not public.loop_is_silent(v_running, now()) then
        raise exception 'A loop already runs on %: %. Stop it first.', v_repo, v_running.id using errcode = '55000';
      end if;
      if coalesce((body ->> 'takeOver')::boolean, false) is not true then
        raise exception 'A silent loop is still open on %: %. Take it over to start another.', v_repo, v_running.id using errcode = '55000';
      end if;
      update public.loops set state = 'stopped', stopped_at = now(), seen_at = now() where id = v_running.id;
    end if;

    insert into public.loops (user_id, workspace_id, repo, prds)
    values (caller, pick.workspace_id, v_repo, v_prds)
    returning * into v_loop;
    insert into public.loop_plans (loop_id, version, reason, plan)
    values (v_loop.id, 1, coalesce(nullif(btrim(body ->> 'reason'), ''), 'the first plan'), body -> 'plan');
    return jsonb_build_object('loopId', v_loop.id, 'state', v_loop.state, 'planVersion', 1);
  end if;

  -- tick, park, stop: the caller's own loop, still running.
  if p_loop is null then
    raise exception 'A push names its loop.' using errcode = '22023';
  end if;
  select * into v_loop from public.loops l where l.id = p_loop for update;
  if v_loop.id is null then
    raise exception 'No loop %.', p_loop using errcode = 'P0002';
  end if;
  if v_loop.user_id <> caller then
    raise exception 'This loop is another account''s.' using errcode = '42501';
  end if;
  if v_loop.state <> 'running' then
    raise exception 'This loop has stopped: start a new one.' using errcode = '55000';
  end if;
  select max(p.version) into v_version from public.loop_plans p where p.loop_id = v_loop.id;

  if p_event = 'tick' then
    v_prd := (body ->> 'prd')::integer;
    if body ? 'replan' then
      if jsonb_typeof(body -> 'replan' -> 'plan') is distinct from 'object' or nullif(btrim(body -> 'replan' ->> 'reason'), '') is null then
        raise exception 'A new plan comes with its reason.' using errcode = '22023';
      end if;
      v_version := v_version + 1;
      insert into public.loop_plans (loop_id, version, reason, plan)
      values (v_loop.id, v_version, btrim(body -> 'replan' ->> 'reason'), body -> 'replan' -> 'plan');
    end if;
    insert into public.loop_ticks (loop_id, step, steps, prd, action, result, link, merged, items, next_wake_at)
    values (
      v_loop.id, (body ->> 'step')::integer, (body ->> 'steps')::integer, v_prd, body ->> 'action', body ->> 'result',
      body ->> 'link',
      coalesce(array(select jsonb_array_elements_text(coalesce(body -> 'merged', '[]'::jsonb))::integer), '{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(body -> 'items', '[]'::jsonb))), '{}'),
      (body ->> 'nextWakeAt')::timestamptz
    );
    -- A tick of a parked PRD means it moved again: it no longer waits.
    update public.loops
       set last_tick_at = now(), seen_at = now(), next_wake_at = (body ->> 'nextWakeAt')::timestamptz,
           parked = coalesce((select jsonb_agg(e) from jsonb_array_elements(parked) e where (e ->> 'prd')::integer <> v_prd), '[]'::jsonb)
     where id = v_loop.id
     returning * into v_loop;
  elsif p_event = 'park' then
    v_prd := (body ->> 'prd')::integer;
    if v_prd is null or v_prd < 1 or nullif(btrim(body ->> 'who'), '') is null or nullif(btrim(body ->> 'what'), '') is null then
      raise exception 'A parked PRD names its number, who it waits on and on what.' using errcode = '22023';
    end if;
    update public.loops
       set seen_at = now(),
           parked = coalesce((select jsonb_agg(e) from jsonb_array_elements(parked) e where (e ->> 'prd')::integer <> v_prd), '[]'::jsonb)
                    || jsonb_build_array(jsonb_build_object(
                         'prd', v_prd, 'who', btrim(body ->> 'who'), 'what', btrim(body ->> 'what'),
                         'link', body ->> 'link', 'at', now()))
     where id = v_loop.id
     returning * into v_loop;
  else
    update public.loops
       set state = case when jsonb_array_length(parked) > 0 then 'parked' else 'stopped' end,
           stopped_at = now(), seen_at = now(), next_wake_at = null
     where id = v_loop.id
     returning * into v_loop;
  end if;
  return jsonb_build_object('loopId', v_loop.id, 'state', v_loop.state, 'planVersion', v_version);
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
    or not_null_violation or check_violation then
    raise exception 'A push''s fields are malformed: %', sqlerrm using errcode = '22023';
end;
$$;

revoke execute on function public.loop_is_silent(public.loops, timestamptz) from public, anon;
grant execute on function public.loop_is_silent(public.loops, timestamptz) to authenticated;
revoke execute on function public.loop_push(text, uuid, jsonb) from public, anon;
grant execute on function public.loop_push(text, uuid, jsonb) to authenticated;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.loops enable row level security;
alter table public.loop_ticks enable row level security;
alter table public.loop_plans enable row level security;

create policy "a member reads their workspace's loops" on public.loops
  for select to authenticated
  using (public.is_member(workspace_id));

create policy "a member reads their workspace's loop ticks" on public.loop_ticks
  for select to authenticated
  using (exists (select 1 from public.loops l where l.id = loop_id and public.is_member(l.workspace_id)));

create policy "a member reads their workspace's loop plans" on public.loop_plans
  for select to authenticated
  using (exists (select 1 from public.loops l where l.id = loop_id and public.is_member(l.workspace_id)));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the tables: loop_push() does, as its owner.
revoke all on public.loops, public.loop_ticks, public.loop_plans from public, anon, authenticated, service_role;
grant select on public.loops, public.loop_ticks, public.loop_plans to authenticated;
grant select on public.loops, public.loop_ticks, public.loop_plans to service_role;
