-- The public ideas board (PRD 1246, s1, docs: .omni-loop/delivery/inbox/1246-public-ideas-board/spec.md):
-- a board of ideas per repository, off by default, that anyone reads at /ideas/<owner>/<repo> once a
-- member of the repository's workspace turns it public, and that anyone signed in with GitHub votes on.
--
-- - repositories.public_ideas: the board's flag, off by default. At most one workspace makes a given
--   repository's board public, so /ideas/<owner>/<repo> names one board. Only a member of the
--   workspace switches it, through set_repository_public_ideas().
-- - ideas: one row per idea of a repository's board: its title (at most 120 characters), its pitch (one
--   paragraph, at most 600), its lane (now, next or later, set by a member), who added it and when, an
--   optional PRD number, and whether it is archived. Nothing deletes an idea: a member archives it.
-- - idea_votes: one row per (idea, account). The count is read through ideas_board(), never who voted.
-- - ideas_board(): the board as a page reads it, by owner/name: the ideas not archived, each with its
--   vote count and whether the caller voted for it, or null when the board is private (to anyone but a
--   member) or there is no such repository: the two answer the same.
--
-- Row-level security (proven by supabase/checks/ideas.sql):
-- - anyone (anon and authenticated) reads the ideas of a public board, never those of a private one; a
--   member also reads their own workspace's;
-- - a signed-in person reads, adds and removes only their own vote, one per (idea, account), on an idea
--   of a public board that is not archived;
-- - only a member of the repository's workspace adds or changes an idea, and switches the flag.
--
-- Rollback: a follow-up migration drops ideas_board(), set_repository_public_ideas(),
-- ideas_public_board(), idea_votes, ideas and repositories.public_ideas. Nothing else reads them.

-- ── The flag ─────────────────────────────────────────────────────────────────────

alter table public.repositories add column public_ideas boolean not null default false;

comment on column public.repositories.public_ideas is
  'Whether the repository''s ideas board is public at /ideas/<owner>/<repo> (PRD 1246). Off by default; a member of the workspace switches it through set_repository_public_ideas().';

-- One public board per owner/name, whichever workspace lists the repository.
create unique index repositories_public_ideas_key on public.repositories (full_name) where public_ideas;

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.ideas (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  repo         text not null,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  pitch        text not null check (char_length(btrim(pitch)) between 1 and 600),
  lane         text not null default 'later' check (lane in ('now', 'next', 'later')),
  added_by     uuid default auth.uid() references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  prd          integer check (prd is null or prd > 0),
  archived     boolean not null default false,
  foreign key (workspace_id, repo) references public.repositories (workspace_id, full_name) on delete cascade
);

create index ideas_board_idx on public.ideas (workspace_id, repo) where not archived;

comment on table public.ideas is
  'An idea of a repository''s board (PRD 1246). A member of the workspace adds and changes it; nobody deletes one, a member archives it. Anyone reads it while the board is public.';

create table public.idea_votes (
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index idea_votes_user_idx on public.idea_votes (user_id);

comment on table public.idea_votes is
  'One vote per idea and account (PRD 1246). A signed-in person adds and removes only their own, on a public board; the count is read through ideas_board().';

-- ── Who may read the board ───────────────────────────────────────────────────────

-- True when the repository's board is public. Security definer: anyone signed out reads no repository.
create function public.ideas_public_board(p_workspace uuid, p_repo text) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.repositories r
     where r.workspace_id = p_workspace and r.full_name = p_repo and r.public_ideas
  )
$$;

-- True when the idea can take or lose a vote: on a public board, and not archived.
create function public.idea_votable(p_idea uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ideas i
      join public.repositories r on r.workspace_id = i.workspace_id and r.full_name = i.repo
     where i.id = p_idea and r.public_ideas and not i.archived
  )
$$;

-- The board as a page reads it, by owner/name: null when there is no such repository, or when its
-- board is private and the caller is no member of a workspace listing it. Otherwise the board's
-- repository, whether it is public, whether the caller is a member, and its ideas not archived, each
-- with its vote count and whether the caller voted for it. The order is the page's to make.
create function public.ideas_board(p_full_name text) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  board public.repositories;
  member boolean;
