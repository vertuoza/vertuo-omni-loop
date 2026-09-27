-- PRD dossiers, step 3 (PRD 216, docs: .omni-loop/delivery/inbox/0216-prd-dossiers/spec.md): the
-- questions that shaped a PRD, read beside its dossier. No question is copied or rewritten: the rounds
-- stay PRD 144's, and dossier_rounds() finds a dossier's own when it is read, by two rules.
--
-- 1. brainstorm: a round whose ask session carries the dossier's Claude session, asked once the dossier
--    was opened and before that Claude session opened its next dossier. A draft merged into the
--    fallback's dossier keeps the draft's opening (the dossiers migration), so the window opens there.
-- 2. delivery: a round whose `prd` is the dossier's number and whose ask session's repository is the
--    dossier's home repository (in any case: the dossier keeps it in lower case).
--
-- Each round comes back with the rule that brought it; a round both rules match comes back once, as
-- brainstorm. Both rules look only at the dossier's own workspace: its ask sessions, and its dossiers
-- for the end of the brainstorm window. Every member of the workspace then reads the same rounds, and
-- a member of two workspaces never sees one workspace's rounds on the other's dossier.
--
-- Security invoker, so nothing here widens what anyone reads: the caller's own row-level security
-- decides, as PRD 144 wrote it. Someone who cannot read the dossier gets no round; a round the caller
-- cannot read never comes back (supabase/checks/dossiers.sql).
--
-- Rollback: a follow-up migration drops the function and the two indexes. Nothing else changes.

-- The two lookups the rules make: the ask sessions of a Claude session, and the rounds of a PRD.
create index ask_sessions_claude_session_idx on public.ask_sessions (claude_session_id) where claude_session_id is not null;
create index ask_rounds_prd_idx on public.ask_rounds (prd) where prd is not null;

-- The rounds of `p_dossier`, in the order they were asked, each with its rule ('brainstorm' or
-- 'delivery'), its ask session's owner (who asked), repository and branch, and the round as PRD 144
-- keeps it: its questions exactly as AskUserQuestion took them, its answers, who answered and when, its
-- category and who set it. No row when the caller may not read the dossier.
create function public.dossier_rounds(p_dossier uuid)
returns table (
  rule         text,
  round_id     uuid,
  session_id   uuid,
  asked_by     uuid,
  repo         text,
  branch       text,
  questions    jsonb,
  answers      jsonb,
  status       text,
  answered_via text,
  answered_by  uuid,
  category     text,
  category_by  text,
  prd          integer,
  skill        text,
  created_at   timestamptz,
  answered_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with dossier as (
    select d.id, d.workspace_id, d.home_repo, d.prd, d.claude_session_id, d.created_at,
           coalesce((
             select min(n.created_at)
               from public.dossiers n
              where n.workspace_id = d.workspace_id
                and n.claude_session_id = d.claude_session_id
                and n.created_at > d.created_at
           ), 'infinity'::timestamptz) as window_end
      from public.dossiers d
     where d.id = p_dossier
  ),
  brainstorm as (
    select r.id
      from dossier d
      join public.ask_sessions s on s.workspace_id = d.workspace_id and s.claude_session_id = d.claude_session_id
      join public.ask_rounds r on r.session_id = s.id
     where r.created_at >= d.created_at
       and r.created_at < d.window_end
  ),
  delivery as (
    select r.id
      from dossier d
      join public.ask_sessions s on s.workspace_id = d.workspace_id and lower(s.repo) = d.home_repo
      join public.ask_rounds r on r.session_id = s.id and r.prd = d.prd
     where not exists (select 1 from brainstorm b where b.id = r.id)
  ),
  matched as (
    select b.id, 'brainstorm'::text as rule from brainstorm b
    union all
    select v.id, 'delivery'::text from delivery v
  )
  select m.rule, r.id, s.id, s.owner, s.repo, s.branch, r.questions, r.answers, r.status, r.answered_via,
         r.answered_by, r.category, r.category_by, r.prd, r.skill, r.created_at, r.answered_at
    from matched m
    join public.ask_rounds r on r.id = m.id
    join public.ask_sessions s on s.id = r.session_id
   order by r.created_at, r.id
$$;

comment on function public.dossier_rounds(uuid) is
  'The rounds that shaped a dossier: brainstorm (its Claude session, from its opening to that session''s next dossier) and delivery (its PRD number in its home repository), in its own workspace. Security invoker: PRD 144''s access rules decide.';

revoke execute on function public.dossier_rounds(uuid) from public, anon;
grant execute on function public.dossier_rounds(uuid) to authenticated;
