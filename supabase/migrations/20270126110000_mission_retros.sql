-- A mission runs a retro when it is stuck or reaches a milestone (PRD 3065 s2, docs:
-- .omni-loop/delivery/inbox/3065-mission-retros/spec.md, sections 2 to 5). It runs after 20270126100000_token_budget.sql,
-- which last set the kinds of a mission event, 20270125160000_qa_turn.sql, which last set a mission key's shape, and
-- 20270125140000_mission_repairs.sql, which made mission_repairs and last set runner_claim().
--
-- - mission_repairs.trigger: what sent a repair, `failure` (PRD 2980: a step failed; the default, so every row before reads
--   so) or `stuck` (5 ended jobs in a row moved nothing). A stuck repair may name no PRD, when its cause is the mission's own;
--   a failure always names one. Its failed job is, for a stuck repair, the fifth job, whose end made the mission stuck. The
--   budget is PRD 2980's, unchanged: a 4th repair of one cause in a round and a 10th of the mission are refused whatever the
--   trigger, so a stuck repair spends one of the 9 whatever it finds. Its trigger, as all it was, never changes.
-- - mission_retros: one row per milestone retro, written by the service role (the supervisor, reading the skill's
--   `omni retro:` line): its mission, its milestone (a roadmap of the scope by its number, or `mission`), its job, the retro
--   (kit/lib/mission/retro.ts › MissionRetroSchema, sentences citing events, PRDs, pull requests or repairs) and its file on
--   the mission branch (none at `with-you`), or, in place of a retro, why it was skipped (`budget reached`, a line that
--   could not be read). One per milestone; never changed, never deleted but with its mission.
-- - mission_items: the mission's own outbox, one row per proposed change to a rule, a law or a playbook form
--   (kit/lib/mission/item.ts › MissionItemSchema): raised by one milestone retro or one repair of the same mission, its
--   number there, its target, the wording it proposes, its evidence (1 to 10 sentences) and its file on the mission branch
--   (none at `with-you`); and the answer a member gives, `adopted` or `declined`, with an optional note, who and when. It
--   starts unanswered; what it was never changes, and its answer is written once, never rewritten (BR-PRODUCT-12). Adopt
--   applies nothing: a person applies the change.
-- - answer_mission_item(): the only way an item is answered, as the signed-in member of the mission's workspace; a second
--   answer is refused (22023, hint answer); anyone else 42501. Nobody answers for a person, the service role neither.
-- - missions.paused_by: `stuck` while the supervisor holds the mission paused by stuck, null otherwise. It is set only on a
--   paused mission, and cleared by the database whenever the mission leaves `paused` (a Resume, a Stop), whoever writes it.
-- - mission_events.kind takes five more kinds: stuck and milestone-retro and item-proposed (the supervisor, actor agent),
--   stuck-answer and item-answered (a person's Resume or Stop of a stuck mission, an item's answer, actor their login).
-- - runner_jobs.mission_key: also takes `mission:<id>:stuck:<k>`, the mission's k-th stuck repair, and
--   `mission:<id>:retro:<roadmap n | mission>`, a milestone's retro: unique, so a replay sends each once.
-- - runner_claim(): a stuck repair is claimed first in line, as a PRD's repair is (PRD 2980). A milestone retro waits its
--   turn as a fresh job. Nothing else of it changes.
--
-- Laws kept: an answer never changes after it is given (BR-PRODUCT-12); retros, items and events are only ever added
-- (N-PRODUCT-16); a retro's file and items name the mission branch, never the default branch (N-PRODUCT-15); a member reads
-- their own workspace's missions only (BR-PRODUCT-63); no membership, ask session, AI key or agent link is read or written
-- (BR-PRODUCT-28, 29, 39, 59, 64). A retro and an item hold sentences, ids and paths: no login, email, credential or log
-- excerpt (L-GDPR-1, L-GDPR-2); an item's answer records a decision and is kept for good (L-GDPR-4).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/mission_retros.sql.
-- Rollback: once no row holds a stuck repair, a retro, an item, a pause by stuck, one of the five events or a `:stuck:` or
-- `:retro:` key, a follow-up migration drops answer_mission_item(), mission_items, mission_retros, their trigger functions,
-- missions.paused_by and its trigger, and mission_repairs.trigger and its check, sets mission_repairs.prd not null again,
-- and restores mission_repairs_keep() and runner_claim() of 20270125140000_mission_repairs.sql, runner_jobs_mission_key_shape
-- of 20270125160000_qa_turn.sql and mission_events_kind_check of 20270126100000_token_budget.sql.

