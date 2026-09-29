-- The dashboards' two reads (PRD 572): who is a member of a workspace, and how many questions each
-- member answered there. The boards of /app, /app/fleet and /app/workspace read them as the signed-in
-- person, beside the season's galaxy and the workspace's `contributions`.
--
-- Both are `security definer`, built like ask_members (20260927120000_ask_shares.sql): they read
-- tables the caller cannot read whole (auth.users, auth.identities, other people's ask rounds), and
-- each returns rows only when the caller is a member of the workspace asked for (is_member), and only
-- the columns named here: never an email, never a question or an answer, never a session.
--
-- Rollback: they only add, so they may stay when the app is reverted; `drop function` removes them.

-- Every member of a workspace, for the People tables: the name (the player's arcade name, else the
-- account's full name, else null), the GitHub login in lower case (the player's, else the account's
-- linked GitHub identity), the avatar the account carries, and the fleet (null with none, or with no
-- player row). Nothing for a workspace the caller is not in.
create function public.workspace_roster(workspace uuid)
returns table (user_id uuid, name text, github_login text, avatar_url text, fleet text)
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
         p.team as fleet
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    left join public.players p on p.workspace_id = m.workspace_id and p.user_id = m.user_id
   where m.workspace_id = workspace
     and public.is_member(workspace)
   order by m.joined_at, m.user_id
$$;

comment on function public.workspace_roster(uuid) is
  'Every member of the workspace (name, lower-case GitHub login, avatar, fleet), for a caller who is a member; no email. The dashboards'' People tables (PRD 572).';

-- How many ask rounds each person answered in [from, to), in the sessions of one workspace: a
-- number per answered_by, nothing else. Nothing for a workspace the caller is not in.
create function public.answered_counts(workspace uuid, from_at timestamptz, to_at timestamptz)
returns table (user_id uuid, answered int)
language sql stable
security definer
set search_path = ''
as $$
  select r.answered_by, count(*)::int
    from public.ask_rounds r
    join public.ask_sessions s on s.id = r.session_id
   where s.workspace_id = workspace
     and public.is_member(workspace)
     and r.status = 'answered'
     and r.answered_by is not null
     and r.answered_at >= from_at
     and r.answered_at < to_at
   group by r.answered_by
$$;

comment on function public.answered_counts(uuid, timestamptz, timestamptz) is
  'Ask rounds answered per member in [from_at, to_at), in the workspace''s sessions, for a caller who is a member: counts only. The dashboards'' Questions answered (PRD 572).';

revoke execute on function public.workspace_roster(uuid) from public, anon;
revoke execute on function public.answered_counts(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.workspace_roster(uuid) to authenticated;
grant execute on function public.answered_counts(uuid, timestamptz, timestamptz) to authenticated;
