-- A mission repairs a failed step, then stops and explains (PRD 2980 s2, docs: .omni-loop/delivery/inbox/2980-mission-repairs/spec.md,
-- sections 1, 3, 4 and 6). It runs after 20270125130000_runner_claim_recovery_first.sql, which last set runner_claim(), and
-- 20270124150000_mission_pm.sql, which last set a mission key's shape, the kinds of a mission event, the runners' fixed skills and
-- the heroes' defaults.
--
-- - mission_repairs: one row per repair a mission sent, written by the service role (the supervisor): its mission, its PRD, the
--   cause's fingerprint, the mission's round of repairs it counts in, its number for that cause in that round (1 to 3), the job
--   whose failure it repairs and its own job, the retro its record line carried, the fix pull request and its outcome:
--     fixed      its fix landed and the step then passed
--     not fixed  the step failed again, or its record line could not be read
--     stopped    it ended the PRD: a `person` or `omni-loop` class, or a refused scrub
--     lost       its runner was lost and it never ended: it spends nothing
--   The database holds the budget, so it holds even when the supervisor is wrong: a 4th repair of one fingerprint in a round,
--   and a 10th repair in a mission (every round counted), are refused (23514), a lost one apart. The number is the database's,
--   never the caller's. What a repair was never changes, and nothing of one that ended does. A member of the mission's
--   workspace reads the rows; anyone else nothing; nobody signed in writes them; nobody deletes one: they go with their mission.
-- - omni_bug_reports: one row per Omni Loop bug a mission met anywhere, keyed by its fingerprint, with the repository and issue it
--   was filed as and how often it was met. It names no workspace, and nobody signed in reads or writes it: the App files the
--   report and keeps the row as the service role. omni_bug_report_seen() counts a repeat in one statement.
-- - mission_events.kind takes four more kinds, written by the service role as every event of the supervisor is; a member reads
--   them and writes none: repair-started, retro, repair-ended and bug-reported.
-- - runner_jobs.mission_key: also takes `mission:<id>:prd:<n>:repair:<k>`, the PRD's k-th repair job: unique, so a replay of the
--   supervisor, or two runs at once, insert it once.
-- - runner_claim(): a repair job is claimed first in line, with the resumes (PRD 2949), before any fresh job. Nothing else of it
--   changes.
-- - set_repository_runner_skill(): its fixed list also holds `repair`, so a repository's own skill is never named like it.
-- - virtual_hero_roles(): the Engineer's skills end with `repair`; an Engineer whose skills are still the default it was made with
--   takes it, and a hero a person changed keeps what they made of it.
--
-- Laws kept: no membership, ask session, AI key, agent link, answer or ledger row is read or written (BR-PRODUCT-12, 28, 29, 39,
-- 59, 63, 64, N-PRODUCT-16); a fix lands in a mission's branch, never in the default branch (N-PRODUCT-15); a job whose cancel was
-- asked is never claimed (BR-PRODUCT-134). No credential, log excerpt or person's words are kept: a retro holds sentences, and a
-- bug report's row holds a fingerprint, a repository, an issue number and a count (L-GDPR-1, L-GDPR-2).
--
-- Every statement can run twice. Nobody's grants change.
-- Proven by supabase/checks/mission_repairs.sql.
-- Rollback: once no row holds a repair event or a `:repair:` key, a follow-up migration drops omni_bug_report_seen(),
-- omni_bug_reports, mission_repairs and their two trigger functions, and restores runner_jobs_mission_key_shape,
-- mission_events_kind_check, set_repository_runner_skill() and virtual_hero_roles() of 20270124150000_mission_pm.sql and
-- runner_claim() of 20270125130000_runner_claim_recovery_first.sql. An Engineer keeps `repair` until a person removes it.

-- ── A mission's repairs ─────────────────────────────────────────────────────────

