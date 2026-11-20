-- Message the fleet (PRD 3107 s3, docs: .omni-loop/delivery/inbox/3107-fleet-commander/spec.md, Solution "Message the
-- fleet", criteria AC-5 and AC-14). It runs after 20270128090000_fleet_commander.sql, and builds on
-- 20270122093000_missions.sql (missions, mission_events), 20270127100000_omni_bug_team.sql (mission_events_kind_check,
-- runner_jobs_mission_key_shape), 20261125090000_approval_requests.sql (member_login()) and
-- 20261207090000_rls_membership_once.sql (my_workspaces()).
--
-- - fleet_messages: what a member tells the fleet's agents, signed by its author (their id and their login, as
--   member_login() reads it), 1 to 2000 characters. It is tagged `To the fleet` by being in this table and no other: the
--   Commander's thread (commander_messages) holds questions and replies only, and the Commander never reads these. A row is
--   never changed. Kept 90 days, with the thread's purge (L-GDPR-4).
-- - mission_events.kind takes `messaged`, and mission_events.message_id links the event to the message: the event holds
--   none of its words (its sentence is fixed), only the link. `messaged` is the one kind that carries a message_id, and
--   carries one always.
-- - commander_send(): the only way a member tells their fleet, as themselves: a member of the workspace, on one of its
--   Virtual Fleets. It stores the message and adds one `messaged` event, actor the member's login (`member` for an account
--   whose login is no GitHub login), to each of the fleet's
--   running missions; with no running mission it stores the message and adds none (the box has said so before it was
--   sent). Anyone else 42501; a fleet that is no Virtual Fleet of the workspace, or an empty or long message, 22023 with
--   the field as the hint.
-- - fleet_message_reads: which job read a message: one row per message, mission and role, kept even once the job is gone.
-- - commander_claim_messages(): what a runner job's claim carries. For the job's mission and its role (read from the job's
--   mission_key: reviewer, qa, architect for the committee, pm, engineer, supervisor for the rest), the messages that
--   mission was told and that role had not read yet, that is, those written since its previous job of the same role. It
--   records this job as their reader, so the next job of the role gets none of them again, and a claim asked twice
--   answers the same messages. Nothing else reads it: the service role alone.
--
-- Who reads: a member of the fleet's workspace reads its fleet messages and who read them; anyone else nothing
-- (BR-PRODUCT-29, L-GDPR-1). A deleted account's messages go with it, and the events and receipts that link to them
-- (L-GDPR-3). A message holds a person's words: no credential, no log excerpt (L-GDPR-2).
--
-- Laws kept: no answer is read or written (BR-PRODUCT-12); a member reads and writes only their own workspace's fleets
-- (BR-PRODUCT-29, BR-PRODUCT-63); no AI key is read or written (BR-PRODUCT-59); no membership, ask session or agent link
-- is read or written (BR-PRODUCT-28, 39, 64); no game ledger row is touched (N-PRODUCT-16).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/commander_messaged.sql.
-- Rollback: a follow-up migration drops commander_send(), commander_claim_messages(), fleet_message_reads and the column
-- mission_events.message_id (once no `messaged` event is recorded: they are append-only), puts mission_events_kind_check
-- of 20270127100000_omni_bug_team.sql back, restores commander_messages_forget() of 20270128090000_fleet_commander.sql
-- and drops fleet_messages. Nothing else reads them.

-- ── What a member tells the fleet ───────────────────────────────────────────────

create table if not exists public.fleet_messages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  fleet        text not null,
  author_id    uuid not null references auth.users (id) on delete cascade,
  author_login text not null check (char_length(author_login) between 1 and 200),
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default clock_timestamp(),
  foreign key (workspace_id, fleet) references public.teams (workspace_id, name) on update cascade on delete cascade
);

create index if not exists fleet_messages_fleet_idx on public.fleet_messages (workspace_id, fleet, created_at desc);
create index if not exists fleet_messages_created_idx on public.fleet_messages (created_at);

comment on table public.fleet_messages is
  'What a member told a Virtual Fleet''s agents (PRD 3107): signed by them, tagged `To the fleet`, read by the fleet''s next jobs through commander_claim_messages(). Read by the workspace''s members, written by commander_send(), kept 90 days.';
comment on column public.fleet_messages.author_login is 'The sender''s login as member_login() reads it, set by commander_send(), never by the caller.';
comment on column public.fleet_messages.body is 'The message, as the member wrote it: data the agents read as they read an answer, never an instruction that overrides a law, a Never line or the spec.';

-- Nobody changes a message.
create or replace function public.fleet_messages_keep() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A fleet message is never changed: send a new one.' using errcode = '42501';
end;
$$;

drop trigger if exists fleet_messages_keep on public.fleet_messages;
create trigger fleet_messages_keep
  before update on public.fleet_messages
  for each row execute function public.fleet_messages_keep();

