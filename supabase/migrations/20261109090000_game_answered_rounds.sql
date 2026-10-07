-- Every answered question earns points (PRD 1180, spec:
-- .omni-loop/delivery/inbox/1180-answers-earn-points/spec.md).
--
-- 1. public.ledger_events.type takes one more value, QUESTION_ANSWERED: an ask round answered on a
--    numbered PRD. The projector writes one per round, id `ask:<round_id>:answered`, dated when it was
--    answered, and the economy pays its answerer RULEBOOK.questionAnswered.
-- 2. public.game_answered_rounds(workspace, since): the game's read of those rounds, for the service
--    role only (the hourly game workflow). For each round of the workspace's ask sessions answered at
--    or after `since`, it returns the round, when it was answered, the PRD it belongs to, that PRD's
--    home repository and the answerer's GitHub login, both in lower case.
--
--    The PRD is found by the two rules dossier_rounds() uses (20260928100000_dossier_rounds.sql), over
--    the workspace's numbered PRD dossiers only (kind `prd`, a number):
--    - brainstorm: the round's ask session carries the dossier's Claude session, and the round was
--      asked once the dossier was opened and before that Claude session opened its next dossier;
--    - delivery: the round's own `prd` is the dossier's number, and its ask session's repository is
--      the dossier's home repository (in any case).
--    A round both rules match takes the brainstorm rule's PRD. A draft dossier (no number yet) gives
--    no PRD, so a brainstorm's answers pay once its dossier is numbered.
--
--    The login is the one the workspace roster shows (workspace_roster(), 20261013090000): the
--    answerer's player login, else their linked GitHub identity's, lower case, for a member of the
--    workspace. A round with no PRD, or whose answerer has no login, is not returned.
--
-- Security definer, so it reads auth.identities, and executable by the service role alone: it names
-- who answered what, across the workspace (supabase/checks/game_answered_rounds.sql).
--
-- Rollback: a follow-up migration drops the function. The type stays allowed: the ledger is
-- append-only, so a QUESTION_ANSWERED row once written stays, and RULEBOOK.questionAnswered = 0 stops
-- it paying.

alter table public.ledger_events drop constraint ledger_events_type_check;
alter table public.ledger_events add constraint ledger_events_type_check check (type in (
  'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
  'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
  'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
  'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
  'QUESTION_ANSWERED'));

create function public.game_answered_rounds(workspace uuid, since timestamptz)
returns table (round_id uuid, answered_at timestamptz, prd integer, home text, login text)
language sql
stable
security definer
set search_path = ''
as $$
  with
  -- The workspace's rounds answered since `since`.
  answered as (
    select r.id, r.answered_at, r.answered_by, r.prd, r.created_at, s.claude_session_id, lower(s.repo) as repo
      from public.ask_rounds r
      join public.ask_sessions s on s.id = r.session_id
     where s.workspace_id = workspace
       and r.status = 'answered'
       and r.answered_at is not null
       and r.answered_at >= since
  ),
  -- Every dossier of the workspace opened in a Claude session, with the end of its brainstorm window:
  -- that Claude session's next dossier in the workspace (none: open-ended), drafts and fixes included,
  -- as dossier_rounds() reads it.
  windows as (
    select d.id, d.kind, d.prd, d.home_repo, d.claude_session_id, d.created_at,
           coalesce((
             select min(n.created_at)
               from public.dossiers n
              where n.workspace_id = d.workspace_id
                and n.claude_session_id = d.claude_session_id
                and n.created_at > d.created_at
           ), 'infinity'::timestamptz) as window_end
      from public.dossiers d
     where d.workspace_id = workspace
       and d.claude_session_id is not null
  ),
  matched as (
    -- Brainstorm, first.
    select a.id, w.prd, w.home_repo, 1 as rule
      from answered a
      join windows w on w.claude_session_id = a.claude_session_id
     where a.created_at >= w.created_at
       and a.created_at < w.window_end
       and w.kind = 'prd'
       and w.prd is not null
    union all
    -- Delivery: the round's own PRD, asked in that PRD's home repository.
    select a.id, d.prd, d.home_repo, 2
      from answered a
      join public.dossiers d
        on d.workspace_id = workspace and d.kind = 'prd' and d.prd = a.prd and d.home_repo = a.repo
  ),
  chosen as (
    select distinct on (m.id) m.id, m.prd, m.home_repo
      from matched m
     order by m.id, m.rule, m.prd
  )
  select a.id, a.answered_at, c.prd, lower(c.home_repo), l.login
    from answered a
    join chosen c on c.id = a.id
    join public.workspace_members m on m.workspace_id = workspace and m.user_id = a.answered_by
    left join public.players p on p.workspace_id = workspace and p.user_id = a.answered_by
    cross join lateral (
      select lower(coalesce(nullif(p.github_login, ''), (
        select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
          from auth.identities i
         where i.user_id = a.answered_by and i.provider = 'github'
         order by i.created_at
         limit 1))) as login
    ) l
   where l.login is not null
   order by a.answered_at, a.id
$$;

comment on function public.game_answered_rounds(uuid, timestamptz) is
  'The workspace''s ask rounds answered since `since`, each with its PRD (the brainstorm rule, else the delivery rule, over numbered PRD dossiers), that PRD''s home and the answerer''s lower-case GitHub login; none without a PRD or a login. The game''s read (PRD 1180), for the service role only.';

revoke execute on function public.game_answered_rounds(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.game_answered_rounds(uuid, timestamptz) to service_role;
