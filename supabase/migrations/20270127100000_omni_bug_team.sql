-- The Omni Loop bug team (PRD 3088 s2, docs: .omni-loop/delivery/inbox/3088-omni-bug-team/spec.md, sections 1, 2 and 4).
-- It runs after 20270126110000_mission_retros.sql, which last set a mission key's shape and the kinds of a mission event,
-- 20270125140000_mission_repairs.sql, which made omni_bug_reports, and 20270122093000_missions.sql, which made
-- mission_scope_ok() and mission_push().
--
-- - missions.kind: `prds`, a mission that delivers a scope of PRDs and roadmaps (PRD 2842; the default, so every row before
--   reads so), or `omni-bugs`, the standing mission that fixes the Omni Loop bugs missions report. A `prds` mission's scope
--   holds one PRD or roadmap at least (mission_scope_ok(), unchanged); an `omni-bugs` mission's is empty,
--   {"prds": [], "roadmaps": []}. A mission's kind never changes through a push.
-- - At most one `omni-bugs` mission is live (running, waiting or paused) at a time, whichever workspace holds it: a partial
--   unique index refuses a second (23505). A draft, a stopped or a delivered one is not counted.
-- - mission_push(): reads the brief's `kind`, `prds` when it names none, so a push of PRD 2842's shape is filed as before.
--   An `omni-bugs` brief names no scope, or an empty one; a kind off the list, a scope on an `omni-bugs` brief, and a push
--   that would change a mission's kind are refused (22023, the field as the hint). Which repository runs the team is the
--   kit's and the App's to say (OMNI_LOOP_REPOSITORY): the database does not know it.
-- - omni_bug_reports gains the team's side of a bug: its `state` (open, fixing, pr-opened, asked, merged, fixed, wont-fix;
--   open by default), its `attempts` (0 to 3: a 4th is refused, 23514), its fix pull request `fix_pr` (a number on its
--   repo), the kit version `fixed_in` that released the fix (0.0.N, required once fixed) and `asked_job`, the bug-fix job
--   whose question set it aside. Still the service role's alone: nobody signed in reads or writes a row.
-- - mission_events.kind takes three more kinds, written by the service role: bug-taken, bug-asked and bug-fixed.
-- - runner_jobs.mission_key: also takes `mission:<id>:bug:<issue>:run:<k>`, the k-th bug-fix job of a bug: unique, so a
--   replay of the supervisor, or two runs at once, insert it once.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written (BR-PRODUCT-12, 28, 29,
-- 39, 59, 63, 64, N-PRODUCT-16); a member reads their own workspace's missions only, and nobody signed in reads a bug report,
-- which names no workspace (BR-PRODUCT-63, P-PRODUCT-127); a bug's fix is a pull request a person merges (N-PRODUCT-15). A
-- bug report holds a fingerprint, a repository, numbers, a version and a job's id: no login, email, credential or log
-- excerpt (L-GDPR-1, L-GDPR-2).
--
-- Every statement can run twice. Nobody's grants change.
-- Proven by supabase/checks/omni_bug_team.sql.
-- Rollback: once no mission is of kind omni-bugs and no row holds one of the three events or a `:bug:` key, a follow-up
-- migration drops missions_one_omni_bugs, the kind's checks and missions.kind, puts missions_scope_shape back on
-- mission_scope_ok() alone, drops the five columns of omni_bug_reports and their checks, and restores mission_push() of
-- 20270122093000_missions.sql and runner_jobs_mission_key_shape and mission_events_kind_check of
-- 20270126110000_mission_retros.sql.

-- ── A mission's kind ────────────────────────────────────────────────────────────

alter table public.missions add column if not exists kind text not null default 'prds';
alter table public.missions drop constraint if exists missions_kind;
alter table public.missions add constraint missions_kind check (kind in ('prds', 'omni-bugs'));

-- A prds mission's scope as before; an omni-bugs mission's empty.
alter table public.missions drop constraint if exists missions_scope_shape;
alter table public.missions add constraint missions_scope_shape check (
  case kind when 'omni-bugs' then scope = '{"prds": [], "roadmaps": []}'::jsonb else public.mission_scope_ok(scope) end);

