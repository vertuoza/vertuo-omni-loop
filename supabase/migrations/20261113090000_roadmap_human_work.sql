-- The human work a roadmap waits on (PRD 1217, s2, docs: .omni-loop/delivery/inbox/1217-roadmap-human-work/spec.md):
-- every question, outbox item, park and clarification only a person can settle across a roadmap's PRDs,
-- told to the app by the kit's `omni roadmap push` (its `humanWork`) through POST /api/roadmaps, each with
-- one of four kinds, so the roadmap's page lists what it waits on, by kind, and keeps what it took.
--
-- - roadmap_human_work: one row per roadmap and key (`question:Q5`, `outbox:1213/s2-01`, `park:1213`,
--   `clarification:1213`): its PRD, its repository, where it came from, its text, the act a person must
--   do, where it is answered, its kind and who chose it (`rule`: the kit's rules; `jev`: Jev, from s3),
--   open or done since `done_at`, and when it was first seen.
-- - roadmap_push(), redefined: as 20261110090000_roadmaps.sql's, and, when the push carries
--   `humanWork`, a new key stored with its rule kind, a stored key keeping its kind and open again, a
--   key missing from the push done at that push. A push without the field, from a kit before PRD 1217,
--   changes no stored entry.
--
-- No path, prompt or transcript is stored: short lines, links, and the act a person must do. A member of
-- the roadmap's workspace reads its rows; anyone else reads nothing, and nobody signed in writes them.
--
-- Rollback: a follow-up migration restores roadmap_push() of 20261110090000_roadmaps.sql, then drops
-- roadmap_human_work. Nothing else writes it; the roadmap page reads it (s4).

create table public.roadmap_human_work (
  roadmap_id    uuid not null references public.roadmaps (id) on delete cascade,
  key           text not null check (key ~ '^(question|outbox|park|clarification):[A-Za-z0-9._/-]{1,100}$'),
  prd           integer check (prd is null or prd > 0),
  repo          text not null check (repo ~ '^[a-z0-9_.-]+(/[a-z0-9_.-]+)?$' and char_length(repo) <= 200),
  source        text not null check (source in ('question', 'outbox', 'park', 'clarification')),
  text          text not null check (char_length(text) between 1 and 1000),
  act           text check (act is null or char_length(act) between 1 and 4000),
  url           text check (url is null or (url ~ '^https?://' and char_length(url) <= 500)),
  kind          text not null check (kind in ('business', 'development', 'dev-ops', 'delivery-ops')),
  kind_by       text not null check (kind_by in ('jev', 'rule')),
  state         text not null default 'open' check (state in ('open', 'done')),
  first_seen_at timestamptz not null default now(),
  done_at       timestamptz,
  primary key (roadmap_id, key),
  constraint roadmap_human_work_source_shape check (split_part(key, ':', 1) = source),
  constraint roadmap_human_work_done_shape check ((state = 'done') = (done_at is not null))
);

comment on table public.roadmap_human_work is
  'The human work a roadmap waits on (PRD 1217): one row per roadmap and key, written through roadmap_push(), read by the workspace''s members. Done rows are kept.';
comment on column public.roadmap_human_work.key is 'source:what, stable across pushes: question:<id>, outbox:<prd>/<item id>, park:<prd>, clarification:<prd>.';
comment on column public.roadmap_human_work.repo is 'The repository the work is in: the roadmap''s own (owner/name) or a target''s short name, in lower case.';
comment on column public.roadmap_human_work.act is 'What a person must do, word for word (a human-action item''s), or a recommendation; null when none.';
comment on column public.roadmap_human_work.url is 'Where the work is answered: an issue, an issue comment or a feature PR.';
comment on column public.roadmap_human_work.kind is 'business, development, dev-ops or delivery-ops; set when the key is first stored, never changed by a later push.';
comment on column public.roadmap_human_work.kind_by is 'Who chose the kind: rule (the kit''s rules) or jev (the hitl-category decision).';
comment on column public.roadmap_human_work.done_at is 'The push that no longer carried the key; null while open.';

-- ── The only writer ─────────────────────────────────────────────────────────────

-- One push of the kit's `omni roadmap push`. `p_body`:
--   {repo, number, title, milestone, product?, target?, source?, questions, document,
--    prds: [{id, prd, title, repos, blockers, wave, state, waitsOn?, waitsOnUrl?, startedAt?, endedAt?}],
--    humanWork?: [{key, prd, repo, source, text, act, url, ruleKind}]}
-- Answers {roadmapId, created, product, unknownProduct}: `product` the name of the product it was filed
-- under, `unknownProduct` the name sent that matched none of the workspace's. Refused: 42501 signed out
-- or a repository no workspace of the caller owns; 22023 a malformed argument.
create or replace function public.roadmap_push(p_body jsonb)
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
  -- The human work: absent or null from a kit before it, else a list of at most 500 distinct keys.
  if jsonb_typeof(body -> 'humanWork') not in ('array', 'null') then
    raise exception 'A roadmap carries its human work as a list.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'humanWork') = 'array' then
    if jsonb_array_length(body -> 'humanWork') > 500 then
      raise exception 'A roadmap holds 500 pieces of human work at most.' using errcode = '22023';
    end if;
    if (select count(distinct e.value ->> 'key') from jsonb_array_elements(body -> 'humanWork') as e (value))
       <> jsonb_array_length(body -> 'humanWork') then
      raise exception 'A key of human work is used twice, or missing.' using errcode = '22023';
    end if;
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

  -- Its human work, when the push carries the list: a new key stored with the kind the kit's rules gave
  -- it; a stored key keeps its kind (and who chose it), takes the push's text, act and link, and is open
  -- again; a key the push no longer carries is done, at this push. A done key stays done until it is back.
  if jsonb_typeof(body -> 'humanWork') = 'array' then
    insert into public.roadmap_human_work (roadmap_id, key, prd, repo, source, text, act, url, kind, kind_by)
    select v_roadmap.id, e.value ->> 'key', (e.value ->> 'prd')::integer, lower(btrim(e.value ->> 'repo')), e.value ->> 'source',
           btrim(e.value ->> 'text'), nullif(btrim(e.value ->> 'act'), ''), e.value ->> 'url', e.value ->> 'ruleKind', 'rule'
      from jsonb_array_elements(body -> 'humanWork') as e (value)
    on conflict (roadmap_id, key) do update
       set prd = excluded.prd, repo = excluded.repo, source = excluded.source, text = excluded.text, act = excluded.act,
           url = excluded.url, state = 'open', done_at = null;
    update public.roadmap_human_work h
       set state = 'done', done_at = now()
     where h.roadmap_id = v_roadmap.id and h.state = 'open'
       and not exists (select 1 from jsonb_array_elements(body -> 'humanWork') as e (value) where e.value ->> 'key' = h.key);
  end if;

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

alter table public.roadmap_human_work enable row level security;

create policy "a member reads their workspace's roadmap human work" on public.roadmap_human_work
  for select to authenticated
  using (exists (select 1 from public.roadmaps r where r.id = roadmap_id and public.is_member(r.workspace_id)));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the table: roadmap_push() does, as its owner.
revoke all on public.roadmap_human_work from public, anon, authenticated, service_role;
grant select on public.roadmap_human_work to authenticated;
grant select on public.roadmap_human_work to service_role;