create table if not exists public.mission_repairs (
  id            uuid primary key default gen_random_uuid(),
  mission_id    uuid not null references public.missions (id) on delete cascade,
  prd           integer not null check (prd > 0),
  fingerprint   text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  round         integer not null default 1 check (round >= 1),
  number        smallint not null default 1 check (number between 1 and 3),
  failed_job_id uuid not null,
  job_id        uuid,
  retro         jsonb check (retro is null or (jsonb_typeof(retro) = 'object' and octet_length(retro::text) <= 8192)),
  fix_pr        text check (fix_pr is null or fix_pr ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[1-9][0-9]*$'),
  outcome       text check (outcome is null or outcome in ('fixed', 'not fixed', 'stopped', 'lost')),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  constraint mission_repairs_ended check ((outcome is null) = (ended_at is null))
);

create unique index if not exists mission_repairs_number_key on public.mission_repairs (mission_id, round, fingerprint, number) where outcome is distinct from 'lost';
create index if not exists mission_repairs_mission_idx on public.mission_repairs (mission_id, started_at desc);

comment on table public.mission_repairs is
  'A mission''s repairs (PRD 2980): one row per repair the supervisor sent, 3 per cause in a round and 9 per mission at most, held by the database. Read by the workspace''s members, written by the service role.';
comment on column public.mission_repairs.prd is 'The PRD whose step failed.';
comment on column public.mission_repairs.fingerprint is 'The cause''s fingerprint (kit/lib/repair: a sha256, 64 lower-case hex characters): one cause, one fingerprint, whichever run met it. Its first 8 characters name it on the pages.';
comment on column public.mission_repairs.round is 'The mission''s round of repairs it counts in: a person''s Resume of a stopped PRD opens a new one, where each cause gets 3 again; the mission''s 9 count every round.';
comment on column public.mission_repairs.number is 'Its number for its cause in its round, 1 to 3: set by the database, never by the caller.';
comment on column public.mission_repairs.failed_job_id is 'The runner job whose failure it repairs: kept even once that job is gone.';
comment on column public.mission_repairs.job_id is 'Its own runner job, running /omni:repair, once sent: kept even once that job is gone.';
comment on column public.mission_repairs.retro is 'The retro its record line carried (kit/lib/repair: RepairRetroSchema): sentences only, never a log excerpt, a credential or a person''s words.';
comment on column public.mission_repairs.fix_pr is 'The bug fix''s pull request into the mission branch, for a `code` repair.';
comment on column public.mission_repairs.outcome is 'null while it runs; fixed, not fixed, stopped (it ended the PRD) or lost (its runner was lost: it spends nothing).';
comment on column public.mission_repairs.ended_at is 'When its outcome was set: set by the database.';

-- The budget, held whoever inserts: the mission is locked first, so two repairs sent at once are counted one after the other.
create or replace function public.mission_repairs_budget() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  spent integer;
  cause integer;
begin
  if new.outcome is not null or new.ended_at is not null then
    raise exception 'A repair starts with no outcome: set it once it ends.' using errcode = '22023', hint = 'outcome';
  end if;
  perform 1 from public.missions m where m.id = new.mission_id for update;
  select count(*) into spent from public.mission_repairs r where r.mission_id = new.mission_id and r.outcome is distinct from 'lost';
  if spent >= 9 then
    raise exception 'A mission runs 9 repairs at most: this one has run its 9.' using errcode = '23514', hint = 'mission';
  end if;
  select count(*) into cause from public.mission_repairs r
   where r.mission_id = new.mission_id and r.round = new.round and r.fingerprint = new.fingerprint and r.outcome is distinct from 'lost';
  if cause >= 3 then
    raise exception 'A cause is repaired 3 times at most in a round: % was.', left(new.fingerprint, 8) using errcode = '23514', hint = 'fingerprint';
  end if;
  new.number := cause + 1;
  new.started_at := now();
  return new;
end;
$$;

drop trigger if exists mission_repairs_budget on public.mission_repairs;
create trigger mission_repairs_budget before insert on public.mission_repairs for each row execute function public.mission_repairs_budget();

-- What a repair was never changes, and nothing of one that ended does: its job, retro and fix are filled in while it runs, and
-- its outcome is set once, dating its end.
create or replace function public.mission_repairs_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.mission_id, new.prd, new.fingerprint, new.round, new.number, new.failed_job_id, new.started_at)
     is distinct from (old.id, old.mission_id, old.prd, old.fingerprint, old.round, old.number, old.failed_job_id, old.started_at) then
    raise exception 'A repair''s mission, PRD, cause, round, number, failed job and start never change.' using errcode = '42501';
  end if;
  if old.outcome is not null then
    raise exception 'A repair that ended never changes: it ended %.', old.outcome using errcode = '42501';
  end if;
  new.ended_at := case when new.outcome is null then null else now() end;
  return new;
