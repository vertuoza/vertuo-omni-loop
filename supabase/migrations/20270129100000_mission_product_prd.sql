-- A mission stores a product PRD (PRD omni-loop-21 s3b, outbox item s3-03; docs: the PRD's spec on its page, Solution 1). It runs
-- after 20270129090000_mission_alone_store.sql, which last set runner_jobs_mission_key_shape and mission_decide_item(), and builds
-- on 20270126110000_mission_retros.sql (which last set mission_repairs_prd, mission_repairs_keep() and runner_claim()),
-- 20270124130000_mission_committee.sql (mission_decisions) and 20270122093000_missions.sql (mission_events).
--
-- It only adds: no column, row or table is dropped, and no row is rewritten.
--
-- - mission_events, mission_decisions and mission_repairs: each gains `product_prd`, a product PRD's id (`omni-loop-15`, as
--   mission_product_id_ok() reads it), written instead of the integer `prd` for a product's PRD, never beside it; and `prd_id`,
--   the PRD as text whichever it is (`2896` or `omni-loop-15`), generated from the two, so the rows already there read their
--   number as text without being written again. A PRD's join is its `prd-joined` event, so joins gain it too.
-- - mission_decisions.prd takes null, for a product's PRD: a decision names exactly one PRD, its number or its product id.
-- - mission_repairs_prd: a repair names its PRD, a number or a product id, unless it is a stuck one. mission_repairs_keep() also
--   keeps its product id unchanged.
-- - runner_jobs.mission_key: a step of a run, a committee's job and a repair's take a product PRD's id where they took a
--   number (`mission:<id>:prd:omni-loop-15:run:1`). runner_claim() still claims a product PRD's repair first in line.
-- - mission_decide_item(p_mission, p_product_prd, …): an item's decision on a product PRD, read as mission_decide_item() of
--   20270129090000_mission_alone_store.sql reads one on a number; both are now one body, mission_decide_item_of().
--
-- Laws kept: a fleet's decision stays as recorded, never rewritten (BR-PRODUCT-12): the text id is generated, so no event, decision
-- or repair is updated; nobody signed in writes a decision (BR-PRODUCT-94); a member reads their own workspace's missions only
-- (BR-PRODUCT-63); no membership, ask session, AI key or agent link is read or written (BR-PRODUCT-28, 29, 39, 59, 64); no game
-- ledger row is touched (N-PRODUCT-16).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/mission_product_prd.sql.
-- Rollback: once no row holds a product id (no `product_prd`, no key naming one), a follow-up migration drops the three
-- `prd_id` and `product_prd` columns with their checks, mission_decide_item(uuid, text, …) and mission_decide_item_of(), sets
-- mission_decisions.prd not null again, and restores mission_decide_item() and runner_jobs_mission_key_shape of
-- 20270129090000_mission_alone_store.sql, and mission_repairs_prd, mission_repairs_keep() and runner_claim() of
-- 20270126110000_mission_retros.sql.

-- ── The three tables take a product's PRD ───────────────────────────────────────

alter table public.mission_events add column if not exists product_prd text;
alter table public.mission_decisions add column if not exists product_prd text;
alter table public.mission_repairs add column if not exists product_prd text;

alter table public.mission_events drop constraint if exists mission_events_product_prd;
alter table public.mission_events add constraint mission_events_product_prd
  check (product_prd is null or (prd is null and public.mission_product_id_ok(product_prd, 'prds')));
alter table public.mission_decisions drop constraint if exists mission_decisions_product_prd;
alter table public.mission_decisions add constraint mission_decisions_product_prd
  check (product_prd is null or public.mission_product_id_ok(product_prd, 'prds'));
alter table public.mission_repairs drop constraint if exists mission_repairs_product_prd;
alter table public.mission_repairs add constraint mission_repairs_product_prd
  check (product_prd is null or (prd is null and public.mission_product_id_ok(product_prd, 'prds')));

-- A decision names exactly one PRD: its number, or its product's id.
alter table public.mission_decisions alter column prd drop not null;
alter table public.mission_decisions drop constraint if exists mission_decisions_one_prd;
alter table public.mission_decisions add constraint mission_decisions_one_prd check (num_nonnulls(prd, product_prd) = 1);

-- A repair names its PRD unless it is a stuck one, as 20270126110000_mission_retros.sql, a product's id taken for the number.
alter table public.mission_repairs drop constraint if exists mission_repairs_prd;
alter table public.mission_repairs add constraint mission_repairs_prd check (prd is not null or product_prd is not null or trigger = 'stuck');