-- ── What sent a repair ──────────────────────────────────────────────────────────

alter table public.mission_repairs add column if not exists trigger text not null default 'failure';
alter table public.mission_repairs drop constraint if exists mission_repairs_trigger;
alter table public.mission_repairs add constraint mission_repairs_trigger check (trigger in ('failure', 'stuck'));
alter table public.mission_repairs alter column prd drop not null;
alter table public.mission_repairs drop constraint if exists mission_repairs_prd;
alter table public.mission_repairs add constraint mission_repairs_prd check (prd is not null or trigger = 'stuck');

comment on column public.mission_repairs.trigger is
  'What sent it: failure (a step failed, PRD 2980) or stuck (5 ended jobs in a row moved nothing, PRD 3065). Either spends from the same 3 per cause in a round and 9 per mission.';
comment on column public.mission_repairs.prd is
  'The PRD whose step failed; for a stuck repair, the PRD its cause sits in, or null when the cause is the mission''s own.';
comment on column public.mission_repairs.failed_job_id is
  'The runner job whose failure it repairs, or, for a stuck repair, the fifth job, whose end made the mission stuck: kept even once that job is gone.';

-- As 20270125140000_mission_repairs.sql, the trigger among what never changes.
create or replace function public.mission_repairs_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.mission_id, new.prd, new.fingerprint, new.round, new.number, new.failed_job_id, new.started_at, new.trigger)
     is distinct from (old.id, old.mission_id, old.prd, old.fingerprint, old.round, old.number, old.failed_job_id, old.started_at, old.trigger) then
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

-- ── A milestone's retro ─────────────────────────────────────────────────────────

create table if not exists public.mission_retros (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,
  milestone   text not null check (milestone = 'mission' or milestone ~ '^[1-9][0-9]{0,8}$'),
  job_id      uuid,
  retro       jsonb check (retro is null or (jsonb_typeof(retro) = 'object' and octet_length(retro::text) <= 16384)),
  skipped     text check (skipped is null or char_length(skipped) between 1 and 300),
  file        text check (file is null or (char_length(file) <= 300 and file ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*\.md$'
                                           and file !~ '(^|/)\.\.?(/|$)')),
  created_at  timestamptz not null default now(),
  constraint mission_retros_milestone_key unique (mission_id, milestone),
  constraint mission_retros_written check ((retro is null) <> (skipped is null)),
  constraint mission_retros_skipped_file check (skipped is null or file is null)
);

comment on table public.mission_retros is
  'A mission''s milestone retros (PRD 3065): one per roadmap of its scope delivered and one for the mission delivered, written by the service role, read by the workspace''s members, never changed.';
comment on column public.mission_retros.milestone is 'Its milestone: a roadmap of the scope, by its number, or `mission` for the mission delivered.';
comment on column public.mission_retros.job_id is 'The runner job that ran /omni:mission-retro: kept even once that job is gone.';
comment on column public.mission_retros.retro is 'The retro its `omni retro:` line carried (kit/lib/mission/retro.ts › MissionRetroSchema): what went well and what to change, cited sentences only, never a log excerpt, a credential or a person''s words. Null when skipped.';
comment on column public.mission_retros.skipped is 'Why no retro was written (`budget reached`, a line that could not be read), in place of the retro: read as not done, never as done.';
comment on column public.mission_retros.file is 'Its file on the mission branch, from the repository''s root; null at `with-you`, where it is kept on the mission page only.';
comment on column public.mission_retros.created_at is 'When it was recorded: set by the database.';

