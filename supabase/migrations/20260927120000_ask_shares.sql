-- Question history, step 4 (PRD 144, docs: .omni-loop/delivery/inbox/0144-question-history/spec.md):
-- a live question can be shared with a member of the session's workspace, and the first answer wins.
--
-- The session's owner shares one of its rounds with a member of its workspace. That member may then
-- answer the round on the page, only while it is still open, exactly as the owner may: whoever writes
-- first moves it to answered, and the round's guard (and the update's own `status = 'open'` condition)
-- keeps every later answer out. Every member of the workspace already reads the round (step 2); a
-- share adds only the right to answer it.
--
-- Nobody writes ask_shares directly: ask_round_share() does, checking who calls it and with whom.
--
-- Rollback: drop the policy "a member answers an open round shared with them", the functions below and
-- the table. Nothing else changes.

create table public.ask_shares (
  round_id    uuid not null references public.ask_rounds (id) on delete cascade,
  shared_with uuid not null references auth.users (id) on delete cascade,
  shared_by   uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (round_id, shared_with)
);

comment on table public.ask_shares is
  'A round shared by its session''s owner with a member of the session''s workspace, who may answer it while it is open. Written only by ask_round_share().';

create index ask_shares_shared_with_idx on public.ask_shares (shared_with, created_at desc);

-- ── Helpers, each reading past row-level security, each answering only about the caller ──────

-- True when `round` is shared with the caller and the caller still belongs to its session's workspace.
-- The answer rule on ask_rounds calls it; reading ask_shares from inside that rule directly would
-- make the two tables' rules call each other.
create function public.ask_shared_with_me(round uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.ask_shares sh
      join public.ask_rounds r on r.id = sh.round_id
      join public.ask_sessions s on s.id = r.session_id
     where sh.round_id = round
       and sh.shared_with = (select auth.uid())
       and public.is_member(s.workspace_id))
$$;

-- The members of a workspace the caller belongs to, each with the arcade name they picked there (null
-- when they have not joined a fleet) and their email. Nothing for a workspace the caller is not in.
-- The Share button picks from it, and an answer names who gave it with it.
create function public.ask_members(workspace uuid)
returns table (user_id uuid, email text, name text)
language sql stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text, p.display_name
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    left join public.players p on p.workspace_id = m.workspace_id and p.user_id = m.user_id
   where m.workspace_id = workspace
     and public.is_member(workspace)
   order by coalesce(p.display_name, u.email::text)
$$;

-- The session's owner shares a round with another member of the session's workspace. True when the
-- round is shared with them (again: sharing twice is fine); false when the caller does not own the
-- round's session, the round does not exist, or `member` is the owner or not a member of the
-- workspace. Any status: a share of an answered or abandoned round only lets the member read it,
-- which they already may.
create function public.ask_round_share(p_round_id uuid, p_member uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  place uuid;
begin
  select s.workspace_id into place
    from public.ask_rounds r
    join public.ask_sessions s on s.id = r.session_id
   where r.id = p_round_id
     and s.owner = (select auth.uid())
     and public.is_member(s.workspace_id);
  if place is null or p_member is null or p_member = (select auth.uid()) then
    return false;
  end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = place and m.user_id = p_member) then
    return false;
  end if;
  insert into public.ask_shares (round_id, shared_with, shared_by)
  values (p_round_id, p_member, (select auth.uid()))
  on conflict do nothing;
  return true;
end;
$$;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.ask_shares enable row level security;

-- A share is read by the member it names, and by every member of the round's session's workspace (the
-- page says who a round is shared with).
create policy "a member reads the shares of their workspace's rounds" on public.ask_shares
  for select to authenticated
  using (shared_with = (select auth.uid()) or exists (
    select 1 from public.ask_rounds r join public.ask_sessions s on s.id = r.session_id
     where r.id = round_id and public.is_member(s.workspace_id)));

-- The answer rule. The owner's stays as it was ("a person answers the rounds of their own sessions").
-- A member a round is shared with answers it on the page, only while it is open: the moment anyone
-- answers it, this rule no longer reaches it.
create policy "a member answers an open round shared with them" on public.ask_rounds
  for update to authenticated
  using (status = 'open' and public.ask_shared_with_me(id))
  with check (status = 'answered' and answered_via = 'page' and public.ask_shared_with_me(id));

revoke all on public.ask_shares from anon, authenticated;
grant select on public.ask_shares to authenticated;

revoke execute on function public.ask_shared_with_me(uuid) from public, anon;
revoke execute on function public.ask_members(uuid) from public, anon;
revoke execute on function public.ask_round_share(uuid, uuid) from public, anon;
grant execute on function public.ask_shared_with_me(uuid) to authenticated;
grant execute on function public.ask_members(uuid) to authenticated;
grant execute on function public.ask_round_share(uuid, uuid) to authenticated;
