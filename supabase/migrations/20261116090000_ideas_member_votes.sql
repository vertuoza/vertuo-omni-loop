-- Members vote on their own private ideas board (PRD 1258, s1, docs:
-- .omni-loop/delivery/inbox/1258-members-vote-private-board/spec.md; bug #1257).
--
-- idea_votable() decides whether an idea takes or loses a vote; the insert and delete policies on
-- idea_votes call it. It was true only on a public board, so a member pressing ▲ on their own private
-- board was always refused. Now an idea takes or loses a vote when it is not archived and either its
-- board is public or the caller is a member of the idea's workspace. Votes cast while the board is
-- private are the same rows, one per (idea, account), and stay counted once it goes public.
--
-- The signature, the policies, the tables and the grants are unchanged (proven by
-- supabase/checks/ideas.sql).
--
-- Rollback: a follow-up migration restoring the old body, true only for an idea of a public board
-- that is not archived:
--   select exists (select 1 from public.ideas i
--     join public.repositories r on r.workspace_id = i.workspace_id and r.full_name = i.repo
--    where i.id = p_idea and r.public_ideas and not i.archived)
-- Votes cast meanwhile stay, and still count.

-- True when the idea can take or lose a vote: not archived, and on a public board or of the caller's
-- own workspace.
create or replace function public.idea_votable(p_idea uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ideas i
      join public.repositories r on r.workspace_id = i.workspace_id and r.full_name = i.repo
     where i.id = p_idea and not i.archived and (r.public_ideas or public.is_member(i.workspace_id))
  )
$$;
