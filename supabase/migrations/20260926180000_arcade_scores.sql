-- Crew high scores (PRD #160): each player's best score at each arcade game, per workspace.
--
-- The arcade sends a finished game's score through submit_score(), the only way in. It checks that
-- the caller is a player of the workspace and that their player_xp row (written by the game
-- workflow, 20260926170000_game_room.sql) has the game unlocked, holds the score to 0..9,999,999,
-- and keeps the higher of the stored best and the score. A score is what the browser sends, within
-- the cap: a bragging right on its cabinet that never earns points or XP.
--
-- Scores cannot be rebuilt from the ledger, so the weekly backup (pnpm game:export) exports them.
--
-- Every grant below is explicit: revoked first, then granted, so the result is the same whether or
-- not the project grants new tables to the API roles by default (config.toml › auto_expose_new_tables).

create table public.arcade_scores (
  workspace_id uuid not null,
  user_id      uuid not null,
  game         text not null check (game ~ '^[a-z0-9-]{1,32}$'),
  best         integer not null check (best between 0 and 9999999),
  at           timestamptz not null default now(),
  primary key (workspace_id, user_id, game),
  -- A player's scores go with their player row, as the row goes with their membership.
  foreign key (workspace_id, user_id) references public.players (workspace_id, user_id) on delete cascade
);

-- The cabinet's top five: a game's best scores in a workspace, the earlier of two equal ones first.
create index arcade_scores_top_idx on public.arcade_scores (workspace_id, game, best desc, at);

comment on table public.arcade_scores is
  'Each player''s best score at each arcade game, per workspace. Written only by submit_score(), read by the workspace''s members, kept by the weekly backup.';
comment on column public.arcade_scores.game is
  'The game''s key, as in the rulebook''s xp.unlocks and in player_xp.unlocked: invaders.';
comment on column public.arcade_scores.at is 'When this best was set.';

alter table public.arcade_scores enable row level security;

create policy "a member reads their workspace's scores" on public.arcade_scores
  for select to authenticated using (public.is_member(workspace_id));

-- Posts a finished game's score for the caller, and returns their best at that game as stored. A
-- caller with no player row in the workspace (a visitor, a member of another workspace, anyone
-- signed out) and a game their player_xp row has not unlocked are refused (42501); a score outside
-- 0..9,999,999 too (22023). Parameters are named as the spec names them, so every column below is
-- qualified by its table, and each parameter by the function's name.
create function public.submit_score(workspace uuid, game text, score integer) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  login text;
  stored integer;
begin
  select p.github_login into login
    from public.players p
   where p.workspace_id = submit_score.workspace and p.user_id = me;
  if me is null or not found then
    raise exception 'Only a player of this workspace may post a score.' using errcode = '42501';
  end if;
  if submit_score.score is null or submit_score.score < 0 or submit_score.score > 9999999 then
    raise exception 'A score is a whole number from 0 to 9,999,999.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.player_xp x
     where x.workspace_id = submit_score.workspace
       and x.github_login = lower(login)
       and submit_score.game = any (x.unlocked)
  ) then
    raise exception 'The game % is not unlocked for this player yet.', submit_score.game using errcode = '42501';
  end if;
  insert into public.arcade_scores as s (workspace_id, user_id, game, best, at)
  values (submit_score.workspace, me, submit_score.game, submit_score.score, now())
  on conflict on constraint arcade_scores_pkey do update
    set best = greatest(s.best, excluded.best),
        at = case when excluded.best > s.best then excluded.at else s.at end
  returning s.best into stored;
  return stored;
end;
$$;

-- Nobody signed out reads a score; signed in, the rows above. Nobody writes the table directly: the
-- service role only reads it, for the weekly backup.
revoke all on public.arcade_scores from public, anon, authenticated, service_role;
grant select on public.arcade_scores to authenticated, service_role;

revoke execute on function public.submit_score(uuid, text, integer) from public, anon;
grant execute on function public.submit_score(uuid, text, integer) to authenticated;