end;
$$;

drop trigger if exists mission_repairs_keep on public.mission_repairs;
create trigger mission_repairs_keep before update on public.mission_repairs for each row execute function public.mission_repairs_keep();

revoke execute on function public.mission_repairs_budget(), public.mission_repairs_keep() from public, anon, authenticated;

alter table public.mission_repairs enable row level security;

drop policy if exists "a member reads their workspace's mission repairs" on public.mission_repairs;
create policy "a member reads their workspace's mission repairs" on public.mission_repairs
  for select to authenticated
  using (mission_id in (select m.id from public.missions m where m.workspace_id in (select public.my_workspaces())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody deletes a repair: it goes with its
-- mission.
revoke all on public.mission_repairs from public, anon, authenticated, service_role;
grant select on public.mission_repairs to authenticated;
grant select, insert, update on public.mission_repairs to service_role;

-- ── The Omni Loop bugs a mission reported ───────────────────────────────────────

create table if not exists public.omni_bug_reports (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$'),
  repo        text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  issue       integer not null check (issue > 0),
  count       integer not null default 1 check (count >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.omni_bug_reports is
  'The Omni Loop bugs missions met (PRD 2980): one issue per fingerprint on the Omni Loop repository, filed by the App. No workspace, no customer''s work: the service role alone reads and writes it.';
comment on column public.omni_bug_reports.repo is 'owner/name, in lower case: the repository the issue was filed on (the App''s setting, the Omni Loop repository by default).';
comment on column public.omni_bug_reports.issue is 'The issue''s number on repo.';
comment on column public.omni_bug_reports.count is 'How often a mission met it: 1 when filed, one more for each +1.';

-- A repeat, counted in one statement: the row as it now stands, or none when the fingerprint was never filed.
create or replace function public.omni_bug_report_seen(p_fingerprint text) returns setof public.omni_bug_reports
language sql
set search_path = ''
as $$
  update public.omni_bug_reports b set count = b.count + 1, updated_at = now() where b.fingerprint = p_fingerprint returning b.*;
$$;

revoke execute on function public.omni_bug_report_seen(text) from public, anon, authenticated;
grant execute on function public.omni_bug_report_seen(text) to service_role;

alter table public.omni_bug_reports enable row level security;

revoke all on public.omni_bug_reports from public, anon, authenticated, service_role;
grant select, insert, update on public.omni_bug_reports to service_role;

-- ── What a mission did: its repairs ─────────────────────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written',
  'repair-started', 'retro', 'repair-ended', 'bug-reported'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent), not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd), or repair-started, retro, repair-ended and bug-reported (PRD 2980: a repair was sent, its retro named the cause, it ended, or the App filed an Omni Loop bug report; actor agent, each one sentence and one link, naming its fingerprint''s first 8 characters).';

-- ── A repair's job ──────────────────────────────────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:[1-9][0-9]*:(run:[1-9][0-9]*(:review:[12]|:fix:1)?|approve:[1-9][0-9]*|repair:[1-9][0-9]*)|pm:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>, then :review:<1 or 2> for the Reviewer''s job of that round or :fix:1 for the fix after round 1 (PRD 2871); mission:<mission id>:prd:<n>:approve:<k>, the committee''s k-th job for the PRD (PRD 2896); mission:<mission id>:prd:<n>:repair:<k>, the PRD''s k-th repair (PRD 2980); or mission:<mission id>:pm:<k>, the mission''s k-th PM job (PRD 2896): unique, so a replay of the supervisor, or two runs at once, insert the job once.';

-- ── A repair is claimed first in line ───────────────────────────────────────────

-- runner_claim() of 20270125130000_runner_claim_recovery_first.sql, its order alone changed: a mission's repair job joins the
-- resumes, before any fresh job; the resumes by when the first job of their chain was queued, a repair by its own queued time.
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
      -- Recovery first: every resume and every mission's repair before any fresh job, a resume by when the first job of its
      -- chain was queued, a repair by its own queued time.
      order by q.resumes is null and (q.mission_key is null or q.mission_key !~ ':prd:[1-9][0-9]*:repair:[1-9][0-9]*$'),
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

-- ── /omni:repair is the loop's own skill ────────────────────────────────────────

-- set_repository_runner_skill() of 20270124150000_mission_pm.sql, `repair` added to its fixed list.
create or replace function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  fixed text[] := array['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add', 'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'review', 'committee', 'brainstorm', 'roadmap', 'mega-brainstorm', 'mega-roadmap', 'repair'];
begin
  perform public.repository_owner_only(p_workspace);
  if p_skill is null or p_skill !~ '^[a-z][a-z0-9-]*$' or char_length(p_skill) > 64 then
    raise exception 'Skill: a skill''s name, as its folder under .claude/skills/ spells it.' using errcode = '22023', hint = 'skill';
  end if;
  if p_skill = any (fixed) then
    raise exception 'Skill: /% is the loop''s own skill, which a runner runs as /omni:%.', p_skill, p_skill using errcode = '22023', hint = 'skill';
  end if;
  if p_allowed is null then
    raise exception 'Allow on runner: on or off.' using errcode = '22023', hint = 'allowed';
  end if;
  if not exists (select 1 from public.repositories r where r.workspace_id = p_workspace and r.full_name = name and r.removed_at is null) then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  if p_allowed then
    insert into public.repository_runner_skills (workspace_id, full_name, skill, allowed_by)
    values (p_workspace, name, p_skill, auth.uid())
    on conflict (workspace_id, full_name, skill) do nothing;
  else
    delete from public.repository_runner_skills s
     where s.workspace_id = p_workspace and s.full_name = name and s.skill = p_skill;
  end if;
end;
$$;

-- `create or replace` keeps the grants; they are stated again so this file reads whole.
revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;
grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;

-- ── The Engineer repairs ────────────────────────────────────────────────────────

-- As 20270124150000_mission_pm.sql, the Engineer's skills ending with `repair`: the list of kit/lib/virtual-fleet/roles.ts ›
-- ROLES, as one JSON array between the $json$ markers.
create or replace function public.virtual_hero_roles() returns jsonb
language sql immutable
set search_path = ''
as $$
  select $json$[
    {"role": "engineer", "name": "Engineer", "skills": ["yolo", "yolo-fix", "wave", "do-work", "pr-care", "bug-fix", "mega-bug-fix", "ultra-yolo", "ultra-yolo-fix", "ultra-wave", "mega-pr-care", "drive", "mega-drive", "repair"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It waits for a person wherever one is needed."]},
    {"role": "qa", "name": "QA", "skills": ["prove", "bug-fix", "validate-e2e"], "agent": "claude", "model": "sonnet", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It reports what it saw; a person decides."]},
    {"role": "reviewer", "name": "Reviewer", "skills": ["review", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves on GitHub.", "It marks ready on its pass only.", "It raises five findings at most.", "It reviews two rounds at most."]},
    {"role": "pm", "name": "PM", "skills": ["pitch", "plan", "brainstorm", "roadmap", "mega-brainstorm", "mega-roadmap", "mission"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a PRD it wrote, nor one outside a mission's committee."]},
    {"role": "architect", "name": "Architect", "skills": ["plan", "tech-review"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never approves a plan."]},
    {"role": "designer", "name": "Designer", "skills": ["visual-fix", "pixel-perfect", "think-big"], "agent": "claude", "model": "opus", "limits": ["It never merges into the default branch.", "It never answers for a person.", "It never locks a screen: a person does."]}
  ]$json$::jsonb
$$;

-- An Engineer's skills take `repair` while they are still the default it was made with: a hero a person changed keeps what they
-- made of it.
update public.virtual_heroes h
   set skills = array(select jsonb_array_elements_text(d.value -> 'skills')),
       updated_at = now()
  from jsonb_array_elements(public.virtual_hero_roles()) as d (value)
 where d.value ->> 'role' = 'engineer'
   and h.role = 'engineer'
   and h.skills = array['yolo', 'yolo-fix', 'wave', 'do-work', 'pr-care', 'bug-fix', 'mega-bug-fix', 'ultra-yolo', 'ultra-yolo-fix', 'ultra-wave', 'mega-pr-care', 'drive', 'mega-drive'];