-- ── The event that links to it ──────────────────────────────────────────────────

alter table public.mission_events add column if not exists message_id uuid references public.fleet_messages (id) on delete cascade;

alter table public.mission_events drop constraint if exists mission_events_messaged_link;
alter table public.mission_events add constraint mission_events_messaged_link check ((kind = 'messaged') = (message_id is not null));

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated', 'overturned', 'prd-added', 'not-written',
  'repair-started', 'retro', 'repair-ended', 'bug-reported', 'checked', 'budget-stop', 'budget-answer',
  'stuck', 'stuck-answer', 'milestone-retro', 'item-proposed', 'item-answered',
  'bug-taken', 'bug-asked', 'bug-fixed', 'messaged'));

comment on column public.mission_events.message_id is
  'The fleet message a `messaged` event links to (PRD 3107): set on that kind and on no other. The event holds none of the message''s words.';
comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent), overturned (PRD 2896: a member overturned a decision the fleet carried, which stays as recorded, role supervisor, actor the member''s login), prd-added (PRD 2896: a PRD the mission''s PM wrote joined its scope, added by the fleet, role pm, actor agent), not-written (PRD 2896: a row of the PM''s roadmap the cap left unwritten, role pm, actor agent, no prd), repair-started, retro, repair-ended and bug-reported (PRD 2980: a repair was sent, its retro named the cause, it ended, or the App filed an Omni Loop bug report; actor agent, each one sentence and one link, naming its fingerprint''s first 8 characters), checked (PRD 3001: a verdict of QA, role qa, actor agent, its round and its bugs'' issues in its sentence, linking its comment), budget-stop and budget-answer (PRD 3040: the supervisor recorded a budget stop, role supervisor, actor agent, naming whose cap and its value; a person answered it, actor their login), stuck, stuck-answer, milestone-retro, item-proposed and item-answered (PRD 3065: the supervisor found the mission stuck, sent its stuck repair or paused it by stuck, role supervisor, actor agent; a person resumed or stopped a mission paused by stuck, actor their login; a milestone retro was recorded, or skipped saying why, role supervisor, actor agent; a retro or a repair proposed a change to a rule, a law or a form, role supervisor, actor agent, naming its target; a person adopted or declined it, actor their login), bug-taken, bug-asked and bug-fixed (PRD 3088: the bug team sent a bug-fix job for an Omni Loop bug, set one aside on its question, or a bug a mission waited on was released fixed; role supervisor, actor agent, each one sentence naming the issue and its count or version, and one link, never a workspace, repository or login), or messaged (PRD 3107: a member sent a message to the fleet while the mission ran, role supervisor, actor the member''s login, a fixed sentence and message_id, never the message''s words).';

-- ── Who read it ─────────────────────────────────────────────────────────────────

