-- Workspaces (PRD #100): Vertuoza becomes the first of many. A workspace owns everything the game
-- holds (its fleets, sectors, players and ledger, its GitHub organisation, its look), and a person
-- reaches a workspace by being a member of it, instead of by the domain of their email.
--
-- The four game tables are dropped and rebuilt with a workspace scope: production's rows are not
-- carried over (the spec's D3). People sign in again, join_by_domain() puts them back in Vertuoza,
-- and they pick a fleet, a name and a hero again. auth.users is untouched.
--
-- Every grant below is explicit: revoked first, then granted, so the result is the same whether or
-- not the project grants new tables to the API roles by default (config.toml › auto_expose_new_tables).

-- ── 1. Drop the global game tables, and the functions only they use ─────────────

drop table public.ledger_events, public.players, public.teams, public.sectors;  -- their policies, grants and triggers go with them
drop function public.is_crew();
drop function public.players_guard();

-- ── 2. Workspaces and their members ─────────────────────────────────────────────

-- A theme is only the overrides of the arcade's colour tokens (apps/galaxy/src/arcade/theme.ts), each
-- a lowercase #rrggbb colour, like a fleet's. The token list lives here and in theme.ts: change both.
create function public.valid_theme(t jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select case when jsonb_typeof(t) = 'object' then not exists (
    select 1
      from jsonb_each(t) e
     where e.key <> all (array[
             'void', 'deep', 'cab', 'navy', 'navy-dark', 'white', 'dim', 'plasma', 'plasma-dark',
             'yellow', 'gold', 'red', 'cyan', 'green',
             'mark-1', 'mark-2', 'mark-3', 'mark-shade-1', 'mark-shade-2', 'mark-shade-3',
             'stripe-1', 'stripe-2', 'stripe-3', 'stripe-4'])
        or jsonb_typeof(e.value) <> 'string'
        or (e.value #>> '{}') !~ '^#[0-9a-f]{6}$'
  ) else false end
$$;

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,32}$'),
  name        text not null check (char_length(name) between 1 and 40),
  github_org  text,
  plan_repo   text,
  join_domain text unique,
  theme       jsonb not null default '{}' check (public.valid_theme(theme)),
  created_at  timestamptz not null default now()
);

comment on table public.workspaces is
  'A company playing OMNI LOOP. Owns its fleets, sectors, players and ledger. Written by the service role or a migration.';
comment on column public.workspaces.github_org is 'The owner of the repositories the projector reads.';
comment on column public.workspaces.plan_repo is 'The repository that carries the PRD issues.';
comment on column public.workspaces.join_domain is
  'Confirmed accounts of this email domain join by themselves (join_by_domain()), and the sign-up hook lets them in.';
comment on column public.workspaces.theme is
  'Only the overrides of the arcade''s colour tokens, e.g. {"plasma": "#2fc6a4"}. Checked by valid_theme().';

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

comment on table public.workspace_members is
  'Who belongs to which workspace. A person may belong to several. Written by join_by_domain(), the service role or a migration.';

-- True when the caller is a member of the workspace. Every read and write of the galaxy checks it.
create function public.is_member(workspace uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m where m.workspace_id = workspace and m.user_id = auth.uid()
  )
$$;

-- ── 3. The game's tables, scoped by workspace ────────────────────────────────────

create table public.sectors (
  workspace_id uuid not null references public.workspaces,
  name         text not null,
  repos        text[] not null default '{}',
  primary key (workspace_id, name)
);

comment on table public.sectors is 'Sectors and their repositories, per workspace. Change them with a migration.';

create table public.teams (
  workspace_id uuid not null references public.workspaces,
  name         text not null,
  label        text not null constraint teams_label_length check (char_length(label) between 1 and 12),
  color        text not null constraint teams_color_hex check (color ~ '^#[0-9a-f]{6}$'),
  motto        text not null default '',
  mascot       text,
  home         text,
  sort         smallint not null default 0,
  retired_at   timestamptz,
  primary key (workspace_id, name),
  foreign key (workspace_id, home) references public.sectors (workspace_id, name) on update cascade
);

comment on table public.teams is
  'The fleets of a workspace. Add, restyle or retire one with a migration. Never delete one: ledger events name it forever.';
comment on column public.teams.mascot is
  'A sprite key from @omni/sprites. Null or unknown: the fleet is drawn as a hero in its own colour.';
comment on column public.teams.retired_at is
  'Set: the fleet leaves the select screen, its players choose again, its history still renders.';

-- The email stays in auth.users and is never copied here.
create table public.players (
  workspace_id uuid not null,
  user_id      uuid not null,
  display_name text not null check (display_name ~ '^[A-Z0-9-]{1,10}$'),
  team         text,
  team_since   timestamptz,
  hero         jsonb not null check (public.valid_hero(hero)),
  github_id    bigint,
  github_login text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (workspace_id, user_id),
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade,
  foreign key (workspace_id, team) references public.teams (workspace_id, name) on update cascade,
  unique (workspace_id, github_id),
  unique (workspace_id, github_login)
);

create index players_user_idx on public.players (user_id);

comment on table public.players is
  'One row per player and workspace: a member who linked their GitHub account. Arcade name, fleet, hero, and the GitHub login their points are earned under.';
comment on column public.players.github_login is
  'Set only from the linked GitHub identity (players_guard, link_github()). Never typed.';

create table public.ledger_events (
  workspace_id uuid not null references public.workspaces,
  id           text not null,                     -- deterministic `source:identity:state`, unique per workspace
  at           timestamptz not null,
  type         text not null check (type in (
                 'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
                 'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
                 'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
                 'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED')),
  planet       integer not null check (planet > 0), -- the PRD number
  region       text,                               -- engineering repository
  contributor  text,                               -- GitHub login
  team         text,                               -- the contributor's fleet at the time: a stamp, not a key
  data         jsonb not null default '{}'::jsonb,
  imported_at  timestamptz not null default now(),
  primary key (workspace_id, id)
);

create index ledger_events_at_idx on public.ledger_events (workspace_id, at, id);
create index ledger_events_planet_idx on public.ledger_events (workspace_id, planet, at);

comment on table public.ledger_events is
  'The game ledger of each workspace, append-only and the source of truth. Written by the game workflow (pnpm game:project), read by the workspace''s members. The workspace is a storage column, never an event field.';

-- Append-only, as before: an event, once written, never changes (ledger_events_append_only() stays).
create trigger ledger_events_append_only
  before update or delete on public.ledger_events
  for each row execute function public.ledger_events_append_only();

-- ── 4. The hook, the players' guard, linking GitHub, joining by domain ───────────

-- Supabase Auth's "before user created" hook (Authentication › Hooks), same name and signature as
-- before so the dashboard's setting still points at it: an account is refused unless a workspace
-- joins the domain of its email. Security definer, so the auth admin reads no table itself.
create or replace function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  domain text := coalesce(substring(lower(event -> 'user' ->> 'email') from '@([^@]+)$'), '');
begin
  if domain <> '' and exists (select 1 from public.workspaces w where lower(w.join_domain) = domain) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', format('OMNI LOOP is not open to %s yet.', coalesce(nullif(domain, ''), 'this address'))));
end;
$$;

-- Stamps team_since when the fleet changes, refuses a retired fleet of the row's own workspace, and
-- gives a new player the GitHub account linked to their sign-in: nobody types it.
create function public.players_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.team is distinct from old.team then
    if new.team is not null and exists (
      select 1 from public.teams t
       where t.workspace_id = new.workspace_id and t.name = new.team and t.retired_at is not null
    ) then
      raise exception 'The fleet % is retired. Choose another one.', new.team using errcode = 'check_violation';
    end if;
    new.team_since := case when new.team is null then null else now() end;
  else
    new.team_since := old.team_since;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    if new.user_id = auth.uid() then
      select g.github_id, g.github_login into new.github_id, new.github_login from public.my_github() g;
    end if;
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

-- Returns the caller's linked GitHub account, and copies it onto every player row of theirs, one
-- per workspace (a player who links another account, or renamed theirs).
create or replace function public.link_github() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident record;
begin
  if auth.uid() is null or not exists (select 1 from public.workspace_members m where m.user_id = auth.uid()) then
    raise exception 'Sign in with an account of a workspace first.' using errcode = '42501';
  end if;
  select g.github_id, g.github_login into ident from public.my_github() g;
  if not found or ident.github_login is null then
    raise exception 'No GitHub account is linked to this sign-in yet.' using errcode = 'P0002';
  end if;
  begin
    update public.players p
       set github_id = ident.github_id, github_login = ident.github_login
     where p.user_id = auth.uid();
  exception when unique_violation then
    raise exception 'The GitHub account @% is already linked to another player.', ident.github_login using errcode = '23505';
  end;
  return jsonb_build_object('github_id', ident.github_id, 'github_login', ident.github_login);
end;
$$;

-- Adds the caller as a member of every workspace whose join_domain is the domain of their email,
-- once that email is confirmed. Idempotent. Returns the slugs of every workspace the caller belongs
-- to, the one joined first first. The arcade calls it after every sign-in.
create function public.join_by_domain() returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  me constant uuid := auth.uid();
  domain text;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select substring(lower(u.email) from '@([^@]+)$') into domain
    from auth.users u
   where u.id = me and u.email_confirmed_at is not null;
  if domain is not null then
    insert into public.workspace_members (workspace_id, user_id)
    select w.id, me from public.workspaces w where lower(w.join_domain) = domain
    on conflict do nothing;
  end if;
  return array(
    select w.slug
      from public.workspace_members m
      join public.workspaces w on w.id = m.workspace_id
     where m.user_id = me
     order by m.joined_at, w.slug);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.sectors enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.ledger_events enable row level security;

create policy "a member reads their workspace" on public.workspaces
  for select to authenticated using (public.is_member(id));
create policy "a person reads their own memberships" on public.workspace_members
  for select to authenticated using (user_id = auth.uid());
create policy "a member reads their workspace's sectors" on public.sectors
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's fleets" on public.teams
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's ledger" on public.ledger_events
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's players" on public.players
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member joins as themself, with GitHub linked" on public.players
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(workspace_id) and exists (select 1 from public.my_github()));
create policy "a player edits only themself" on public.players
  for update to authenticated
  using (user_id = auth.uid() and public.is_member(workspace_id))
  with check (user_id = auth.uid() and public.is_member(workspace_id));

-- Nobody signed out reads anything: the attract mode plays the built-in fleets instead.
revoke all on public.workspaces, public.workspace_members, public.sectors, public.teams, public.players, public.ledger_events
  from public, anon, authenticated, service_role;

-- Signed in: the rows above. A player sets their name, fleet and hero; never their workspace, their
-- GitHub login or the timestamps.
grant select on public.workspaces, public.workspace_members, public.sectors, public.teams, public.players, public.ledger_events
  to authenticated;
grant insert (workspace_id, user_id, display_name, team, hero) on public.players to authenticated;
grant update (display_name, team, hero) on public.players to authenticated;

-- The service role (the game workflow, and PRDs to come) reads everything, appends to the ledger and
-- never rewrites it, and writes the workspaces, their memberships, sectors and fleets.
grant select on public.workspaces, public.workspace_members, public.sectors, public.teams, public.players, public.ledger_events
  to service_role;
grant insert on public.ledger_events to service_role;
grant insert, update, delete on public.workspaces, public.workspace_members, public.sectors, public.teams to service_role;

revoke execute on function public.valid_theme(jsonb) from public;
grant execute on function public.valid_theme(jsonb) to anon, authenticated, service_role;
revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated, service_role;
revoke execute on function public.join_by_domain() from public, anon;
grant execute on function public.join_by_domain() to authenticated;
revoke execute on function public.link_github() from public, anon;
grant execute on function public.link_github() to authenticated;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ── 5. Vertuoza, workspace #1, and its fleets ────────────────────────────────────

insert into public.workspaces (slug, name, github_org, plan_repo, join_domain, theme)
values ('vertuoza', 'Vertuoza', 'vertuoza', 'vertuo-omni-plan', 'vertuoza.com', '{}');

-- Today's six, with the same look and order. INVINCIBLE stays retired: history that names it keeps
-- its look. No sectors: the real ones come in a migration of their own.
insert into public.teams (workspace_id, name, label, color, motto, mascot, sort, retired_at)
select w.id, f.name, f.label, f.color, f.motto, f.mascot, f.sort, f.retired_at
  from public.workspaces w,
       (values
         ('beaver',          'BEAVER',     '#d08a4a', 'Builds the dam. Secures the zone.', 'beaver',     10, null::timestamptz),
         ('octopod',         'OCTOPOD',    '#b07cff', 'Eight arms, eight sub-PRs.',        'octopod',    20, null),
         ('picsou',          'PICSOU',     '#ffd84a', 'Every coin counted twice.',         'picsou',     30, null),
         ('cia',             'C.I.A.',     '#9aa3c8', 'Knows every open question.',        'cia',        40, null),
         ('pirates',         'PIRATES',    '#2fc6a4', 'Takes the zones nobody claims.',    'pirate',     50, null),
         ('invincible-team', 'INVINCIBLE', '#4fb0ff', 'Think, Mark. Then ship it.',        'invincible', 90, now())
       ) as f (name, label, color, motto, mascot, sort, retired_at)
 where w.slug = 'vertuoza';
