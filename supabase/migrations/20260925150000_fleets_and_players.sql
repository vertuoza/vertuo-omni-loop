-- Fleets, players and sign-in (docs/superpowers/specs/2026-09-25-omni-loop-teams-and-heroes-design.md).
-- Supabase becomes the game's source of truth: a fleet is a row here, a player is a signed-in
-- @vertuoza.com account, and the galaxy is readable only by that crew.

-- ── Fleets carry their own look ──────────────────────────────────────────────

alter table public.teams
  add column label text,
  add column color text,
  add column motto text not null default '',
  add column mascot text,
  add column sort smallint not null default 0,
  add column retired_at timestamptz,
  alter column home drop not null;

-- Any fleet already here (from the old projects.yml sync) gets a plain look before the columns tighten.
update public.teams set label = upper(left(name, 12)) where label is null;
update public.teams set color = '#cfd4e6' where color is null;

alter table public.teams
  alter column label set not null,
  alter column color set not null,
  add constraint teams_label_length check (char_length(label) between 1 and 12),
  add constraint teams_color_hex check (color ~ '^#[0-9a-f]{6}$');

comment on table public.teams is
  'The fleets. Add, restyle or retire one with a migration. Never delete one: ledger events name it forever.';
comment on column public.teams.mascot is
  'A sprite key from @omni/sprites. Null or unknown: the fleet is drawn as a hero in its own colour.';
comment on column public.teams.retired_at is
  'Set: the fleet leaves the select screen, its players choose again, its history still renders.';

insert into public.teams (name, label, color, motto, mascot, sort) values
  ('beaver',  'BEAVER',  '#d08a4a', 'Builds the dam. Secures the zone.', 'beaver',  10),
  ('octopod', 'OCTOPOD', '#b07cff', 'Eight arms, eight sub-PRs.',        'octopod', 20),
  ('picsou',  'PICSOU',  '#ffd84a', 'Every coin counted twice.',         'picsou',  30),
  ('cia',     'C.I.A.',  '#9aa3c8', 'Knows every open question.',        'cia',     40),
  ('pirates', 'PIRATES', '#2fc6a4', 'Takes the zones nobody claims.',    'pirate',  50)
on conflict (name) do update
  set label = excluded.label, color = excluded.color, motto = excluded.motto,
      mascot = excluded.mascot, sort = excluded.sort, retired_at = null;

-- INVINCIBLE is retired, not deleted: any history that names it keeps its look.
insert into public.teams (name, label, color, motto, mascot, sort, retired_at) values
  ('invincible-team', 'INVINCIBLE', '#4fb0ff', 'Think, Mark. Then ship it.', 'invincible', 90, now())
on conflict (name) do update
  set label = excluded.label, color = excluded.color, motto = excluded.motto, mascot = excluded.mascot,
      sort = excluded.sort, retired_at = coalesce(public.teams.retired_at, excluded.retired_at);

-- ── The crew: signed-in @vertuoza.com accounts ───────────────────────────────

-- True when the caller's token belongs to a Vertuoza account. Every read and write of the galaxy
-- checks it, so the domain holds even if the sign-in hook below is switched off.
create function public.is_crew() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@vertuoza.com', false)
$$;

-- Supabase Auth's "before user created" hook (Authentication › Hooks): an account from any other
-- domain is refused before it exists.
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable
set search_path = ''
as $$
begin
  if lower(coalesce(event -> 'user' ->> 'email', '')) like '%@vertuoza.com' then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'OMNI LOOP is for @vertuoza.com accounts only.'));
end;
$$;

-- ── Players ──────────────────────────────────────────────────────────────────

