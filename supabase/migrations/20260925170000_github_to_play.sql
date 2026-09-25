-- Linking GitHub is what turns a visitor into a player. Signing in with a @vertuoza.com Google
-- account lets someone into the arcade as a visitor: they may look at the galaxy. Only once they
-- have linked their GitHub account (the login their pull requests score under) may they join a
-- fleet, and their player row then starts with that login.

-- The caller's linked GitHub account, if any. auth.identities is not readable by the API roles, so
-- this is security definer, and it only ever answers for auth.uid().
create function public.my_github() returns table (github_id bigint, github_login text)
language sql stable
security definer
set search_path = ''
as $$
  select i.provider_id::bigint, coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
    from auth.identities i
   where i.user_id = auth.uid() and i.provider = 'github'
   order by i.created_at desc
   limit 1
$$;

revoke execute on function public.my_github() from public, anon;
grant execute on function public.my_github() to authenticated;

-- No GitHub account linked, no player row: a visitor cannot join a fleet.
drop policy "a player joins as themself" on public.players;
create policy "a player joins as themself, with GitHub linked" on public.players
  for insert to authenticated
  with check (id = auth.uid() and public.is_crew() and exists (select 1 from public.my_github()));

-- As before (team_since, retired fleets, timestamps), and a new player's GitHub columns come from
-- their linked identity: nobody types them.
create or replace function public.players_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.team is distinct from old.team then
    if new.team is not null and exists (
      select 1 from public.teams t where t.name = new.team and t.retired_at is not null
    ) then
      raise exception 'The fleet % is retired. Choose another one.', new.team using errcode = 'check_violation';
    end if;
    new.team_since := case when new.team is null then null else now() end;
  else
    new.team_since := old.team_since;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.id = auth.uid() then
      select g.github_id, g.github_login into new.github_id, new.github_login from public.my_github() g;
    end if;
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- link_github() now answers before a player exists too: it returns the linked login (the row picks
-- it up when the player joins a fleet), and copies it onto an existing player (a player who joined
-- before this rule, or who links another account).
drop function public.link_github();
create function public.link_github() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident record;
begin
  if auth.uid() is null or not public.is_crew() then
    raise exception 'Sign in with your vertuoza.com account first.' using errcode = '42501';
  end if;
  select g.github_id, g.github_login into ident from public.my_github() g;
  if not found or ident.github_login is null then
    raise exception 'No GitHub account is linked to this sign-in yet.' using errcode = 'P0002';
  end if;
  begin
    update public.players p
       set github_id = ident.github_id, github_login = ident.github_login
     where p.id = auth.uid();
  exception when unique_violation then
    raise exception 'The GitHub account @% is already linked to another player.', ident.github_login using errcode = '23505';
  end;
  return jsonb_build_object('github_id', ident.github_id, 'github_login', ident.github_login);
end;
$$;

revoke execute on function public.link_github() from public, anon;
grant execute on function public.link_github() to authenticated;

comment on table public.players is
  'One row per player: someone signed in with Google who linked their GitHub account. Arcade name, fleet, hero, and the GitHub login their points are earned under.';
