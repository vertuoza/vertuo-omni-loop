-- What a mission at `alone` keeps for a product roadmap (PRD omni-loop-21 s3, docs: the PRD's spec on its page, Solution 1, 2,
-- 4 and 5). It runs after 20270128092000_commander_notes.sql, and builds on 20270128091000_commander_messaged.sql (which last
-- set mission_events_kind_check and mission_job_role()), 20270127100000_omni_bug_team.sql (which last set
-- runner_jobs_mission_key_shape), 20270126100000_token_budget.sql (which last set mission_mandate_ok()),
-- 20270124130000_mission_committee.sql (mission_decisions) and 20270122093000_missions.sql (mission_scope_ok()).
--
-- It only adds: no column, row or table is dropped, and no row is rewritten.
--
-- - mission_scope_ok(): a scope's `prds` also take a product PRD's id (`omni-loop-15`) and its `roadmaps` a product roadmap's
--   id (`omni-loop-R3`), as kit/lib/ids.ts reads them: a key of lowercase parts each starting with a letter, 40 characters at
--   most, then its number (1 to 2147483647). A repository's numbers read as before; a number written as text (`"2803"`) is
--   still refused. Nothing else of it changes.
-- - mission_mandate_ok(): the mandate also takes `resumes`, how many times a step that ended without its result line is sent
--   again (a whole number, 0 to 10; absent, the kit reads 3). Nothing else of it changes.
-- - mission_branches: the mission's branch in each repository its scope touches, one per repository, written by the service
--   role (the supervisor) once it is cut: the mission, the repository (`owner/name`, lowercase, as missions.repo) and the
--   branch. Never changed, never deleted but with its mission. A member of the mission's workspace reads it.
-- - mission_decisions: the committee's outcome also takes `deferred`, an item the vote did not carry, settled meanwhile with
--   its option (A to D; the kit takes A, as built) and open for a person on the mission pull request. A carried decision may
--   now say why, each case of the escalation list it was on (`on the escalation list: …`); an escalated or deferred one
--   always does. Only an item's decision (`answer`) is deferred.
-- - mission_decide_item(): the only writer of an item's decision, the service role's alone, as mission_decide_approval() is of
--   an approval's. It records the item committee job's decision once (a replay answers the decision already kept); a
--   mission not at `alone` escalates whatever the App read.
-- - mission_events.kind takes `deferred`: the committee deferred an item, its option taken meanwhile, role pm, actor agent.
-- - runner_jobs.mission_key: a step of a run, a committee's job and a PM's job also take `:resume:<k>` (1 to 10), the step's
--   k-th fresh job after one that ended without its result line: unique, so a replay sends each once. The step's resume count
--   is the highest k its keys hold. mission_job_role() reads a resume as the step it resumes.
--
-- Laws kept: only a person merges into the default branch (N-PRODUCT-15): a mission branch is never the default branch, and
-- the App never writes one; a fleet's decision stays as recorded, a person's overturn added beside it (BR-PRODUCT-12,
-- BR-PRODUCT-146); nobody signed in writes a decision or a branch (BR-PRODUCT-94); a member reads their own workspace's
-- missions only (BR-PRODUCT-63); no membership, ask session, AI key or agent link is read or written (BR-PRODUCT-28, 29, 39,
-- 59, 64); no game ledger row is touched (N-PRODUCT-16). A decision is signed by role and `agent`, never in a person's name
-- (L-AIACT-1), and kept as long as its mission (L-GDPR-4).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/mission_alone.sql.
-- Rollback: once no row holds a product id in its scope, a `resumes` mandate, a mission branch, a deferred or carried-with-why
-- decision, an item's decision, a `deferred` event or a `:resume:` key, a follow-up migration drops mission_decide_item() and
-- mission_branches with its trigger function, puts mission_decisions' outcome check and mission_decisions_carried_has_no_why
-- of 20270124130000_mission_committee.sql back, and restores mission_scope_ok() of 20270122093000_missions.sql,
-- mission_mandate_ok() of 20270126100000_token_budget.sql, runner_jobs_mission_key_shape of 20270127100000_omni_bug_team.sql,
-- and mission_events_kind_check and mission_job_role() of 20270128091000_commander_messaged.sql.

-- ── The scope takes products ────────────────────────────────────────────────────