-- A retro's time is the database's.
create or replace function public.mission_retros_start() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists mission_retros_start on public.mission_retros;
create trigger mission_retros_start before insert on public.mission_retros for each row execute function public.mission_retros_start();

alter table public.mission_retros enable row level security;

drop policy if exists "a member reads their workspace's mission retros" on public.mission_retros;
create policy "a member reads their workspace's mission retros" on public.mission_retros
  for select to authenticated
  using (mission_id in (select m.id from public.missions m where m.workspace_id in (select public.my_workspaces())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody changes or deletes a retro: it goes
-- with its mission.
revoke all on public.mission_retros from public, anon, authenticated, service_role;
grant select on public.mission_retros to authenticated;
grant select, insert on public.mission_retros to service_role;

-- ── The mission's own outbox ────────────────────────────────────────────────────

create table if not exists public.mission_items (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references public.missions (id) on delete cascade,
  retro_id     uuid references public.mission_retros (id) on delete cascade,
  repair_id    uuid references public.mission_repairs (id) on delete cascade,
  number       smallint not null check (number between 1 and 20),
  target       text not null check (char_length(target) between 1 and 200),
  wording      text not null check (char_length(wording) between 1 and 2000),
  evidence     jsonb not null check (case when jsonb_typeof(evidence) = 'array'
                                          then jsonb_array_length(evidence) between 1 and 10 and octet_length(evidence::text) <= 8192
                                          else false end),
  file         text check (file is null or (char_length(file) <= 300 and file ~ '^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*\.md$'
                                            and file !~ '(^|/)\.\.?(/|$)')),
  answer       text check (answer is null or answer in ('adopted', 'declined')),
  note         text check (note is null or char_length(note) between 1 and 500),
  answered_by  uuid references auth.users (id) on delete set null,
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint mission_items_raised_by check (num_nonnulls(retro_id, repair_id) = 1),
  constraint mission_items_answered check ((answer is null) = (answered_at is null)),
  constraint mission_items_note check (note is null or answer is not null)
);

-- One item per number of a retro or a repair: a replayed run records it once.
create unique index if not exists mission_items_retro_number on public.mission_items (retro_id, number) where retro_id is not null;
create unique index if not exists mission_items_repair_number on public.mission_items (repair_id, number) where repair_id is not null;
create index if not exists mission_items_mission_idx on public.mission_items (mission_id, created_at);

comment on table public.mission_items is
  'A mission''s own outbox (PRD 3065): one row per change to a rule, a law or a playbook form a milestone retro or a stuck repair proposed, always high, recorded by the service role, read by the workspace''s members, answered once through answer_mission_item(). Adopt applies nothing: a person applies the change.';
comment on column public.mission_items.retro_id is 'The milestone retro that raised it; null when a repair did.';
comment on column public.mission_items.repair_id is 'The repair that raised it; null when a milestone retro did.';
comment on column public.mission_items.number is 'Its number among the items its retro or repair raised, 1 to 20.';
comment on column public.mission_items.target is 'What it proposes to change: a rule or a law by its id, or a playbook form and its section.';
comment on column public.mission_items.wording is 'The wording it proposes.';
comment on column public.mission_items.evidence is 'Its evidence: 1 to 10 sentences citing the retro, never a log excerpt.';
comment on column public.mission_items.file is 'Its file under the mission folder''s outbox/ on the mission branch, from the repository''s root; null at `with-you`.';
comment on column public.mission_items.answer is 'null while it waits; adopted or declined. Written once, never rewritten.';
comment on column public.mission_items.note is 'The member''s optional note with their answer, up to 500 characters.';
comment on column public.mission_items.answered_by is 'The member who answered: set by answer_mission_item(), never by the caller.';
comment on column public.mission_items.answered_at is 'When it was answered: set by the database.';

-- An item starts unanswered, raised by its own mission's retro or repair, its evidence sentences, its time the database's.
create or replace function public.mission_items_start() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.answer is not null or new.note is not null or new.answered_by is not null or new.answered_at is not null then
    raise exception 'A mission item starts unanswered: a person answers it.' using errcode = '22023', hint = 'answer';
  end if;
  if new.retro_id is not null and not exists (select 1 from public.mission_retros r where r.id = new.retro_id and r.mission_id = new.mission_id) then
    raise exception 'Retro: one of the item''s own mission.' using errcode = '22023', hint = 'retro_id';
  end if;
  if new.repair_id is not null and not exists (select 1 from public.mission_repairs r where r.id = new.repair_id and r.mission_id = new.mission_id) then
    raise exception 'Repair: one of the item''s own mission.' using errcode = '22023', hint = 'repair_id';
  end if;
  if jsonb_typeof(new.evidence) = 'array' and exists (
       select 1 from jsonb_array_elements(new.evidence) e (value)
        where jsonb_typeof(e.value) <> 'string' or char_length(e.value #>> '{}') not between 1 and 500) then
    raise exception 'Evidence: each one a sentence of 1 to 500 characters.' using errcode = '22023', hint = 'evidence';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists mission_items_start on public.mission_items;
create trigger mission_items_start before insert on public.mission_items for each row execute function public.mission_items_start();

-- What an item was never changes; it changes only by its answer, written once and dated by the database.
create or replace function public.mission_items_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.mission_id, new.retro_id, new.repair_id, new.number, new.target, new.wording, new.evidence, new.file, new.created_at)
     is distinct from (old.id, old.mission_id, old.retro_id, old.repair_id, old.number, old.target, old.wording, old.evidence, old.file, old.created_at) then
    raise exception 'A mission item''s mission, source, number, target, wording, evidence, file and time never change.' using errcode = '42501';
  end if;
  if old.answer is not null then
    raise exception 'A mission item''s answer is given once: it was %.', old.answer using errcode = '42501';
  end if;
  if new.answer is null then
    raise exception 'A mission item changes only by its answer.' using errcode = '22023', hint = 'answer';
  end if;
  new.answered_at := now();
  return new;
end;
$$;

drop trigger if exists mission_items_keep on public.mission_items;
create trigger mission_items_keep before update on public.mission_items for each row execute function public.mission_items_keep();

-- A member answers an item, once, as themselves: adopted or declined, with an optional note (a blank one is none).
create or replace function public.answer_mission_item(p_item uuid, p_answer text, p_note text default null)
returns public.mission_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.mission_items;
  made public.mission_items;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select i.* into it from public.mission_items i
    join public.missions m on m.id = i.mission_id
   where i.id = p_item and m.workspace_id in (select public.my_workspaces())
     for update of i;
  if auth.uid() is null or it.id is null then
    raise exception 'Only a member of the mission''s workspace answers its questions.' using errcode = '42501';
  end if;
  if p_answer is null or p_answer not in ('adopted', 'declined') then
    raise exception 'Answer: adopted or declined.' using errcode = '22023', hint = 'answer';
  end if;
  if it.answer is not null then
    raise exception 'Answer: this question was answered already (%).', it.answer using errcode = '22023', hint = 'answer';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note: 500 characters at most.' using errcode = '22023', hint = 'note';
  end if;
  update public.mission_items i
     set answer = p_answer, note = v_note, answered_by = auth.uid()
   where i.id = it.id
  returning * into made;
  return made;
end;
$$;

revoke execute on function public.mission_retros_start(), public.mission_items_start(), public.mission_items_keep() from public, anon, authenticated;
revoke execute on function public.answer_mission_item(uuid, text, text) from public, anon, service_role;
grant execute on function public.answer_mission_item(uuid, text, text) to authenticated;

alter table public.mission_items enable row level security;

drop policy if exists "a member reads their workspace's mission items" on public.mission_items;
create policy "a member reads their workspace's mission items" on public.mission_items
  for select to authenticated
  using (mission_id in (select m.id from public.missions m where m.workspace_id in (select public.my_workspaces())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). The service role records an item and never
-- answers one; nobody deletes one: it goes with its mission.
revoke all on public.mission_items from public, anon, authenticated, service_role;
grant select on public.mission_items to authenticated;
grant select, insert on public.mission_items to service_role;

-- ── Paused by stuck ─────────────────────────────────────────────────────────────

alter table public.missions add column if not exists paused_by text;
alter table public.missions drop constraint if exists missions_paused_by;
alter table public.missions add constraint missions_paused_by check (paused_by is null or (paused_by = 'stuck' and status = 'paused'));

comment on column public.missions.paused_by is
  'stuck while the supervisor holds the mission paused because it was stuck (PRD 3065), asking once: Resume or Stop. Null otherwise: cleared by the database whenever the mission leaves paused.';

-- Leaving the pause, by whoever, clears what paused it.
create or replace function public.missions_paused_by() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from 'paused' then
    new.paused_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists missions_paused_by on public.missions;
create trigger missions_paused_by before update on public.missions for each row execute function public.missions_paused_by();

revoke execute on function public.missions_paused_by() from public, anon, authenticated;

-- ── What a mission did: its retros and its questions ────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written',
  'repair-started', 'retro', 'repair-ended', 'bug-reported', 'checked', 'budget-stop', 'budget-answer',
  'stuck', 'stuck-answer', 'milestone-retro', 'item-proposed', 'item-answered'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent), not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd), repair-started, retro, repair-ended and bug-reported (PRD 2980: a repair was sent, its retro named the cause, it ended, or the App filed an Omni Loop bug report; actor agent, each one sentence and one link, naming its fingerprint''s first 8 characters), checked (PRD 3001: a verdict of QA, role qa, actor agent, its round and its bugs'' issues in its sentence, linking its comment), budget-stop and budget-answer (PRD 3040: the supervisor recorded a budget stop, role supervisor, actor agent, naming whose cap and its value; a person answered it, actor their login), or stuck, stuck-answer, milestone-retro, item-proposed and item-answered (PRD 3065: the supervisor found the mission stuck, sent its stuck repair or paused it by stuck, role supervisor, actor agent; a person resumed or stopped a mission paused by stuck, actor their login; a milestone retro was recorded, or skipped saying why, role supervisor, actor agent; a retro or a repair proposed a change to a rule, a law or a form, role supervisor, actor agent, naming its target; a person adopted or declined it, actor their login).';

-- ── A stuck repair's job, and a milestone retro's ──────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:[1-9][0-9]*:(run:[1-9][0-9]*(:review:[12]|:fix:1|:qa:[12]|:qa-fix:1:[1-5])?|approve:[1-9][0-9]*|repair:[1-9][0-9]*)|pm:[1-9][0-9]*|stuck:[1-9][0-9]*|retro:([1-9][0-9]*|mission))$');

comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>, then :review:<1 or 2> for the Reviewer''s job of that round or :fix:1 for the fix after round 1 (PRD 2871), or :qa:<1 or 2> for QA''s job of that round or :qa-fix:1:<1 to 5> for the Engineer''s fix of a bug of round 1 (PRD 3001); mission:<mission id>:prd:<n>:approve:<k>, the committee''s k-th job for the PRD (PRD 2896); mission:<mission id>:prd:<n>:repair:<k>, the PRD''s k-th repair (PRD 2980); mission:<mission id>:pm:<k>, the mission''s k-th PM job (PRD 2896); mission:<mission id>:stuck:<k>, the mission''s k-th stuck repair, or mission:<mission id>:retro:<roadmap n | mission>, a milestone''s retro (PRD 3065): unique, so a replay of the supervisor, or two runs at once, insert the job once.';

-- ── A stuck repair is claimed first in line ─────────────────────────────────────

-- runner_claim() of 20270125140000_mission_repairs.sql, its order alone changed: a mission's stuck repair joins its PRDs'
-- repairs, with the resumes, before any fresh job.
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
      -- Recovery first: every resume and every mission's repair, a PRD's or a stuck one, before any fresh job, a resume by
      -- when the first job of its chain was queued, a repair by its own queued time.
      order by q.resumes is null and (q.mission_key is null or q.mission_key !~ ':(prd:[1-9][0-9]*:repair|stuck):[1-9][0-9]*$'),
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