create table if not exists public.fleet_message_reads (
  message_id uuid not null references public.fleet_messages (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  role       text not null check (role in ('pm', 'engineer', 'architect', 'qa', 'reviewer', 'supervisor')),
  job_id     uuid not null,
  read_at    timestamptz not null default now(),
  primary key (message_id, mission_id, role)
);

create index if not exists fleet_message_reads_job_idx on public.fleet_message_reads (job_id);

comment on table public.fleet_message_reads is
  'Which runner job of which role read a fleet message, for which mission (PRD 3107): one row per message, mission and role, written by commander_claim_messages() as the job is claimed.';
comment on column public.fleet_message_reads.job_id is 'The runner job that read it: a job of public.runner_jobs, kept even once that job is gone.';

-- ── Who reads and writes them ───────────────────────────────────────────────────

alter table public.fleet_messages enable row level security;
alter table public.fleet_message_reads enable row level security;

drop policy if exists "a member reads their workspace's fleet messages" on public.fleet_messages;
create policy "a member reads their workspace's fleet messages" on public.fleet_messages
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

drop policy if exists "a member reads who read their workspace's fleet messages" on public.fleet_message_reads;
create policy "a member reads who read their workspace's fleet messages" on public.fleet_message_reads
  for select to authenticated
  using (message_id in (select f.id from public.fleet_messages f where f.workspace_id in (select public.my_workspaces())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in writes the tables:
-- commander_send() writes the message, commander_claim_messages() the receipts, both as their owner.
revoke all on public.fleet_messages, public.fleet_message_reads from public, anon, authenticated, service_role;
grant select on public.fleet_messages, public.fleet_message_reads to authenticated;

-- A member tells their fleet, as themselves.
create or replace function public.commander_send(p_workspace uuid, p_fleet text, p_text text) returns public.fleet_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  v_text text := btrim(coalesce(p_text, ''));
  v_login text;
  made   public.fleet_messages;
begin
  if caller is null or p_workspace is null or p_workspace not in (select public.my_workspaces()) then
    raise exception 'Only a member of the workspace messages its fleet.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.teams t where t.workspace_id = p_workspace and t.name = p_fleet and t.kind = 'virtual') then
    raise exception 'Fleet: not a virtual fleet of this workspace.' using errcode = '22023', hint = 'fleet';
  end if;
  if char_length(v_text) not between 1 and 2000 then
    raise exception 'Message: 1 to 2000 characters.' using errcode = '22023', hint = 'text';
  end if;
  v_login := public.member_login(p_workspace, caller);
  insert into public.fleet_messages (workspace_id, fleet, author_id, author_login, body)
  values (p_workspace, p_fleet, caller, v_login, v_text)
  returning * into made;
  -- One event per running mission of the fleet, linking to the message and holding none of its words.
  insert into public.mission_events (mission_id, role, actor, kind, sentence, message_id)
  select m.id, 'supervisor', (case when v_login ~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$' then v_login else 'member' end), 'messaged', 'Sent a message to the fleet.', made.id
    from public.missions m
   where m.workspace_id = p_workspace and m.fleet = p_fleet and m.status = 'running';
  return made;
end;
$$;

-- ── What a job's claim carries ──────────────────────────────────────────────────

-- The role a mission job plays, read from its key (runner_jobs_mission_key_shape): the Reviewer's job of a round, QA's, the
-- committee's, the PM's, the Engineer's run, fix or bug fix; the supervisor's jobs (repair, stuck, retro, bug) the rest.
create or replace function public.mission_job_role(p_key text) returns text
language sql immutable
set search_path = ''
as $$
  select case
    when p_key ~ ':review:[12]$' then 'reviewer'
    when p_key ~ ':qa:[12]$' then 'qa'
    when p_key ~ ':approve:[0-9]+$' then 'architect'
    when p_key ~ ':pm:[0-9]+$' then 'pm'
    when p_key ~ ':run:[0-9]+$' or p_key ~ ':fix:1$' or p_key ~ ':qa-fix:1:[1-5]$' then 'engineer'
    else 'supervisor'
  end
$$;

-- The fleet messages job `p_job` carries: those its mission was told that its role had not read yet, oldest first. This job
-- becomes their reader. A job of no mission, or one that does not exist, carries none.
create or replace function public.commander_claim_messages(p_job uuid) returns table (id uuid, author_login text, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  j public.runner_jobs;
  r text;
begin
  select * into j from public.runner_jobs x where x.id = p_job;
  if j.id is null or j.mission_id is null then
    return;
  end if;
  r := public.mission_job_role(j.mission_key);
  insert into public.fleet_message_reads (message_id, mission_id, role, job_id)
  select e.message_id, j.mission_id, r, j.id
    from public.mission_events e
   where e.mission_id = j.mission_id and e.kind = 'messaged'
  on conflict (message_id, mission_id, role) do nothing;
  return query
  select m.id, m.author_login, m.body, m.created_at
    from public.fleet_message_reads x
    join public.fleet_messages m on m.id = x.message_id
   where x.mission_id = j.mission_id and x.role = r and x.job_id = j.id
   order by m.created_at, m.id;
end;
$$;

-- ── Kept 90 days (L-GDPR-4) ─────────────────────────────────────────────────────

-- As 20270128090000_fleet_commander.sql, with the fleet messages added: deletes the Commander's messages and the fleet
-- messages written more than 90 days ago (a reply with its question, a fleet message with its events and receipts), and
-- answers how many it deleted in all.
create or replace function public.commander_messages_forget() returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.commander_messages m where m.created_at < now() - interval '90 days'
    returning 1
  ), told as (
    delete from public.fleet_messages f where f.created_at < now() - interval '90 days'
    returning 1
  )
  select ((select count(*) from gone) + (select count(*) from told))::integer
$$;

comment on function public.commander_messages_forget() is
  'PRD 3107 (L-GDPR-4): deletes the Commander messages and the fleet messages written more than 90 days ago, and answers how many. pg_cron runs it every hour; the service role''s only otherwise.';

-- ── Who calls what ──────────────────────────────────────────────────────────────

revoke execute on function public.fleet_messages_keep() from public, anon, authenticated;
revoke execute on function public.commander_send(uuid, text, text) from public, anon;
grant execute on function public.commander_send(uuid, text, text) to authenticated;
revoke execute on function public.mission_job_role(text) from public, anon;
grant execute on function public.mission_job_role(text) to authenticated, service_role;
revoke execute on function public.commander_claim_messages(uuid) from public, anon, authenticated;
grant execute on function public.commander_claim_messages(uuid) to service_role;
revoke execute on function public.commander_messages_forget() from public, anon, authenticated;
grant execute on function public.commander_messages_forget() to service_role;
