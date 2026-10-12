-- The roadmaps (PRD 1162, s2, docs: .omni-loop/delivery/inbox/1162-roadmap/spec.md): a milestone
-- delivered by a set of PRDs ordered by their blockers, told to the app by the kit's `omni roadmap push`
-- through POST /api/roadmaps, so the Roadmaps page shows every roadmap of a workspace, its Gantt and
-- what blocks it. And the repositories of a loop's tick, so the Loop page shows which repositories
-- each step touched (`omni loop push tick`, POST /api/loops).
--
-- - roadmaps: one row per roadmap, keyed by its workspace (repo_workspace(), as a loop is placed), its
--   repository and its number (the roadmap issue's). Its title, milestone, optional product (one of the
--   workspace's, matched by name), optional target date, where it was read from, its open questions
--   with any answer, and the last pushed `roadmap.md`.
-- - roadmap_prds: one row per PRD of a roadmap, in the table's order: its row id (P1.1), PRD number,
--   title, repositories, blockers, wave, state, the pull request it waits on, and when it started and
--   ended. A push replaces them all.
-- - roadmap_push(): the only writer. Any member of the workspace pushes, as the roadmap is the
--   workspace's, not one person's: the first push creates the roadmap, a later one replaces its document,
--   questions and PRD rows. A product named but not one of the workspace's is stored as none, and the
--   answer says so.
-- - loop_ticks.repos, and loop_push() taking `repos` on a tick.
--
-- No path, prompt or transcript is stored: numbers, short lines, links and the roadmap's own document.
-- A member of the workspace reads both tables; anyone else reads nothing, and nobody signed in writes
-- them directly.
--
-- Rollback: a follow-up migration drops roadmap_push(), roadmap_prds, roadmaps, the products key
-- products_id_workspace_key and loop_ticks.repos, and restores loop_push() of
-- 20261108090000_loops.sql. Nothing else reads them.

-- A roadmap's product is one of its own workspace's: the pair is a key the roadmap refers to.
create unique index products_id_workspace_key on public.products (id, workspace_id);

create table public.roadmaps (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  repo         text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  number       integer not null check (number > 0),
  title        text not null check (char_length(title) between 1 and 200),
  milestone    text not null check (char_length(milestone) between 1 and 500),
  product_id   uuid,
  target_date  date,
  source       text check (source is null or char_length(source) between 1 and 500),
  questions    jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  document     text not null check (char_length(document) between 1 and 200000),
  pushed_by    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  pushed_at    timestamptz not null default now(),
  constraint roadmaps_number_key unique (workspace_id, repo, number),
  constraint roadmaps_product_fkey foreign key (product_id, workspace_id)
    references public.products (id, workspace_id) on delete set null (product_id)
);

create index roadmaps_workspace_idx on public.roadmaps (workspace_id, pushed_at desc);

comment on table public.roadmaps is
  'A roadmap (PRD 1162): a milestone delivered by a set of PRDs. One row per roadmap, written through roadmap_push(), read by the workspace''s members.';
comment on column public.roadmaps.workspace_id is 'The workspace the repository belongs to for the person who pushed it first (repo_workspace()), never sent.';
comment on column public.roadmaps.repo is 'owner/name, in lower case: the repository holding roadmap.md.';
comment on column public.roadmaps.number is 'The roadmap issue''s number: its id in the repository.';
comment on column public.roadmaps.product_id is 'One of the workspace''s products, matched by name; null when none was named or the name matched none.';
comment on column public.roadmaps.target_date is 'A date a person gave; never estimated.';
comment on column public.roadmaps.source is 'Where the roadmap was read from: a link, a file or "pasted".';
comment on column public.roadmaps.questions is 'The open questions: [{id, question, recommendation, blocks, kind, answer}], kind default or person, answer null until given.';
comment on column public.roadmaps.document is 'The last pushed roadmap.md.';

create table public.roadmap_prds (
  roadmap_id   uuid not null references public.roadmaps (id) on delete cascade,
  position     integer not null check (position > 0),
  row_id       text not null check (row_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$'),
  prd          integer not null check (prd > 0),
  title        text not null check (char_length(title) between 1 and 200),
  repos        text[] not null default '{}' check (
                 cardinality(repos) <= 20 and array_position(repos, null) is null
                 and (cardinality(repos) = 0 or array_to_string(repos, ',') ~ '^[a-z0-9_.-]+(,[a-z0-9_.-]+)*$')),
  blockers     text[] not null default '{}' check (cardinality(blockers) <= 50),
  wave         integer not null check (wave > 0),
  state        text not null check (state in ('waiting', 'building', 'outbox', 'ready', 'merged', 'closed')),
  waits_on     text check (waits_on is null or char_length(waits_on) between 1 and 300),
  waits_on_url text check (waits_on_url is null or (waits_on_url ~ '^https?://' and char_length(waits_on_url) <= 500)),
  started_at   timestamptz,
  ended_at     timestamptz,
  primary key (roadmap_id, position),
  constraint roadmap_prds_row_key unique (roadmap_id, row_id),
  constraint roadmap_prds_ended_shape check (ended_at is null or started_at is null or ended_at >= started_at)
);

comment on table public.roadmap_prds is 'A roadmap''s PRDs (PRD 1162), in its table''s order; every push replaces them.';
comment on column public.roadmap_prds.row_id is 'The row''s id in roadmap.md, such as P1.1.';
comment on column public.roadmap_prds.repos is 'In a plan repository, the targets the PRD changes, by short name; empty otherwise.';
comment on column public.roadmap_prds.blockers is 'The row ids the PRD waits on.';
comment on column public.roadmap_prds.state is 'waiting, building, outbox, ready (waiting for a merge), merged, or closed (unmerged).';
comment on column public.roadmap_prds.waits_on is 'For a held PRD, one line naming the pull request it waits on and its state.';
comment on column public.roadmap_prds.started_at is 'When the PRD''s first step ran; null while it waits.';
comment on column public.roadmap_prds.ended_at is 'When its feature PR merged or closed.';

-- ── The only writer ─────────────────────────────────────────────────────────────

-- One push of the kit's `omni roadmap push`. `p_body`:
--   {repo, number, title, milestone, product?, target?, source?, questions, document,
--    prds: [{id, prd, title, repos, blockers, wave, state, waitsOn?, waitsOnUrl?, startedAt?, endedAt?}]}
-- Answers {roadmapId, created, product, unknownProduct}: `product` the name of the product it was filed
-- under, `unknownProduct` the name sent that matched none of the workspace's. Refused: 42501 signed out
-- or a repository no workspace of the caller owns; 22023 a malformed argument.
create function public.roadmap_push(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  body      jsonb := coalesce(p_body, '{}'::jsonb);
  v_repo    text;
  v_product public.products;
  v_named   text;
  v_roadmap public.roadmaps;
  v_created boolean;
  pick      record;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if jsonb_typeof(body) <> 'object' then
    raise exception 'A push carries its fields as an object.' using errcode = '22023';
  end if;
  v_repo := lower(btrim(coalesce(body ->> 'repo', '')));
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'A roadmap names its repository as owner/name.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'prds') is distinct from 'array' or jsonb_typeof(body -> 'questions') is distinct from 'array' then
    raise exception 'A roadmap carries its PRDs and its questions.' using errcode = '22023';
  end if;
  if jsonb_array_length(body -> 'prds') > 200 then
    raise exception 'A roadmap holds 200 PRDs at most.' using errcode = '22023';
  end if;

  select * into pick from public.repo_workspace(caller, v_repo);
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;

  -- The product, by name, among the workspace's own: a name that matches none files it under none.
  v_named := nullif(btrim(coalesce(body ->> 'product', '')), '');
  if v_named is not null then
    select * into v_product from public.products p
     where p.workspace_id = pick.workspace_id and lower(p.name) = lower(v_named)
     order by p.ordinal limit 1;
  end if;

  select * into v_roadmap from public.roadmaps r
   where r.workspace_id = pick.workspace_id and r.repo = v_repo and r.number = (body ->> 'number')::integer
   for update;
  v_created := v_roadmap.id is null;
  if v_created then
    insert into public.roadmaps (workspace_id, repo, number, title, milestone, product_id, target_date, source, questions, document, pushed_by)
    values (
      pick.workspace_id, v_repo, (body ->> 'number')::integer, btrim(body ->> 'title'), btrim(body ->> 'milestone'), v_product.id,
      (body ->> 'target')::date, nullif(btrim(body ->> 'source'), ''), body -> 'questions', body ->> 'document', caller
    )
    returning * into v_roadmap;
  else
    update public.roadmaps
       set title = btrim(body ->> 'title'), milestone = btrim(body ->> 'milestone'), product_id = v_product.id,
           target_date = (body ->> 'target')::date, source = nullif(btrim(body ->> 'source'), ''),
           questions = body -> 'questions', document = body ->> 'document', pushed_by = caller, pushed_at = now()
     where id = v_roadmap.id
     returning * into v_roadmap;
    delete from public.roadmap_prds where roadmap_id = v_roadmap.id;
  end if;

  insert into public.roadmap_prds (roadmap_id, position, row_id, prd, title, repos, blockers, wave, state, waits_on, waits_on_url, started_at, ended_at)
  select v_roadmap.id, e.ordinality::integer, e.value ->> 'id', (e.value ->> 'prd')::integer, btrim(e.value ->> 'title'),
         coalesce(array(select lower(jsonb_array_elements_text(coalesce(e.value -> 'repos', '[]'::jsonb)))), '{}'),
         coalesce(array(select jsonb_array_elements_text(coalesce(e.value -> 'blockers', '[]'::jsonb))), '{}'),
         (e.value ->> 'wave')::integer, e.value ->> 'state', nullif(btrim(e.value ->> 'waitsOn'), ''), e.value ->> 'waitsOnUrl',
         (e.value ->> 'startedAt')::timestamptz, (e.value ->> 'endedAt')::timestamptz
    from jsonb_array_elements(body -> 'prds') with ordinality as e (value, ordinality);

  return jsonb_build_object(
    'roadmapId', v_roadmap.id,
    'created', v_created,
    'product', v_product.name,
    'unknownProduct', case when v_named is not null and v_product.id is null then v_named end
  );
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
    or not_null_violation or check_violation or unique_violation or foreign_key_violation then
    raise exception 'A roadmap''s fields are malformed: %', sqlerrm using errcode = '22023';
end;
$$;

revoke execute on function public.roadmap_push(jsonb) from public, anon;
grant execute on function public.roadmap_push(jsonb) to authenticated;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.roadmaps enable row level security;
alter table public.roadmap_prds enable row level security;

create policy "a member reads their workspace's roadmaps" on public.roadmaps
  for select to authenticated
  using (public.is_member(workspace_id));

create policy "a member reads their workspace's roadmap PRDs" on public.roadmap_prds
  for select to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and public.is_member(r.workspace_id)));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the tables: roadmap_push() does, as its owner.
revoke all on public.roadmaps, public.roadmap_prds from public, anon, authenticated, service_role;
grant select on public.roadmaps, public.roadmap_prds to authenticated;
grant select on public.roadmaps, public.roadmap_prds to service_role;

-- ── The repositories of a loop's tick ───────────────────────────────────────────

alter table public.loop_ticks
  add column repos text[] not null default '{}' check (
    cardinality(repos) <= 20 and array_position(repos, null) is null
    and (cardinality(repos) = 0 or array_to_string(repos, ',') ~ '^[a-z0-9_.-]+(/[a-z0-9_.-]+)?(,[a-z0-9_.-]+(/[a-z0-9_.-]+)?)*$'));

comment on column public.loop_ticks.repos is 'The repositories the tick''s step touched (PRD 1162): target short names in a plan repository, or owner/name; empty when it did not say.';

-- loop_push() of 20261108090000_loops.sql, its tick also taking `repos`. Everything else is as it was.
--   tick   {step, steps, prd, action, result, link?, merged?, items?, repos?, nextWakeAt, replan?: {reason, plan}}
create or replace function public.loop_push(p_event text, p_loop uuid default null, p_body jsonb default '{}'::jsonb)
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
    insert into public.loop_ticks (loop_id, step, steps, prd, action, result, link, merged, items, repos, next_wake_at)
    values (
      v_loop.id, (body ->> 'step')::integer, (body ->> 'steps')::integer, v_prd, body ->> 'action', body ->> 'result',
      body ->> 'link',
      coalesce(array(select jsonb_array_elements_text(coalesce(body -> 'merged', '[]'::jsonb))::integer), '{}'),
      coalesce(array(select jsonb_array_elements_text(coalesce(body -> 'items', '[]'::jsonb))), '{}'),
      coalesce(array(select lower(jsonb_array_elements_text(coalesce(body -> 'repos', '[]'::jsonb)))), '{}'),
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
