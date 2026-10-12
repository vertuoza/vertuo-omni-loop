-- Every answered question pays, PRD or not.
--
-- PRD 1180 paid an answered ask round only when it belonged to a numbered PRD. Measured on production
-- on 2026-10-08, that left about 420 of 1,300 answered rounds unpaid (ad-hoc work, fixes, spikes and
-- unnumbered drafts), every one of some people's answers among them.
--
-- 1. public.game_answered_rounds(workspace, since) now returns every answered round whose answerer
--    has a login. A round no PRD claims comes back with `prd` null and its home the repository its ask
--    session names (`owner/name`, or a bare name in the workspace's organisation), else the workspace's
--    plan repository. Rounds a PRD claims read exactly as before.
-- 2. public.ledger_events.planet takes 0 for a QUESTION_ANSWERED: an answer that belongs to no PRD.
--    Planet 0 is never a planet: the map and the season's planets leave it out.
--
-- Rollback: a follow-up migration restores the function from 20261109090000_game_answered_rounds.sql.
-- Rows already written stay (the ledger is append-only); RULEBOOK.questionAnswered = 0 stops them paying.

alter table public.ledger_events drop constraint ledger_events_planet_check;
alter table public.ledger_events add constraint ledger_events_planet_check
  check (planet > 0 or (planet = 0 and type = 'QUESTION_ANSWERED'));

create or replace function public.game_answered_rounds(workspace uuid, since timestamptz)
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
  -- A round no PRD claims still pays (prd null), its home the repository it was asked in, else the
  -- workspace's plan repository.
  select a.id, a.answered_at, c.prd,
         lower(coalesce(c.home_repo,
                        case when a.repo like '%/%' then a.repo when a.repo is not null then ws.github_org || '/' || a.repo end,
                        ws.github_org || '/' || ws.plan_repo)),
         l.login
    from answered a
    join public.workspaces ws on ws.id = workspace
    left join chosen c on c.id = a.id
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
  'The workspace''s ask rounds answered since `since`, each with its PRD (the brainstorm rule, else the delivery rule, over numbered PRD dossiers; null when none claims it), its home (that PRD''s, else the round''s repository, else the plan repository) and the answerer''s lower-case GitHub login; none without a login. The game''s read, for the service role only.';

revoke execute on function public.game_answered_rounds(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.game_answered_rounds(uuid, timestamptz) to service_role;