-- The PRD as text, whichever it is: generated, so the rows already there read their number without being written again.
alter table public.mission_events add column if not exists prd_id text generated always as (coalesce(product_prd, prd::text)) stored;
alter table public.mission_decisions add column if not exists prd_id text generated always as (coalesce(product_prd, prd::text)) stored;
alter table public.mission_repairs add column if not exists prd_id text generated always as (coalesce(product_prd, prd::text)) stored;

comment on column public.mission_events.product_prd is
  'PRD omni-loop-21: the product PRD it is about (`<key>-<n>`), in place of prd, which is then null; null for a repository''s PRD or none.';
comment on column public.mission_events.prd_id is
  'PRD omni-loop-21: the PRD it is about as text, `2896` or `omni-loop-15`, generated from prd and product_prd; null when none.';
comment on column public.mission_decisions.product_prd is
  'PRD omni-loop-21: the product PRD decided on (`<key>-<n>`), in place of prd, which is then null; exactly one of the two is set.';
comment on column public.mission_decisions.prd_id is
  'PRD omni-loop-21: the PRD decided on as text, `2896` or `omni-loop-15`, generated from prd and product_prd.';
comment on column public.mission_repairs.product_prd is
  'PRD omni-loop-21: the product PRD whose step failed (`<key>-<n>`), in place of prd, which is then null.';
comment on column public.mission_repairs.prd_id is
  'PRD omni-loop-21: the PRD whose step failed as text, `2896` or `omni-loop-15`, generated from prd and product_prd; null for a stuck repair.';

-- As 20270126110000_mission_retros.sql, the product PRD among what never changes.
create or replace function public.mission_repairs_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.mission_id, new.prd, new.product_prd, new.fingerprint, new.round, new.number, new.failed_job_id, new.started_at, new.trigger)
     is distinct from (old.id, old.mission_id, old.prd, old.product_prd, old.fingerprint, old.round, old.number, old.failed_job_id, old.started_at, old.trigger) then
    raise exception 'A repair''s mission, PRD, cause, round, number, failed job, start and trigger never change.' using errcode = '42501';
  end if;
  if old.outcome is not null then
    raise exception 'A repair that ended never changes: it ended %.', old.outcome using errcode = '42501';
  end if;
  new.ended_at := case when new.outcome is null then null else now() end;
  return new;
end;
$$;

revoke execute on function public.mission_repairs_keep() from public, anon, authenticated;

-- ── A job's key names a product's PRD ───────────────────────────────────────────