-- A product's id as kit/lib/ids.ts reads it: among the PRDs `<key>-<n>`, among the roadmaps `<key>-R<n>`; the key is
-- lowercase parts each starting with a letter, 40 characters at most, and the number 1 to 2147483647.
create or replace function public.mission_product_id_ok(p_id text, p_list text) returns boolean
language plpgsql immutable
set search_path = ''
as $$
declare
  parts text[];
begin
  parts := regexp_match(coalesce(p_id, ''),
    case p_list when 'roadmaps' then '^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-R([1-9][0-9]{0,9})$'
                else '^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-([1-9][0-9]{0,9})$' end);
  if parts is null then
    return false;
  end if;
  return char_length(parts[1]) <= 40 and parts[2]::bigint <= 2147483647;
end;
$$;

-- As 20270122093000_missions.sql: exactly {prds, roadmaps}, lists of distinct entries, 50 PRDs and 10 roadmaps at most, one of
-- either at least. An entry is a positive number, or a product's id: `<key>-<n>` among the PRDs, `<key>-R<n>` among the roadmaps.
create or replace function public.mission_scope_ok(p_scope jsonb) returns boolean
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
                   where not (case jsonb_typeof(e.value)
                                when 'number' then (e.value #>> '{}') ~ '^[1-9][0-9]{0,9}$'
                                                   and (case when (e.value #>> '{}') ~ '^[1-9][0-9]{0,9}$'
                                                             then (e.value #>> '{}')::bigint <= 2147483647 else false end)
                                when 'string' then public.mission_product_id_ok(e.value #>> '{}', list)
                                else false end))
       or (select count(distinct e.value) from jsonb_array_elements(p_scope -> list) e) <> jsonb_array_length(p_scope -> list) then
      return false;
    end if;
    total := total + jsonb_array_length(p_scope -> list);
  end loop;
  return total >= 1;
end;
$$;

comment on column public.missions.scope is
  'The PRDs and roadmaps it delivers: {prds: [n | <key>-<n>], roadmaps: [n | <key>-R<n>]}, a repository''s numbers or a product''s ids (PRD omni-loop-21), one at least; empty for an omni-bugs mission.';

-- ── The mandate takes resumes ───────────────────────────────────────────────────

-- As 20270126100000_token_budget.sql, the optional `resumes` added: a whole number from 0 to 10.
create or replace function public.mission_mandate_ok(p_mandate jsonb) returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  -- Never null, which a check reads as passing: an empty object, or none, is refused.
  if p_mandate is null or jsonb_typeof(p_mandate) <> 'object' or not (p_mandate ? 'parallel')
     or exists (select 1 from jsonb_object_keys(p_mandate) k where k not in ('parallel', 'level', 'hardToRevert', 'ownPrds', 'resumes', 'tokens')) then
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
  if p_mandate ? 'resumes' and not (jsonb_typeof(p_mandate -> 'resumes') = 'number'
                                    and (p_mandate ->> 'resumes') in ('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10')) then
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
  'How a mission runs: {parallel: 1 to 4, level: with-you | own-branch | alone, hardToRevert: 0 to 1, ownPrds: 0 to 10, resumes: 0 to 10, tokens: 1 to 10^9}; only parallel is required, a mission without a level reads as with-you, one without resumes resumes a step 3 times (PRD omni-loop-21), one without tokens has no token budget (PRD 3040). It never merges into the default branch and never answers for a person, whatever the mandate.';

revoke execute on function public.mission_product_id_ok(text, text) from public, anon;
grant execute on function public.mission_product_id_ok(text, text) to authenticated, service_role;

-- ── A mission's branch in each repository ───────────────────────────────────────

create table if not exists public.mission_branches (
  mission_id uuid not null references public.missions (id) on delete cascade,
  repo       text not null constraint mission_branches_repo_shape check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' and char_length(repo) <= 200),
  branch     text not null constraint mission_branches_branch_shape
               check (char_length(branch) between 1 and 200 and branch ~ '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$' and branch !~ '\.\.'),
  cut_at     timestamptz not null default clock_timestamp(),
  primary key (mission_id, repo)
);

comment on table public.mission_branches is
  'PRD omni-loop-21: a mission''s branch in each repository its scope touches, one per repository, kept once it is cut: written by the service role (the supervisor), read by the workspace''s members, kept as long as its mission. Never the default branch, which the App never writes (N-PRODUCT-15).';
comment on column public.mission_branches.repo is 'The repository, owner/name in lowercase, as missions.repo.';
comment on column public.mission_branches.branch is 'The mission branch cut there from the default branch, as branches.mission names it (mission/<n>-<topic>).';

create or replace function public.mission_branches_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'A mission branch is never changed or deleted: it goes with its mission.' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists mission_branches_keep on public.mission_branches;
create trigger mission_branches_keep
  before update or delete on public.mission_branches
  for each row execute function public.mission_branches_keep();

alter table public.mission_branches enable row level security;

drop policy if exists "a member reads their workspace's mission branches" on public.mission_branches;
create policy "a member reads their workspace's mission branches" on public.mission_branches
  for select to authenticated
  using (mission_id in (select m.id from public.missions m where m.workspace_id in (select public.my_workspaces())));

revoke all on public.mission_branches from public, anon, authenticated, service_role;
grant select on public.mission_branches to authenticated, service_role;
grant insert on public.mission_branches to service_role;
revoke execute on function public.mission_branches_keep() from public, anon, authenticated;

-- ── The committee defers ────────────────────────────────────────────────────────

alter table public.mission_decisions drop constraint if exists mission_decisions_outcome_check;
alter table public.mission_decisions add constraint mission_decisions_outcome_check check (outcome in ('carried', 'deferred', 'escalated'));

-- A carried decision may say why (each case of the escalation list it was on); an escalated one always does; a deferred one
-- always does, is an item's, and names the option taken meanwhile.
alter table public.mission_decisions drop constraint if exists mission_decisions_carried_has_no_why;
alter table public.mission_decisions drop constraint if exists mission_decisions_why_by_outcome;
alter table public.mission_decisions add constraint mission_decisions_why_by_outcome check (
  (outcome <> 'escalated' or jsonb_array_length(why) > 0)
  and (outcome <> 'deferred' or (jsonb_array_length(why) > 0 and kind = 'answer' and option is not null and option ~ '^[A-D]$')));

comment on column public.mission_decisions.outcome is
  'carried (every sitting member answered yes), deferred (PRD omni-loop-21: an item the vote did not carry, settled meanwhile with its option and open for a person on the mission pull request) or escalated (it went to a person).';
comment on column public.mission_decisions.why is
  'Why, one line each: a line of the escalation list it was on (`on the escalation list: …`, PRD omni-loop-21), or a verdict that was not yes. Never empty once escalated or deferred.';
comment on column public.mission_decisions.option is
  'The option a deferred item is settled with meanwhile, A to D (the kit takes A, as built); null for any other decision.';

-- The item committee job p_job's decision on item p_item of PRD p_prd of mission p_mission, as the App read it: the verdicts
-- ({role, answer, sentence}), `p_outcome` the App's own decision (carried, deferred or escalated), `p_why` its reasons and
-- `p_option` the option a deferred item takes (none for any other). Records it once; a mission not at `alone` escalates it, the option dropped.
-- Answers {decision, outcome, why, option}. 22023 a malformed value, its field first in the message and in `hint`; P0002 no
-- such mission, or no item committee job of it.
create or replace function public.mission_decide_item(p_mission uuid, p_prd integer, p_job uuid, p_item text, p_verdicts jsonb, p_outcome text, p_why jsonb, p_option text default null)
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
  prefix  text;
  outcome text := p_outcome;
  chosen  text := p_option;
begin
  select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  if found then
    return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'option', kept.option);
  end if;
  select x.* into m from public.missions x where x.id = p_mission for share;
  if not found then
    raise exception 'Mission: no mission %.', p_mission using errcode = 'P0002', hint = 'mission';
  end if;
  if char_length(item) not between 1 and 200 then
    raise exception 'Item: its id, 1 to 200 characters.' using errcode = '22023', hint = 'item';
  end if;
  prefix := format('/omni:committee %s --item %s', p_prd, item);
  if not exists (select 1 from public.runner_jobs j
                  where j.id = p_job and j.mission_id = m.id and j.mission_key is null
                    and (j.line = prefix or left(j.line, char_length(prefix) + 1) = prefix || ' ')) then
    raise exception 'Job: % is no committee job of item % of PRD % in this mission.', p_job, item, p_prd using errcode = 'P0002', hint = 'job';
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

  insert into public.mission_decisions (mission_id, prd, kind, item, job_id, verdicts, why, outcome, option)
  values (m.id, p_prd, 'answer', item, p_job, p_verdicts, why, outcome, chosen)
  on conflict (job_id) do nothing
  returning * into kept;
  if kept.id is null then
    select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  end if;
  return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'option', kept.option);
end;
$$;

revoke execute on function public.mission_decide_item(uuid, integer, uuid, text, jsonb, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.mission_decide_item(uuid, integer, uuid, text, jsonb, text, jsonb, text) to service_role;

-- ── The event a deferred item records ───────────────────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written',
  'repair-started', 'retro', 'repair-ended', 'bug-reported', 'checked', 'budget-stop', 'budget-answer',
  'stuck', 'stuck-answer', 'milestone-retro', 'item-proposed', 'item-answered',
  'bug-taken', 'bug-asked', 'bug-fixed', 'messaged', 'deferred'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent), not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd), repair-started, retro, repair-ended and bug-reported (PRD 2980: a repair was sent, its retro named the cause, it ended, or the App filed an Omni Loop bug report; actor agent, each one sentence and one link, naming its fingerprint''s first 8 characters), checked (PRD 3001: a verdict of QA, role qa, actor agent, its round and its bugs'' issues in its sentence, linking its comment), budget-stop and budget-answer (PRD 3040: the supervisor recorded a budget stop, role supervisor, actor agent, naming whose cap and its value; a person answered it, actor their login), stuck, stuck-answer, milestone-retro, item-proposed and item-answered (PRD 3065: the supervisor found the mission stuck, sent its stuck repair or paused it by stuck, role supervisor, actor agent; a person resumed or stopped a mission paused by stuck, actor their login; a milestone retro was recorded, or skipped saying why, role supervisor, actor agent; a retro or a repair proposed a change to a rule, a law or a form, role supervisor, actor agent, naming its target; a person adopted or declined it, actor their login), bug-taken, bug-asked and bug-fixed (PRD 3088: the bug team sent a bug-fix job for an Omni Loop bug, set one aside on its question, or a bug a mission waited on was released fixed; role supervisor, actor agent, each one sentence naming the issue and its count or version, and one link, never a workspace, repository or login), messaged (PRD 3107: a member sent a message to the fleet while the mission ran, role supervisor, actor the member''s login, a fixed sentence and message_id, never the message''s words), or deferred (PRD omni-loop-21: the fleet''s committee deferred an item, the option it took meanwhile in its sentence, open for a person on the mission pull request; role pm, actor agent).';

-- ── A step resumed ──────────────────────────────────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:[1-9][0-9]*:(run:[1-9][0-9]*(:review:[12]|:fix:1|:qa:[12]|:qa-fix:1:[1-5])?(:resume:([1-9]|10))?|approve:[1-9][0-9]*(:resume:([1-9]|10))?|repair:[1-9][0-9]*)|pm:[1-9][0-9]*(:resume:([1-9]|10))?|stuck:[1-9][0-9]*|retro:([1-9][0-9]*|mission)|bug:[1-9][0-9]*:run:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'The step of its mission a job is (PRD 2842 and on): `mission:<id>:prd:<n>:run:<k>` and its review, fix, QA and QA-fix steps, `…:approve:<k>` a committee''s, `…:repair:<k>` a repair''s, `mission:<id>:pm:<k>` the PM''s, `…:stuck:<k>`, `…:retro:<milestone>` and `…:bug:<issue>:run:<k>`; a step of a run, a committee''s or a PM''s job also takes `:resume:<k>` (1 to 10), its k-th fresh job after one that ended without its result line (PRD omni-loop-21). Unique: a replay sends each once.';

-- As 20270128091000_commander_messaged.sql, a resume (`…:resume:<k>`) read as the step it resumes. Nothing else changes.
create or replace function public.mission_job_role(p_key text) returns text
language sql immutable
set search_path = ''
as $$
  select case
    when s.key ~ ':review:[12]$' then 'reviewer'
    when s.key ~ ':qa:[12]$' then 'qa'
    when s.key ~ ':approve:[0-9]+$' then 'architect'
    when s.key ~ ':pm:[0-9]+$' then 'pm'
    when s.key ~ ':run:[0-9]+$' or s.key ~ ':fix:1$' or s.key ~ ':qa-fix:1:[1-5]$' then 'engineer'
    else 'supervisor'
  end
  from (select regexp_replace(p_key, ':resume:([1-9]|10)$', '') as key) s
$$;
