-- A roadmap's prerequisites (PRD 1218, s5, docs: .omni-loop/delivery/inbox/1218-roadmap-prerequisites/spec.md):
-- what has to be true on the machine, on GitHub and around the repository before a roadmap's PRDs can
-- be built, each with its author card and the state the last `omni roadmap prereqs` found, told to the
-- app by the kit's `omni roadmap push` (its `prerequisites` and `prerequisiteResult`) through
-- POST /api/roadmaps, so the roadmap's Prerequisites tab lists them, those waiting on a person first.
--
-- - roadmap_prerequisites: one row per prerequisite of a roadmap, in its table's order: its row id (p1),
--   category, need, check and fix cells, the PRD rows it blocks (or all of them), who does it, the
--   targets it concerns, its four-line card, and the last result's state and why it waits.
-- - roadmaps.prerequisites_machine and roadmaps.prerequisites_checked_at: the machine the last result
--   was found on, and when. Both null until a push carries a result.
-- - roadmap_prerequisites_push(): the only writer, called after roadmap_push() by a push that carries
--   `prerequisites`: it replaces the roadmap's prerequisites and its last result. A push without the
--   field, from a kit before PRD 1218, calls nothing, so the roadmap stores exactly as it did.
--   roadmap_push() itself is not redefined.
--
-- Additive only: a table, two nullable columns and a function. No path, prompt or transcript is stored:
-- short lines, the card's words and the one command it gives a person. A member of the roadmap's
-- workspace reads the rows; anyone else reads nothing, and nobody signed in writes them.
--
-- Rollback: a follow-up migration drops roadmap_prerequisites_push(), roadmap_prerequisites,
-- roadmaps.prerequisites_checked_at and roadmaps.prerequisites_machine. Nothing else writes them; the
-- roadmap page reads them (s6).

create table public.roadmap_prerequisites (
  roadmap_id  uuid not null references public.roadmaps (id) on delete cascade,
  position    integer not null check (position > 0),
  row_id      text not null check (row_id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,19}$'),
  category    text not null check (category in ('local', 'access', 'permissions', 'github', 'services')),
  need        text not null check (char_length(need) between 1 and 500),
  check_with  text check (check_with is null or char_length(check_with) between 1 and 500),
  fix_with    text check (fix_with is null or fix_with ~ '^base:[a-z0-9-]{1,40}$'),
  blocks_all  boolean not null default false,
  blocks      text[] not null default '{}' check (cardinality(blocks) <= 200 and array_position(blocks, null) is null),
  who         text not null check (who in ('agent', 'check', 'person')),
  repos       text[] not null default '{}' check (
                cardinality(repos) <= 20 and array_position(repos, null) is null
                and (cardinality(repos) = 0 or array_to_string(repos, ',') ~ '^[a-z0-9_.-]+(,[a-z0-9_.-]+)*$')),
  card        jsonb check (card is null or jsonb_typeof(card) = 'object'),
  state       text check (state is null or state in ('ok', 'fixed', 'waits', 'ticked')),
  detail      text check (detail is null or char_length(detail) between 1 and 500),
  primary key (roadmap_id, position),
  constraint roadmap_prerequisites_row_key unique (roadmap_id, row_id),
  constraint roadmap_prerequisites_blocks_shape check (not blocks_all or cardinality(blocks) = 0),
  constraint roadmap_prerequisites_fix_shape check (fix_with is null or who = 'agent'),
  constraint roadmap_prerequisites_detail_shape check (detail is null or state = 'waits')
);

comment on table public.roadmap_prerequisites is
  'A roadmap''s prerequisites (PRD 1218), in its table''s order: one row each, written through roadmap_prerequisites_push(), read by the workspace''s members. Every push that carries them replaces them.';
comment on column public.roadmap_prerequisites.row_id is 'The row''s id in roadmap.md, such as p1.';
comment on column public.roadmap_prerequisites.category is 'local, access, permissions, github or services: where it holds.';
comment on column public.roadmap_prerequisites.check_with is 'How it is checked: a base check (base:docker) or a command that exits 0 when it holds; null when nothing can.';
comment on column public.roadmap_prerequisites.fix_with is 'The base fix the agent may run (base:install), on an agent row only; null otherwise.';
comment on column public.roadmap_prerequisites.blocks_all is 'True when it blocks every PRD of the roadmap; `blocks` is then empty.';
comment on column public.roadmap_prerequisites.blocks is 'The PRD row ids it blocks, when not all of them.';
comment on column public.roadmap_prerequisites.who is 'agent (checked and fixed by the agent), check (checked by the agent, fixed by a person) or person (ticked by a person).';
comment on column public.roadmap_prerequisites.repos is 'In a plan repository, the targets it concerns, by short name; empty otherwise.';
comment on column public.roadmap_prerequisites.card is 'Its author card: {why, command, whatItDoes, whoCanDoIt}, each a line or null; null when it has none.';
comment on column public.roadmap_prerequisites.state is 'What the last check found: ok, fixed, waits or ticked; null when no result names it.';
comment on column public.roadmap_prerequisites.detail is 'Why it waits, in one line; null unless it waits.';

alter table public.roadmaps
  add column prerequisites_machine text check (prerequisites_machine is null or char_length(prerequisites_machine) between 1 and 200),
  add column prerequisites_checked_at timestamptz,
  add constraint roadmaps_prerequisites_result_shape check ((prerequisites_machine is null) = (prerequisites_checked_at is null));

