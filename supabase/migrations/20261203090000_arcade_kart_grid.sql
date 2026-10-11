-- Who may join OMNI KART's live grid (PRD #1572): Realtime authorization for the topic kart:<workspace id>.
--
-- OMNI KART's MULTI race runs over one private Supabase Realtime channel per workspace, named
-- `kart:<workspace id>`: Broadcast carries the karts' states and items, Presence says who is on the grid.
-- A private channel is refused unless a policy on realtime.messages lets the caller receive (select) and
-- send (insert). Here that is the check submit_score() already makes (20261201090000_arcade_kart_times.sql):
-- the caller has a players row in the workspace, and `kart` is in that login's player_xp.unlocked there.
-- Every other join is refused: another workspace's player, a player who has not unlocked OMNI KART, a
-- signed-in user with no player row, and anon. The browser joins with the player's own session; no secret
-- key is used (ADR-0051).
--
-- The policies cover the `broadcast` and `presence` extensions on a topic that is exactly
-- `kart:<uuid>`; no other topic is opened by this migration. They call one function, kart_grid_allows(),
-- which holds the rule once. Nothing is written, moved or deleted: only policies and one function are
-- added, and submit_score() and arcade_scores are unchanged. A revert drops the policies, then the
-- function.
--
-- Every grant below is explicit: revoked first, then granted.

create function public.kart_grid_allows(p_topic text) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic ~ '^kart:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and auth.uid() is not null
     and exists (
       select 1
         from public.players p
         join public.player_xp x
           on x.workspace_id = p.workspace_id and x.github_login = lower(p.github_login)
        where p.workspace_id = substr(p_topic, 6)::uuid
          and p.user_id = auth.uid()
          and 'kart' = any (x.unlocked)
     );
$$;

revoke execute on function public.kart_grid_allows(text) from public, anon;
grant execute on function public.kart_grid_allows(text) to authenticated;

comment on function public.kart_grid_allows(text) is
  'True when the caller may join OMNI KART''s grid on this Realtime topic: it is kart:<workspace id>, the caller has a players row in that workspace, and kart is in their player_xp.unlocked there. The check submit_score() makes. Read by the policies on realtime.messages.';

create policy "a kart player receives on their workspace's grid" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence')
    and public.kart_grid_allows((select realtime.topic())));

create policy "a kart player sends on their workspace's grid" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence')
    and public.kart_grid_allows((select realtime.topic())));
