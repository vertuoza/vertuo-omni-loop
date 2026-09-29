-- The roster gains each member's arcade hero (PRD 652): the person chips draw a member's hero, tinted
-- in their fleet's colour, wherever the Omni app names them, and workspace_roster is the one member
-- read that already holds the login, the avatar and the fleet.
--
-- A changed return type cannot be replaced in place: the function is dropped and created again, with
-- the same body, the same `security definer`, the same is_member guard and the same grants
-- (20261007100000_dashboard_reads.sql), and `hero jsonb` as a sixth column: the player row's hero,
-- null with no player row. Never an email.
--
-- Rollback: it only adds a column, so the running app (which ignores it) keeps working; a follow-up
-- migration recreates the function without `hero`.

drop function public.workspace_roster(uuid);

create function public.workspace_roster(workspace uuid)
returns table (user_id uuid, name text, github_login text, avatar_url text, fleet text, hero jsonb)
language sql stable
security definer
set search_path = ''
as $$
  select m.user_id,
         coalesce(nullif(btrim(p.display_name), ''),
                  nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(btrim(u.raw_user_meta_data ->> 'name'), '')) as name,
         lower(coalesce(nullif(p.github_login, ''), (
           select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
             from auth.identities i
            where i.user_id = m.user_id and i.provider = 'github'
            order by i.created_at
            limit 1))) as github_login,
         nullif(u.raw_user_meta_data ->> 'avatar_url', '') as avatar_url,
         p.team as fleet,
         p.hero as hero
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    left join public.players p on p.workspace_id = m.workspace_id and p.user_id = m.user_id
   where m.workspace_id = workspace
     and public.is_member(workspace)
   order by m.joined_at, m.user_id
$$;

comment on function public.workspace_roster(uuid) is
  'Every member of the workspace (name, lower-case GitHub login, avatar, fleet, hero), for a caller who is a member; no email. The dashboards'' People tables (PRD 572) and the person chips (PRD 652).';

revoke execute on function public.workspace_roster(uuid) from public, anon;
grant execute on function public.workspace_roster(uuid) to authenticated;