comment on column public.roadmaps.prerequisites_machine is 'The machine (its host name) the last prerequisites result was found on (PRD 1218); null until a push carries one.';
comment on column public.roadmaps.prerequisites_checked_at is 'When the last prerequisites result was found; null until a push carries one.';

-- ── The only writer ─────────────────────────────────────────────────────────────

-- The prerequisites of one push of the kit's `omni roadmap push`, sent after roadmap_push(). `p_body`:
--   {repo, number,
--    prerequisites: [{id, category, need, check?, fix?, blocks: 'all' | [row id], who, repos?,
--                     card?: {why, command, whatItDoes, whoCanDoIt}}],
--    result?: {machine, checkedAt, rows: [{id, state, detail?}]}}
-- Replaces the roadmap's prerequisites, each with the state its result row gives (a result row naming no
-- prerequisite is left out), and the roadmap's machine and time; a null result clears them.
-- Answers {roadmapId, prerequisites}: the roadmap and how many rows it now holds. Refused: 42501 signed
-- out or a repository no workspace of the caller owns; 22023 a malformed argument or a roadmap not
-- pushed yet.
create function public.roadmap_prerequisites_push(p_body jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  body      jsonb := coalesce(p_body, '{}'::jsonb);
  v_repo    text;
  v_result  jsonb;
  v_roadmap public.roadmaps;
  v_count   integer;
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
  if jsonb_typeof(body -> 'prerequisites') is distinct from 'array' then
    raise exception 'A push carries its prerequisites as a list.' using errcode = '22023';
  end if;
  if jsonb_array_length(body -> 'prerequisites') > 100 then
    raise exception 'A roadmap holds 100 prerequisites at most.' using errcode = '22023';
  end if;
  v_result := case when jsonb_typeof(body -> 'result') = 'object' then body -> 'result' end;
  if v_result is not null and jsonb_typeof(v_result -> 'rows') is distinct from 'array' then
    raise exception 'A prerequisites result carries its rows.' using errcode = '22023';
  end if;

  select * into pick from public.repo_workspace(caller, v_repo);
  if pick.workspace_id is null then
    raise exception '%', pick.refusal using errcode = '42501';
  end if;

  select * into v_roadmap from public.roadmaps r
   where r.workspace_id = pick.workspace_id and r.repo = v_repo and r.number = (body ->> 'number')::integer
   for update;
  if v_roadmap.id is null then
    raise exception 'Push the roadmap before its prerequisites.' using errcode = '22023';
  end if;

  delete from public.roadmap_prerequisites where roadmap_id = v_roadmap.id;
  insert into public.roadmap_prerequisites (roadmap_id, position, row_id, category, need, check_with, fix_with, blocks_all, blocks, who, repos, card, state, detail)
  select v_roadmap.id, e.ordinality::integer, e.value ->> 'id', e.value ->> 'category', btrim(e.value ->> 'need'),
         nullif(btrim(e.value ->> 'check'), ''), nullif(btrim(e.value ->> 'fix'), ''),
         jsonb_typeof(e.value -> 'blocks') = 'string' and e.value ->> 'blocks' = 'all',
         case when jsonb_typeof(e.value -> 'blocks') = 'array'
              then coalesce(array(select jsonb_array_elements_text(e.value -> 'blocks')), '{}') else '{}' end,
         e.value ->> 'who',
         coalesce(array(select lower(jsonb_array_elements_text(coalesce(e.value -> 'repos', '[]'::jsonb)))), '{}'),
         case when jsonb_typeof(e.value -> 'card') = 'object' then e.value -> 'card' end,
         found.value ->> 'state',
         case when found.value ->> 'state' = 'waits' then left(nullif(btrim(found.value ->> 'detail'), ''), 500) end
    from jsonb_array_elements(body -> 'prerequisites') with ordinality as e (value, ordinality)
    left join lateral (
      select r.value from jsonb_array_elements(coalesce(v_result -> 'rows', '[]'::jsonb)) as r (value)
       where r.value ->> 'id' = e.value ->> 'id' limit 1
    ) as found on true;
  get diagnostics v_count = row_count;

  update public.roadmaps
     set prerequisites_machine = nullif(btrim(v_result ->> 'machine'), ''),
         prerequisites_checked_at = (v_result ->> 'checkedAt')::timestamptz
   where id = v_roadmap.id;

  return jsonb_build_object('roadmapId', v_roadmap.id, 'prerequisites', v_count);
exception
  when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range
    or not_null_violation or check_violation or unique_violation or foreign_key_violation then
    raise exception 'A roadmap''s prerequisites are malformed: %', sqlerrm using errcode = '22023';
end;
$$;

revoke execute on function public.roadmap_prerequisites_push(jsonb) from public, anon;
grant execute on function public.roadmap_prerequisites_push(jsonb) to authenticated;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.roadmap_prerequisites enable row level security;

create policy "a member reads their workspace's roadmap prerequisites" on public.roadmap_prerequisites
  for select to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and public.is_member(r.workspace_id)));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the table: roadmap_prerequisites_push() does, as its owner.
revoke all on public.roadmap_prerequisites from public, anon, authenticated, service_role;
grant select on public.roadmap_prerequisites to authenticated;
grant select on public.roadmap_prerequisites to service_role;