-- A hero is stored as preset numbers (@omni/sprites HERO_PRESETS), versioned so presets can grow.
create function public.valid_hero(h jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(h) = 'object'
    and coalesce(h ->> 'v', '') = '1'
    and coalesce(h ->> 'body', '') in ('girl', 'boy')
    and case when coalesce(h ->> 'skin', '') ~ '^[0-9]$' then (h ->> 'skin')::int <= 5 else false end
    and case when coalesce(h ->> 'hair', '') ~ '^[0-9]$' then (h ->> 'hair')::int <= 7 else false end
    and case when coalesce(h ->> 'suit', '') ~ '^[0-9]$' then (h ->> 'suit')::int <= 7 else false end
    and case when coalesce(h ->> 'cape', '') ~ '^[0-9]$' then (h ->> 'cape')::int <= 8 else false end
$$;

-- The email stays in auth.users and is never copied here.
create table public.players (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (display_name ~ '^[A-Z0-9-]{1,10}$'),
  team         text references public.teams (name) on update cascade,
  team_since   timestamptz,
  hero         jsonb not null check (public.valid_hero(hero)),
  github_id    bigint unique,
  github_login text unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.players is
  'One row per signed-in person: their arcade name, fleet and hero, and the GitHub login their points are earned under.';
comment on column public.players.github_login is
  'Set only by link_github(), from the GitHub account the player linked. Never typed.';

-- Stamps team_since when the fleet changes, refuses a retired fleet, keeps the timestamps honest.
create function public.players_guard() returns trigger
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
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger players_guard
  before insert or update on public.players
  for each row execute function public.players_guard();

-- Copies the caller's linked GitHub account onto their player. The login comes from the identity
-- Supabase recorded when they linked GitHub, so nobody can claim someone else's points.
create function public.link_github() returns public.players
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident record;
  me public.players;
begin
  if auth.uid() is null or not public.is_crew() then
    raise exception 'Sign in with your vertuoza.com account first.' using errcode = '42501';
  end if;
  select i.provider_id, coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username') as login
    into ident
    from auth.identities i
   where i.user_id = auth.uid() and i.provider = 'github'
   order by i.created_at desc
   limit 1;
  if not found or ident.login is null then
    raise exception 'No GitHub account is linked to this sign-in yet.' using errcode = 'P0002';
  end if;
  begin
    update public.players p
       set github_id = ident.provider_id::bigint, github_login = ident.login
     where p.id = auth.uid()
    returning * into me;
  exception when unique_violation then
    raise exception 'The GitHub account @% is already linked to another player.', ident.login using errcode = '23505';
  end;
  if me.id is null then
    raise exception 'Choose a fleet first: there is no player to link yet.' using errcode = 'P0002';
  end if;
  return me;
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────

alter table public.players enable row level security;

create policy "the crew sees the crew" on public.players
  for select to authenticated using (public.is_crew());
create policy "a player joins as themself" on public.players
  for insert to authenticated with check (id = auth.uid() and public.is_crew());
create policy "a player edits only themself" on public.players
  for update to authenticated using (id = auth.uid() and public.is_crew()) with check (id = auth.uid());

-- The galaxy (PRD titles, logins) is internal: only the crew reads it. The fleets stay public, so the
-- signed-out attract mode can draw them.
drop policy "the galaxy is readable" on public.ledger_events;
drop policy "the galaxy is readable" on public.sectors;
create policy "the crew reads the galaxy" on public.ledger_events
  for select to authenticated using (public.is_crew());
create policy "the crew reads the galaxy" on public.sectors
  for select to authenticated using (public.is_crew());
revoke select on public.ledger_events, public.sectors from anon;

-- Column grants: a player sets their name, fleet and hero; never their GitHub login or timestamps.
grant select on public.players to authenticated;
grant insert (id, display_name, team, hero) on public.players to authenticated;
grant update (display_name, team, hero) on public.players to authenticated;
revoke all on public.players from anon;

-- The game workflow reads the roster (login → fleet) with the service role.
grant select on public.players to service_role;

grant execute on function public.is_crew() to anon, authenticated, service_role;
grant execute on function public.valid_hero(jsonb) to anon, authenticated, service_role;
revoke execute on function public.link_github() from public, anon;
grant execute on function public.link_github() to authenticated;
grant usage on schema public to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

comment on table public.ledger_events is
  'The game ledger, append-only and the source of truth. Written by the game workflow (pnpm game:project), read by the crew.';
comment on table public.sectors is 'Sectors and their repositories. Change them with a migration.';