-- As 20270129090000_mission_alone_store.sql, `prd:` followed by a number or a product PRD's id. Nothing else changes.
alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:([1-9][0-9]*|[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*-[1-9][0-9]{0,9}):(run:[1-9][0-9]*(:review:[12]|:fix:1|:qa:[12]|:qa-fix:1:[1-5])?(:resume:([1-9]|10))?|approve:[1-9][0-9]*(:resume:([1-9]|10))?|repair:[1-9][0-9]*)|pm:[1-9][0-9]*(:resume:([1-9]|10))?|stuck:[1-9][0-9]*|retro:([1-9][0-9]*|mission)|bug:[1-9][0-9]*:run:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'The step of its mission a job is (PRD 2842 and on): `mission:<id>:prd:<n>:run:<k>` and its review, fix, QA and QA-fix steps, `…:approve:<k>` a committee''s, `…:repair:<k>` a repair''s, `mission:<id>:pm:<k>` the PM''s, `…:stuck:<k>` a stuck repair''s, `…:retro:<milestone>` a milestone retro''s, `…:bug:<issue>:run:<k>` a bug-fix job''s; a step''s, a committee''s or a PM''s resume ends `:resume:<k>` (PRD omni-loop-21), and `<n>` is a repository PRD''s number or a product PRD''s id (`omni-loop-15`, PRD omni-loop-21 s3b). Unique: a replay sends each once.';

-- runner_claim() of 20270126110000_mission_retros.sql, its order alone changed: a product PRD's repair is claimed first in line,
-- as a repository PRD's is.
create or replace function public.runner_claim(p_runner uuid, p_registered_at timestamptz default null) returns setof public.runner_jobs
language plpgsql
set search_path = ''
as $$
declare
  r    public.runners;
  busy integer;
begin
  select * into r from public.runners where id = p_runner for update;
  if r.id is null or not r.github_app or (p_registered_at is not null and r.registered_at <> p_registered_at) then
    return;
  end if;
  select count(*) into busy from public.runner_jobs j where j.runner_id = r.id and j.status in ('claimed', 'running');
  if busy >= r.slots then
    return;
  end if;
  -- A runner whose fresh health reports every account out until a time to come is handed nothing: it would fail the job.
  -- Each step is its own test, so no cast runs on a value that does not read as a time.
  if jsonb_typeof(r.health -> 'accounts') = 'array' and pg_catalog.pg_input_is_valid(r.health ->> 'at', 'timestamptz') then
    if (r.health ->> 'at')::timestamptz > now() - interval '2 minutes' and jsonb_array_length(r.health -> 'accounts') > 0
       and not exists (
         select 1 from jsonb_array_elements(r.health -> 'accounts') a
          where case when a ->> 'state' = 'out' and pg_catalog.pg_input_is_valid(a ->> 'resetsAt', 'timestamptz')
                     then (a ->> 'resetsAt')::timestamptz <= now() else true end) then
      return;
    end if;
  end if;
  return query
  update public.runner_jobs j
     set status = 'claimed', runner_id = r.id, claimed_at = now()
   where j.id = (
     select q.id from public.runner_jobs q
      where q.workspace_id = r.workspace_id
        and q.status = 'queued'
        and not q.cancel_requested
        and (q.resume_after is null or q.resume_after <= now())
        and q.repo = any (r.repos)
        and (q.to_runner = r.id
             or (q.to_runner is null and q.to_fleet is not null and q.to_fleet = r.fleet)
             or (q.to_runner is null and q.to_fleet is null and r.fleet is null))
        -- A resume whose chain's newest local save is kept by another runner, online and able to take it, waits for it.
        and not exists (
          select 1
            from (with recursive chain (id, depth) as (
                    select q.resumes, 1 where q.resumes is not null
                    union all
                    select b.resumes, chain.depth + 1 from chain join public.runner_jobs b on b.id = chain.id
                     where b.resumes is not null and chain.depth < 20)
                  select c.runner_id
                    from chain
                    join public.runner_checkpoints c on c.job_id = chain.id
                   where c.kind = 'local' and c.deleted_at is null and c.keep_until > now()
                   order by chain.depth, c.updated_at desc
                   limit 1) keeper
            join public.runners k on k.id = keeper.runner_id
           where k.id <> r.id
             and k.workspace_id = q.workspace_id
             and k.github_app
             and k.last_seen_at > now() - interval '90 seconds'
             and q.repo = any (k.repos)
             and (q.to_runner = k.id
                  or (q.to_runner is null and q.to_fleet is not null and q.to_fleet = k.fleet)
                  or (q.to_runner is null and q.to_fleet is null and k.fleet is null)))
      -- Recovery first: every resume and every mission's repair, a PRD's (a number or a product's id) or a stuck one, before any
      -- fresh job, a resume by when the first job of its chain was queued, a repair by its own queued time.
      order by q.resumes is null and (q.mission_key is null or q.mission_key !~ ':(prd:[^:]+:repair|stuck):[1-9][0-9]*$'),
               coalesce((with recursive chain (id, resumes, queued_at, depth) as (
                  select b.id, b.resumes, b.queued_at, 1 from public.runner_jobs b where b.id = q.resumes
                  union all
                  select b.id, b.resumes, b.queued_at, chain.depth + 1 from chain join public.runner_jobs b on b.id = chain.resumes
                   where chain.depth < 20)
                select min(chain.queued_at) from chain), q.queued_at),
               q.queued_at, q.id
      limit 1
      for update skip locked)
     and j.status = 'queued'
  returning j.*;
end;
$$;

revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.runner_claim(uuid, timestamptz) to service_role;

-- ── An item's decision on a product's PRD ───────────────────────────────────────

-- mission_decide_item() of 20270129090000_mission_alone_store.sql, as one body for either PRD: `p_prd` a repository PRD's number
-- or `p_product_prd` a product PRD's id, exactly one of them. Its line names the PRD either way (`/omni:committee omni-loop-15
-- --item …`). Answers {decision, outcome, why, option}; 22023 a malformed value, its field first in the message and in `hint`;
-- P0002 no such mission, or no item committee job of it.
create or replace function public.mission_decide_item_of(p_mission uuid, p_prd integer, p_product_prd text, p_job uuid, p_item text,
                                                         p_verdicts jsonb, p_outcome text, p_why jsonb, p_option text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m       public.missions%rowtype;
  kept    public.mission_decisions%rowtype;
  why     jsonb := coalesce(p_why, '[]'::jsonb);
  item    text := btrim(coalesce(p_item, ''));
  prd     text := coalesce(p_product_prd, p_prd::text);
  prefix  text;
  outcome text := p_outcome;
  chosen  text := p_option;
begin
  select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  if found then
    return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'option', kept.option);
  end if;
  if num_nonnulls(p_prd, p_product_prd) <> 1
     or (p_product_prd is not null and not public.mission_product_id_ok(p_product_prd, 'prds'))
     or (p_prd is not null and p_prd < 1) then
    raise exception 'PRD: a repository PRD''s number or a product PRD''s id, one of them.' using errcode = '22023', hint = 'prd';
  end if;
  select x.* into m from public.missions x where x.id = p_mission for share;
  if not found then
    raise exception 'Mission: no mission %.', p_mission using errcode = 'P0002', hint = 'mission';
  end if;
  if char_length(item) not between 1 and 200 then
    raise exception 'Item: its id, 1 to 200 characters.' using errcode = '22023', hint = 'item';
  end if;
  prefix := format('/omni:committee %s --item %s', prd, item);
  if not exists (select 1 from public.runner_jobs j
                  where j.id = p_job and j.mission_id = m.id and j.mission_key is null
                    and (j.line = prefix or left(j.line, char_length(prefix) + 1) = prefix || ' ')) then
    raise exception 'Job: % is no committee job of item % of PRD % in this mission.', p_job, item, prd using errcode = 'P0002', hint = 'job';
  end if;
  if outcome is null or outcome not in ('carried', 'deferred', 'escalated') then
    raise exception 'Outcome: carried, deferred or escalated.' using errcode = '22023', hint = 'outcome';
  end if;
  if not public.mission_reasons_ok(why) or (outcome <> 'carried' and jsonb_array_length(why) = 0) then
    raise exception 'Why: up to twelve reasons, one at least when deferred or escalated.' using errcode = '22023', hint = 'why';
  end if;
  if not public.mission_verdicts_ok(coalesce(p_verdicts, 'null'::jsonb)) then
    raise exception 'Verdicts: at most three, one per member, each {role, answer, sentence}.' using errcode = '22023', hint = 'verdicts';
  end if;
  if outcome = 'deferred' then
    if chosen is null or chosen !~ '^[A-D]$' then
      raise exception 'Option: A to D, the one a deferred item takes meanwhile.' using errcode = '22023', hint = 'option';
    end if;
  else
    chosen := null;
  end if;

  -- The fleet decides an item at `alone` only: anywhere else, a person answers it.
  if outcome <> 'escalated' and coalesce(m.mandate ->> 'level', 'with-you') <> 'alone' then
    outcome := 'escalated';
    chosen := null;
    why := why || to_jsonb('the mission is not at alone: a person answers its items'::text);
  end if;

  insert into public.mission_decisions (mission_id, prd, product_prd, kind, item, job_id, verdicts, why, outcome, option)
  values (m.id, p_prd, p_product_prd, 'answer', item, p_job, p_verdicts, why, outcome, chosen)
  on conflict (job_id) do nothing
  returning * into kept;
  if kept.id is null then
    select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  end if;
  return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'option', kept.option);
end;
$$;

-- An item's decision on a repository PRD, as 20270129090000_mission_alone_store.sql: its arguments and answers unchanged.
create or replace function public.mission_decide_item(p_mission uuid, p_prd integer, p_job uuid, p_item text, p_verdicts jsonb, p_outcome text, p_why jsonb, p_option text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.mission_decide_item_of(p_mission, p_prd, null, p_job, p_item, p_verdicts, p_outcome, p_why, p_option)
$$;

-- An item's decision on a product PRD (`omni-loop-15`): the same, named by its id.
create or replace function public.mission_decide_item(p_mission uuid, p_product_prd text, p_job uuid, p_item text, p_verdicts jsonb, p_outcome text, p_why jsonb, p_option text default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.mission_decide_item_of(p_mission, null, p_product_prd, p_job, p_item, p_verdicts, p_outcome, p_why, p_option)
$$;

revoke execute on function public.mission_decide_item_of(uuid, integer, text, uuid, text, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.mission_decide_item(uuid, integer, uuid, text, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.mission_decide_item(uuid, text, uuid, text, jsonb, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.mission_decide_item_of(uuid, integer, text, uuid, text, jsonb, text, jsonb, text) to service_role;
grant execute on function public.mission_decide_item(uuid, integer, uuid, text, jsonb, text, jsonb, text) to service_role;
grant execute on function public.mission_decide_item(uuid, text, uuid, text, jsonb, text, jsonb, text) to service_role;