create unique index if not exists missions_one_omni_bugs on public.missions (kind)
  where kind = 'omni-bugs' and status in ('running', 'waiting', 'paused');

comment on column public.missions.kind is
  'prds (PRD 2842: it delivers its scope, then ends delivered) or omni-bugs (PRD 3088: the standing mission that fixes the Omni Loop bugs missions report; its scope is empty, it never ends delivered, and one at most is running, waiting or paused). Set by its first push, never changed by a later one.';
comment on column public.missions.scope is
  'The PRDs and roadmaps of the repository it delivers: {prds: [n], roadmaps: [n]}, one at least; empty for an omni-bugs mission.';

-- ── The only writer a signed-in person reaches ──────────────────────────────────

-- mission_push() of 20270122093000_missions.sql, reading the brief's kind: a kind off the list is refused, an omni-bugs
-- brief's scope is empty, and a push never changes a mission's kind. Nothing else of it changes.
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
    v_scope := brief -> 'scope';
    if not public.mission_scope_ok(v_scope) then
      raise exception 'scope: PRDs and roadmaps of the repository, one at least.' using errcode = '22023', hint = 'scope';
    end if;
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
  -- A mission's kind is its first push's.
  select m.kind into was from public.missions m
   where m.workspace_id = pick.workspace_id and m.repo = v_repo and m.number = p_mission;
  if was is not null and was <> v_kind then
    raise exception 'kind: mission #% is of kind %, which a push never changes.', p_mission, was using errcode = '22023', hint = 'kind';
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
  -- status, the kind, who started it or when it wakes.
  v_created := was is null;
  insert into public.missions as m (workspace_id, repo, fleet, number, title, goal, measures, scope, mandate, kind)
  values (pick.workspace_id, v_repo, v_fleet, p_mission, v_title, v_goal, coalesce(brief -> 'measures', '[]'::jsonb),
          v_scope, coalesce(brief -> 'mandate', '{"parallel": 2}'::jsonb), v_kind)
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

-- `create or replace` keeps the grants; they are stated again so this file reads whole.
revoke execute on function public.mission_push(text, integer, text, jsonb, jsonb) from public, anon;
grant execute on function public.mission_push(text, integer, text, jsonb, jsonb) to authenticated;

-- ── A bug's side on the team ────────────────────────────────────────────────────

alter table public.omni_bug_reports add column if not exists state text not null default 'open';
alter table public.omni_bug_reports add column if not exists attempts smallint not null default 0;
alter table public.omni_bug_reports add column if not exists fix_pr integer;
alter table public.omni_bug_reports add column if not exists fixed_in text;
alter table public.omni_bug_reports add column if not exists asked_job uuid;

alter table public.omni_bug_reports drop constraint if exists omni_bug_reports_state;
alter table public.omni_bug_reports add constraint omni_bug_reports_state
  check (state in ('open', 'fixing', 'pr-opened', 'asked', 'merged', 'fixed', 'wont-fix'));
alter table public.omni_bug_reports drop constraint if exists omni_bug_reports_attempts;
alter table public.omni_bug_reports add constraint omni_bug_reports_attempts check (attempts between 0 and 3);
alter table public.omni_bug_reports drop constraint if exists omni_bug_reports_fix_pr;
alter table public.omni_bug_reports add constraint omni_bug_reports_fix_pr check (fix_pr is null or fix_pr > 0);
alter table public.omni_bug_reports drop constraint if exists omni_bug_reports_fixed_in;
alter table public.omni_bug_reports add constraint omni_bug_reports_fixed_in
  check (fixed_in is null or fixed_in ~ '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$');
alter table public.omni_bug_reports drop constraint if exists omni_bug_reports_fixed;
alter table public.omni_bug_reports add constraint omni_bug_reports_fixed check (state <> 'fixed' or fixed_in is not null);

comment on table public.omni_bug_reports is
  'The Omni Loop bugs missions met (PRD 2980): one issue per fingerprint on the Omni Loop repository, filed by the App, and where the bug team stands on it (PRD 3088). No workspace, no customer''s work: the service role alone reads and writes it.';
