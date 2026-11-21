-- The two notebooks (PRD 3107 s4, docs: .omni-loop/delivery/inbox/3107-fleet-commander/spec.md, Solution "Long-term
-- memory: two notebooks", criteria AC-6, AC-7 and AC-8). It runs after 20270128091000_commander_messaged.sql, and builds on
-- 20270122093000_missions.sql (missions, mission_events), 20270128090000_fleet_commander.sql (the Commander's thread),
-- 20261125090000_approval_requests.sql (member_login()) and 20261207090000_rls_membership_once.sql (my_workspaces()).
--
-- - commander_notes: what a Virtual Fleet remembers, one line per row. A mission notebook's line (notebook `mission`) says
--   what one day of a running mission did, decided or got wrong; a fleet notebook's line (notebook `fleet`) carries what a
--   delivered or stopped mission taught to the fleet's next missions. Either names the mission it came from, its day, its
--   place in its batch (1 to 20) and the events it cites: 1 to 10 events of that mission, so of the same fleet. A line with
--   no event, or citing an event of another mission, is refused (23514). At most 300 characters, one line. A batch is
--   written once: a mission's day, or a mission's end, holds one batch (the unique index on notebook, mission, day and
--   place). Only the service role writes a line (the App's notebook job); nobody changes one.
-- - commander_note_delete(): the only way a line leaves the Commander's memory, as a member of its workspace: it records who
--   deleted it (their id and their login, as member_login() reads it) and when; the line stays, read as deleted. A line
--   deleted already answers as it was deleted. Anyone else 42501; a line that does not exist 22023, hint `note`.
--
-- Who reads: a member of the fleet's workspace reads both notebooks, deleted lines included; anyone else nothing
-- (BR-PRODUCT-29, L-GDPR-1). A line says what happened and cites its events: never a credential, a log excerpt or a
-- person's words (L-GDPR-2). A deleted account's deletions keep their login, its id set null (L-GDPR-3).
--
-- Laws kept: no answer is read or written (BR-PRODUCT-12); a member reads and deletes only their own workspace's lines
-- (BR-PRODUCT-29, BR-PRODUCT-63); no AI key is read or written (BR-PRODUCT-59); no membership, ask session or agent link is
-- read or written (BR-PRODUCT-28, 39, 64); no game ledger row is touched (N-PRODUCT-16).
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/commander_notes.sql.
-- Rollback: a follow-up migration drops commander_note_delete(), the trigger functions and commander_notes. Nothing else
-- reads them.

-- ── The notebooks ───────────────────────────────────────────────────────────────

create table if not exists public.commander_notes (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  fleet         text not null,
  notebook      text not null check (notebook in ('mission', 'fleet')),
  mission_id    uuid not null references public.missions (id) on delete cascade,
  day           date not null,
  place         smallint not null check (place between 1 and 20),
  line          text not null check (char_length(line) between 1 and 300 and line !~ '[\r\n]'),
  events        uuid[] not null check (cardinality(events) between 1 and 10),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  deleted_by    uuid references auth.users (id) on delete set null,
  deleted_login text check (deleted_login is null or char_length(deleted_login) between 1 and 200),
  constraint commander_notes_deleted check ((deleted_at is null) = (deleted_login is null)),
  foreign key (workspace_id, fleet) references public.teams (workspace_id, name) on update cascade on delete cascade
);

-- One batch per mission's day, and one per mission's end: a replay writes nothing twice.
create unique index if not exists commander_notes_batch on public.commander_notes (notebook, mission_id, day, place);
create index if not exists commander_notes_fleet_idx on public.commander_notes (workspace_id, fleet, notebook, created_at desc);
create index if not exists commander_notes_mission_idx on public.commander_notes (mission_id, created_at desc);

comment on table public.commander_notes is
  'A Virtual Fleet''s two notebooks (PRD 3107): a mission notebook''s lines (what a day of a running mission did, decided or got wrong) and the fleet notebook''s (what a delivered or stopped mission taught the fleet), each citing its events. Read by the workspace''s members, written by the service role (the App''s notebook job), deleted by a member through commander_note_delete().';
comment on column public.commander_notes.notebook is 'mission (the mission notebook of mission_id) or fleet (the fleet''s notebook, a line learned from mission_id when it ended).';
comment on column public.commander_notes.mission_id is 'The mission the line comes from: every event it cites is one of this mission''s.';
comment on column public.commander_notes.day is 'The day the line is about: the events'' day for a mission line, the day the mission''s end was read for a fleet line (UTC).';
comment on column public.commander_notes.place is 'The line''s place in its batch, 1 to 20: a batch is written once.';
comment on column public.commander_notes.line is 'At most 300 characters, one line: what happened, never an instruction, a credential, a log excerpt or a person''s words.';
comment on column public.commander_notes.events is 'The mission_events the line cites, 1 to 10, all of mission_id: a line with none is refused.';
comment on column public.commander_notes.deleted_at is 'When a member deleted the line: it then leaves the Commander''s memory, and stays, read as deleted.';
comment on column public.commander_notes.deleted_login is 'Who deleted it, as member_login() read their login; kept when their account goes.';

-- A line cites events of its own mission (so of its fleet), of the fleet its mission belongs to; nobody changes a line,
-- and a deletion is recorded once, by commander_note_delete().
create or replace function public.commander_notes_keep() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  m public.missions;
begin
  if tg_op = 'UPDATE' then
    -- A referential action (a fleet renamed, a deleting account set null) runs inside a trigger: it passes.
    if pg_trigger_depth() > 1 then
      return new;
    end if;
    if new.id is distinct from old.id or new.workspace_id is distinct from old.workspace_id or new.fleet is distinct from old.fleet
       or new.notebook is distinct from old.notebook or new.mission_id is distinct from old.mission_id or new.day is distinct from old.day
       or new.place is distinct from old.place or new.line is distinct from old.line or new.events is distinct from old.events
       or new.created_at is distinct from old.created_at or old.deleted_at is not null or new.deleted_at is null then
      raise exception 'A note is never changed: a member deletes it, once.' using errcode = '42501';
    end if;
    return new;
  end if;
  select * into m from public.missions x where x.id = new.mission_id;
  if m.id is null or m.workspace_id <> new.workspace_id or m.fleet <> new.fleet then
    raise exception 'A note comes from a mission of its own fleet.' using errcode = '23514', hint = 'mission_id';
  end if;
  if new.deleted_at is not null then
    raise exception 'A note is written whole: a member deletes it later.' using errcode = '23514', hint = 'deleted_at';
  end if;
  if cardinality(new.events) is distinct from (select count(distinct e) from unnest(new.events) e)
     or exists (select 1 from unnest(new.events) e
                 where not exists (select 1 from public.mission_events x where x.id = e and x.mission_id = new.mission_id)) then
    raise exception 'A note cites at least one event of its mission, each once.' using errcode = '23514', hint = 'events';
  end if;
  return new;
end;
$$;

drop trigger if exists commander_notes_keep on public.commander_notes;
create trigger commander_notes_keep
  before insert or update on public.commander_notes
  for each row execute function public.commander_notes_keep();

-- ── Who reads and writes them ───────────────────────────────────────────────────

alter table public.commander_notes enable row level security;

drop policy if exists "a member reads their workspace's notebooks" on public.commander_notes;
create policy "a member reads their workspace's notebooks" on public.commander_notes
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in writes the table:
-- the service role adds the lines, commander_note_delete() records a deletion as its owner.
revoke all on public.commander_notes from public, anon, authenticated, service_role;
grant select on public.commander_notes to authenticated;
grant select, insert on public.commander_notes to service_role;

-- A member deletes a line of their workspace's notebooks, as themselves: it leaves the Commander's memory, and the record
-- keeps who deleted it and when.
create or replace function public.commander_note_delete(p_note uuid) returns public.commander_notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  n      public.commander_notes;
begin
  select * into n from public.commander_notes x where x.id = p_note;
  if caller is null or (n.id is not null and n.workspace_id not in (select public.my_workspaces())) then
    raise exception 'Only a member of the workspace deletes a line of its notebooks.' using errcode = '42501';
  end if;
  if n.id is null then
    raise exception 'Note: no such line.' using errcode = '22023', hint = 'note';
  end if;
  if n.deleted_at is not null then
    return n;
  end if;
  update public.commander_notes x
     set deleted_at = now(), deleted_by = caller, deleted_login = coalesce(public.member_login(n.workspace_id, caller), 'a member')
   where x.id = p_note
  returning * into n;
  return n;
end;
$$;

-- ── Who calls what ──────────────────────────────────────────────────────────────

revoke execute on function public.commander_notes_keep() from public, anon, authenticated;
revoke execute on function public.commander_note_delete(uuid) from public, anon;
grant execute on function public.commander_note_delete(uuid) to authenticated;
