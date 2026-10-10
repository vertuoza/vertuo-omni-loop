-- OMNI KART keeps the best race time, not points (PRD #1440): submit_score() gets a direction per game.
--
-- A game's best is the highest score, except for the games listed in `lowest_wins` below, where it is
-- the lowest value: OMNI KART (`kart`) stores a race time in tenths of a second (1023 is 1:42.3), and
-- the fastest wins. For those games the function keeps least(stored, sent), for every other game
-- greatest(stored, sent) as before, and `at` moves only when the value improves in the game's
-- direction. The signature and return do not change, so supabase/database.types.ts stays as it is.
--
-- The list lives twice: here, and as `measure: 'time'` in the arcade's registry
-- (apps/galaxy/src/arcade/games/index.ts). measure.guard.test.ts fails the build when they differ.
--
-- The kart's point scores are deleted: points cannot become times. The weekly exports already made
-- keep them (pnpm game:export). A revert of this migration does not bring them back.
--
-- Every grant below is explicit: revoked first, then granted, as the migration that created the
-- function states it.

delete from public.arcade_scores where game = 'kart';

create or replace function public.submit_score(workspace uuid, game text, score integer) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  lowest_wins constant text[] := array['kart'];
  lower_is_better constant boolean := submit_score.game = any (lowest_wins);
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
    set best = case when lower_is_better then least(s.best, excluded.best) else greatest(s.best, excluded.best) end,
        at = case when (case when lower_is_better then excluded.best < s.best else excluded.best > s.best end)
                  then excluded.at else s.at end
  returning s.best into stored;
  return stored;
end;
$$;

revoke execute on function public.submit_score(uuid, text, integer) from public, anon;
grant execute on function public.submit_score(uuid, text, integer) to authenticated;

comment on column public.arcade_scores.best is
  'The best value at the game, in its direction: the highest score, or for kart the lowest race time in tenths of a second.';
