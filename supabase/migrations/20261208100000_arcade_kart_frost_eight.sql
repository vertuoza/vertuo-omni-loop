-- OMNI KART's second circuit has its own board (PRD 1923): submit_score() accepts `kart-frost-eight`.
--
-- FROST EIGHT's race times go to the board `kart-frost-eight`, which keeps the lowest time like `kart`
-- does. The board is open to a player who has `kart` unlocked: it is not a game of its own, so there is
-- no `kart-frost-eight` in player_xp.unlocked and the unlock check reads `kart` for it. The function
-- replaces the one of 20261201090000_arcade_kart_times.sql; the signature and return do not change, so
-- supabase/database.types.ts stays as it is. No row is deleted or rewritten: COMET RING's times on
-- `kart` stay as they are.
--
-- The list of lowest-wins boards lives twice: here, and as the time boards of the arcade's registry
-- (apps/galaxy/src/arcade/games/index.ts); measure.guard.test.ts fails the build when they differ.
--
-- Rollback: a migration that restores today's function, the one of 20261201090000_arcade_kart_times.sql
-- (lowest_wins := array['kart'], the unlock check on the game itself). The rows on `kart-frost-eight`
-- stay, read by nothing.
--
-- Every grant below is explicit: revoked first, then granted, as the migration that created the
-- function states it.

create or replace function public.submit_score(workspace uuid, game text, score integer) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  lowest_wins constant text[] := array['kart', 'kart-frost-eight'];
  lower_is_better constant boolean := submit_score.game = any (lowest_wins);
  -- The cabinet a board is played on: FROST EIGHT's board is unlocked with the kart.
  unlock constant text := case when submit_score.game = 'kart-frost-eight' then 'kart' else submit_score.game end;
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
       and unlock = any (x.unlocked)
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