begin
  -- The public board first; else a private one of the caller's own workspace.
  select r.* into board from public.repositories r where r.full_name = name and r.public_ideas;
  if not found then
    select r.* into board from public.repositories r
     where r.full_name = name and auth.uid() is not null and public.is_member(r.workspace_id)
     order by r.added_at
     limit 1;
    if not found then
      return null;
    end if;
  end if;
  member := auth.uid() is not null and public.is_member(board.workspace_id);
  return jsonb_build_object(
    'repo', board.full_name,
    'public', board.public_ideas,
    'member', member,
    'ideas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'title', i.title,
               'pitch', i.pitch,
               'lane', i.lane,
               'prd', i.prd,
               'created_at', i.created_at,
               'votes', (select count(*) from public.idea_votes v where v.idea_id = i.id),
               'voted', auth.uid() is not null
                        and exists (select 1 from public.idea_votes v where v.idea_id = i.id and v.user_id = auth.uid())
             ) order by i.created_at, i.id)
        from public.ideas i
       where i.workspace_id = board.workspace_id and i.repo = board.full_name and not i.archived
    ), '[]'::jsonb)
  );
end;
$$;

-- Switches a repository's board public or private. Only a member of its workspace; anyone else is
-- refused with 42501 and nothing changes.
create function public.set_repository_public_ideas(p_workspace uuid, p_full_name text, p_public boolean) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.repositories;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can make its ideas board public or private.' using errcode = '42501';
  end if;
  if p_public is null then
    raise exception 'Public: on or off.' using errcode = '22023', hint = 'public';
  end if;
  update public.repositories r
     set public_ideas = p_public
   where r.workspace_id = p_workspace and r.full_name = lower(btrim(coalesce(p_full_name, '')))
  returning * into changed;
  if not found then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  return changed;
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.ideas enable row level security;
alter table public.idea_votes enable row level security;

create policy "anyone reads the ideas of a public board" on public.ideas
  for select to anon, authenticated using (public.ideas_public_board(workspace_id, repo));
create policy "a member reads their workspace's ideas" on public.ideas
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member adds an idea to their workspace's board" on public.ideas
  for insert to authenticated with check (public.is_member(workspace_id) and added_by = (select auth.uid()));
create policy "a member changes their workspace's ideas" on public.ideas
  for update to authenticated using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));

create policy "a signed-in person reads their own votes" on public.idea_votes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "a signed-in person votes once on an idea of a public board" on public.idea_votes
  for insert to authenticated with check (user_id = (select auth.uid()) and public.idea_votable(idea_id));
create policy "a signed-in person takes back their own vote on a public board" on public.idea_votes
  for delete to authenticated using (user_id = (select auth.uid()) and public.idea_votable(idea_id));

-- Signed out: reads a public board's ideas. Signed in: also adds and changes ideas (a member, by the
-- policies) and their own votes; never deletes an idea, never changes a vote. The service role reads
-- everything.
revoke all on public.ideas, public.idea_votes from public, anon, authenticated, service_role;
grant select on public.ideas to anon, authenticated, service_role;
grant insert (workspace_id, repo, title, pitch, lane, prd) on public.ideas to authenticated;
grant update (title, pitch, lane, prd, archived) on public.ideas to authenticated;
grant select, insert (idea_id), delete on public.idea_votes to authenticated;
grant select on public.idea_votes to service_role;

revoke execute on function public.ideas_public_board(uuid, text) from public;
grant execute on function public.ideas_public_board(uuid, text) to anon, authenticated, service_role;
revoke execute on function public.idea_votable(uuid) from public, anon;
grant execute on function public.idea_votable(uuid) to authenticated, service_role;
revoke execute on function public.ideas_board(text) from public;
grant execute on function public.ideas_board(text) to anon, authenticated, service_role;
revoke execute on function public.set_repository_public_ideas(uuid, text, boolean) from public, anon;
grant execute on function public.set_repository_public_ideas(uuid, text, boolean) to authenticated;