comment on column public.omni_bug_reports.state is
  'Where the bug team stands on it (PRD 3088): open (waits to be taken), fixing (a bug-fix job runs), pr-opened (its fix waits for a person''s merge), asked (set aside, its one question waits for a person), merged (its fix is on the default branch, not released), fixed (released in fixed_in) or wont-fix (closed as not planned).';
comment on column public.omni_bug_reports.attempts is
  'The bug-fix jobs that ended stuck, blocked or unread, 0 to 3: the 3rd sets it aside as asked, and a 4th is refused. A lost job spends none.';
comment on column public.omni_bug_reports.fix_pr is 'The number of its fix pull request on repo, once one is opened.';
comment on column public.omni_bug_reports.fixed_in is 'The kit version whose release holds its fix (0.0.N, no v): set once it is fixed, required then.';
comment on column public.omni_bug_reports.asked_job is 'The bug-fix job whose question set it aside, while asked: kept even once that job is gone.';

-- ── What the team did ───────────────────────────────────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written',
  'repair-started', 'retro', 'repair-ended', 'bug-reported', 'checked', 'budget-stop', 'budget-answer',
  'stuck', 'stuck-answer', 'milestone-retro', 'item-proposed', 'item-answered',
  'bug-taken', 'bug-asked', 'bug-fixed'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent), not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd), repair-started, retro, repair-ended and bug-reported (PRD 2980: a repair was sent, its retro named the cause, it ended, or the App filed an Omni Loop bug report; actor agent, each one sentence and one link, naming its fingerprint''s first 8 characters), checked (PRD 3001: a verdict of QA, role qa, actor agent, its round and its bugs'' issues in its sentence, linking its comment), budget-stop and budget-answer (PRD 3040: the supervisor recorded a budget stop, role supervisor, actor agent, naming whose cap and its value; a person answered it, actor their login), stuck, stuck-answer, milestone-retro, item-proposed and item-answered (PRD 3065: the supervisor found the mission stuck, sent its stuck repair or paused it by stuck, role supervisor, actor agent; a person resumed or stopped a mission paused by stuck, actor their login; a milestone retro was recorded, or skipped saying why, role supervisor, actor agent; a retro or a repair proposed a change to a rule, a law or a form, role supervisor, actor agent, naming its target; a person adopted or declined it, actor their login), or bug-taken, bug-asked and bug-fixed (PRD 3088: the bug team sent a bug-fix job for an Omni Loop bug, set one aside on its question, or a bug a mission waited on was released fixed; role supervisor, actor agent, each one sentence naming the issue and its count or version, and one link, never a workspace, repository or login).';

-- ── A bug's job ─────────────────────────────────────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:[1-9][0-9]*:(run:[1-9][0-9]*(:review:[12]|:fix:1|:qa:[12]|:qa-fix:1:[1-5])?|approve:[1-9][0-9]*|repair:[1-9][0-9]*)|pm:[1-9][0-9]*|stuck:[1-9][0-9]*|retro:([1-9][0-9]*|mission)|bug:[1-9][0-9]*:run:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>, then :review:<1 or 2> for the Reviewer''s job of that round or :fix:1 for the fix after round 1 (PRD 2871), or :qa:<1 or 2> for QA''s job of that round or :qa-fix:1:<1 to 5> for the Engineer''s fix of a bug of round 1 (PRD 3001); mission:<mission id>:prd:<n>:approve:<k>, the committee''s k-th job for the PRD (PRD 2896); mission:<mission id>:prd:<n>:repair:<k>, the PRD''s k-th repair (PRD 2980); mission:<mission id>:pm:<k>, the mission''s k-th PM job (PRD 2896); mission:<mission id>:stuck:<k>, the mission''s k-th stuck repair, or mission:<mission id>:retro:<roadmap n | mission>, a milestone''s retro (PRD 3065); mission:<mission id>:bug:<issue>:run:<k>, the bug team''s k-th bug-fix job of the Omni Loop bug filed as issue <issue> (PRD 3088): unique, so a replay of the supervisor, or two runs at once, insert the job once.';
