-- Ask mode (PRD 71, docs: .omni-loop/delivery/inbox/0071-ask-mode/spec.md). Claude's questions,
-- answered on a page. A session is one checkout's ask mode, switched on; a round is one
-- AskUserQuestion call: its questions exactly as the tool took them, its answers exactly as the tool
-- takes them back (question text → the chosen label, several joined with ", ", or the typed text).
-- Every row belongs to the account that opened the session. Asking needs no player row and no GitHub
-- link, nothing here is a ledger event, and nothing here touches the game's tables.

-- ── Sessions ─────────────────────────────────────────────────────────────────

create table public.ask_sessions (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  status       text not null default 'open' check (status in ('open', 'closed')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

comment on table public.ask_sessions is
  'Ask mode, one per checkout while it is on. A session with no call for 12 hours reads as closed; 7 days after it closes, ask_expire() removes it and its rounds.';
comment on column public.ask_sessions.last_seen_at is
  'The last call on the session or its rounds. Closing stamps it too, so it is also when a closed session closed.';

create index ask_sessions_owner_idx on public.ask_sessions (owner, created_at desc);

-- A closed session stays closed, and closing stamps the moment it closed.
create function public.ask_sessions_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'closed' and new.status = 'open' then
    raise exception 'This ask session is closed. Switch ask mode on again for a new one.' using errcode = 'check_violation';
  end if;
  if old.status = 'open' and new.status = 'closed' then
    new.last_seen_at := now();
  end if;
  return new;
end;
$$;

create trigger ask_sessions_guard
  before update on public.ask_sessions
  for each row execute function public.ask_sessions_guard();

-- ── Rounds ───────────────────────────────────────────────────────────────────

-- AskUserQuestion's `answers`: an object of question text → answer text, nothing else.
create function public.ask_answers_valid(a jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(a) = 'object'
    and not exists (select 1 from jsonb_each(a) e where jsonb_typeof(e.value) <> 'string')
$$;

create table public.ask_rounds (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.ask_sessions (id) on delete cascade,
  questions    jsonb not null check (case when jsonb_typeof(questions) = 'array' then jsonb_array_length(questions) > 0 else false end),
  answers      jsonb check (answers is null or public.ask_answers_valid(answers)),
  answered_via text check (answered_via in ('page', 'terminal')),
  status       text not null default 'open' check (status in ('open', 'answered', 'abandoned')),
  created_at   timestamptz not null default now(),
  answered_at  timestamptz,
  constraint ask_rounds_answered check ((status = 'answered') = (answers is not null) and (answers is null) = (answered_via is null))
);

comment on table public.ask_rounds is
  'One AskUserQuestion call. open → answered (on the page or in the terminal) or abandoned (the hook gave up; the terminal asks instead, and may still answer it). An answer is final.';

create index ask_rounds_session_idx on public.ask_rounds (session_id, created_at);

-- A round only moves forward, and an answer, once given, is final. An abandoned round has moved to
-- the terminal: only the terminal's answer may still be recorded on it.
create function public.ask_rounds_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    if new.answers is distinct from old.answers or new.answered_via is distinct from old.answered_via then
      raise exception 'This round is already %: its answer cannot change.', old.status using errcode = 'check_violation';
    end if;
  elsif not (
    old.status = 'open'
    or (old.status = 'abandoned' and new.status = 'answered' and new.answered_via = 'terminal')
  ) then
    raise exception 'An ask round cannot go from % to %.', old.status, new.status using errcode = 'check_violation';
  end if;
  new.answered_at := case
    when new.status = 'answered' and old.status <> 'answered' then now()
    else old.answered_at
  end;
  return new;
end;
$$;

create trigger ask_rounds_guard
  before update on public.ask_rounds
  for each row execute function public.ask_rounds_guard();

-- ── Who may do what ──────────────────────────────────────────────────────────

-- Only the account that opened a session sees it, keeps it alive, closes it, asks and answers in
-- it: `owner = auth.uid()` directly, or through the session. The crew only, like the galaxy.
alter table public.ask_sessions enable row level security;
alter table public.ask_rounds enable row level security;

create policy "a person sees their own ask sessions" on public.ask_sessions
  for select to authenticated using (owner = (select auth.uid()) and public.is_crew());
create policy "a person opens ask sessions as themself" on public.ask_sessions
  for insert to authenticated with check (owner = (select auth.uid()) and public.is_crew());
create policy "a person keeps and closes their own ask sessions" on public.ask_sessions
  for update to authenticated
  using (owner = (select auth.uid()) and public.is_crew())
  with check (owner = (select auth.uid()));

create policy "a person sees the rounds of their own sessions" on public.ask_rounds
  for select to authenticated
  using (public.is_crew() and exists (
    select 1 from public.ask_sessions s where s.id = session_id and s.owner = (select auth.uid())));
create policy "a person asks in their own open sessions" on public.ask_rounds
  for insert to authenticated
  with check (public.is_crew() and exists (
    select 1 from public.ask_sessions s where s.id = session_id and s.owner = (select auth.uid()) and s.status = 'open'));
create policy "a person answers the rounds of their own sessions" on public.ask_rounds
  for update to authenticated
  using (public.is_crew() and exists (
    select 1 from public.ask_sessions s where s.id = session_id and s.owner = (select auth.uid())))
  with check (exists (
    select 1 from public.ask_sessions s where s.id = session_id and s.owner = (select auth.uid())));

-- Explicit grants, and nothing more: projects created before 2026-05-30 still grant every new table
-- to the API roles by default, so everything is revoked first. Nobody signed in deletes: expiry does.
revoke all on public.ask_sessions, public.ask_rounds from anon, authenticated;
grant select on public.ask_sessions, public.ask_rounds to authenticated;
grant insert (title) on public.ask_sessions to authenticated;
grant update (status, last_seen_at) on public.ask_sessions to authenticated;
grant insert (session_id, questions) on public.ask_rounds to authenticated;
grant update (status, answers, answered_via) on public.ask_rounds to authenticated;

revoke execute on function public.ask_sessions_guard() from public, anon, authenticated;
revoke execute on function public.ask_rounds_guard() from public, anon, authenticated;
grant execute on function public.ask_answers_valid(jsonb) to anon, authenticated, service_role;

-- ── Expiry ───────────────────────────────────────────────────────────────────

-- The one scheduled function. A session goes, its rounds with it, 7 days after it closed: closed by
-- a call (last_seen_at is then when it closed), or read as closed after 12 hours without a call.
-- Returns how many sessions it removed.
create function public.ask_expire() returns integer
language sql
set search_path = ''
as $$
  with gone as (
    delete from public.ask_sessions s
     where (s.status = 'closed' and s.last_seen_at < now() - interval '7 days')
        or (s.status = 'open' and s.last_seen_at < now() - interval '12 hours' - interval '7 days')
    returning 1
  )
  select count(*)::integer from gone
$$;

revoke execute on function public.ask_expire() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('ask-expire', '17 * * * *', 'select public.ask_expire()');
