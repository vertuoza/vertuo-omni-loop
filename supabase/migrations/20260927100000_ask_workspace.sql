-- Question history, step 2 (PRD 144, docs: .omni-loop/delivery/inbox/0144-question-history/spec.md):
-- questions are kept for good, and the whole workspace reads them.
--
-- WIDENS ACCESS ON PURPOSE. Until now only the account that opened a session read it. From here, every
-- member of the session's workspace reads the session and its rounds, the ones already stored
-- included. Changing a session, asking and answering in it stay its owner's; only the owner deletes
-- it. An account of another workspace, or of none, still reads nothing (supabase/checks/ask.sql).
--
-- Rollback: a follow-up migration restores PRD 100's rules (owner only); workspace_id may stay.

-- ── A session belongs to a workspace ────────────────────────────────────────────

alter table public.ask_sessions
  add column workspace_id uuid references public.workspaces (id) on delete cascade;

comment on column public.ask_sessions.workspace_id is
  'The workspace whose members read the session and its rounds. Set when it opens (ask_session_workspace()), never sent.';

create index ask_sessions_workspace_idx on public.ask_sessions (workspace_id, created_at desc);

-- The workspace a session of `person` opens in: among the workspaces they belong to, the one whose
-- github_org owns `repo` (owner/name), and otherwise the one they joined first. Null when they belong
-- to none.
create function public.ask_session_workspace(person uuid, repo text) returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select m.workspace_id
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
   where m.user_id = person
   order by (w.github_org is not null and lower(w.github_org) = lower(split_part(coalesce(repo, ''), '/', 1))) desc,
            m.joined_at, w.slug
   limit 1
$$;

-- Nobody sends a session's workspace: the database picks it as the session opens.
create function public.ask_sessions_place() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.workspace_id := public.ask_session_workspace(new.owner, new.repo);
  return new;
end;
$$;

create trigger ask_sessions_place
  before insert on public.ask_sessions
  for each row execute function public.ask_sessions_place();

-- Sessions opened before this step: by their repo when they carry one, else their owner's first
-- workspace. An owner in no workspace leaves it null, and nobody reads it.
update public.ask_sessions s set workspace_id = public.ask_session_workspace(s.owner, s.repo);

revoke execute on function public.ask_session_workspace(uuid, text) from public, anon, authenticated;
revoke execute on function public.ask_sessions_place() from public, anon, authenticated;

-- ── Who may do what ─────────────────────────────────────────────────────────────

-- Reading: every member of the session's workspace. Opening: as oneself, into a workspace one belongs
-- to. Keeping, closing and deleting: the owner. Asking and answering: the owner (sharing a round with
-- another member comes in a later step).
alter policy "a person sees their own ask sessions" on public.ask_sessions
  using (public.is_member(workspace_id));
alter policy "a person sees their own ask sessions" on public.ask_sessions
  rename to "a member reads the ask sessions of their workspace";

alter policy "a person opens ask sessions as themself" on public.ask_sessions
  with check (owner = (select auth.uid()) and workspace_id is not null and public.is_member(workspace_id));

alter policy "a person keeps and closes their own ask sessions" on public.ask_sessions
  using (owner = (select auth.uid()) and public.is_member(workspace_id))
  with check (owner = (select auth.uid()));

create policy "a person deletes their own ask sessions" on public.ask_sessions
  for delete to authenticated
  using (owner = (select auth.uid()));

alter policy "a person sees the rounds of their own sessions" on public.ask_rounds
  using (exists (
    select 1 from public.ask_sessions s where s.id = session_id and public.is_member(s.workspace_id)));
alter policy "a person sees the rounds of their own sessions" on public.ask_rounds
  rename to "a member reads the ask rounds of their workspace";

-- A session's rounds go with it (on delete cascade); nobody deletes a round alone.
grant delete on public.ask_sessions to authenticated;

-- ── Kept for good ───────────────────────────────────────────────────────────────

-- A closed session is no longer removed. The hourly job now only closes a session idle for 12 hours,
-- dated when it read as closed, and deletes nothing.

-- Closing stamps the moment it closed, unless the update names that moment itself (the sweep does).
create or replace function public.ask_sessions_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'closed' and new.status = 'open' then
    raise exception 'This ask session is closed. Switch ask mode on again for a new one.' using errcode = 'check_violation';
  end if;
  if old.status = 'open' and new.status = 'closed' and new.last_seen_at is not distinct from old.last_seen_at then
    new.last_seen_at := now();
  end if;
  return new;
end;
$$;

select cron.unschedule('ask-expire');
drop function public.ask_expire();

-- Closes every open session with no call for 12 hours, as of the moment it read as closed. Returns how
-- many it closed. Touches only ask_sessions, and removes nothing.
create function public.ask_sweep() returns integer
language sql
set search_path = ''
as $$
  with swept as (
    update public.ask_sessions s
       set status = 'closed', last_seen_at = s.last_seen_at + interval '12 hours'
     where s.status = 'open' and s.last_seen_at < now() - interval '12 hours'
    returning 1
  )
  select count(*)::integer from swept
$$;

revoke execute on function public.ask_sweep() from public, anon, authenticated;

select cron.schedule('ask-sweep', '17 * * * *', 'select public.ask_sweep()');

comment on table public.ask_sessions is
  'Ask mode, one per checkout while it is on. Every member of its workspace reads it. A session with no call for 12 hours reads as closed, and ask_sweep() closes it. Kept until its owner deletes it.';
