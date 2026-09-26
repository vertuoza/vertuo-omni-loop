-- Game room (PRD #160): every login's XP, level and unlocked games, per workspace.
--
-- The rules live in JavaScript (game/rulebook.mjs › xp, applied by game/experience.mjs), never here:
-- the game workflow (`pnpm game:xp`) recomputes every row from the whole ledger on every poll and
-- upserts them, so this table can always be rebuilt and is left out of the weekly backup.
--
-- Every grant below is explicit: revoked first, then granted, so the result is the same whether or
-- not the project grants new tables to the API roles by default (config.toml › auto_expose_new_tables).

create table public.player_xp (
  workspace_id uuid not null references public.workspaces,
  github_login text not null check (github_login = lower(github_login)),
  xp           integer not null check (xp >= 0),
  level        smallint not null check (level >= 0),
  unlocked     text[] not null default '{}',
  computed_at  timestamptz not null,
  primary key (workspace_id, github_login)
);

comment on table public.player_xp is
  'Each login''s XP, level and unlocked games, one row per login the workspace''s ledger names, player or not. Written by the game workflow (pnpm game:xp), read by the workspace''s members.';
comment on column public.player_xp.github_login is
  'Lower-cased, as the roster matches logins whatever their case.';
comment on column public.player_xp.level is '0 before the first point: no level.';
comment on column public.player_xp.unlocked is
  'The games this login may play. Only ever grows: a game once unlocked stays unlocked after a rule change.';

alter table public.player_xp enable row level security;

create policy "a member reads their workspace's XP" on public.player_xp
  for select to authenticated using (public.is_member(workspace_id));

-- Nobody signed out reads it; signed in, the rows above. Only the service role writes it, and it
-- never deletes a row.
revoke all on public.player_xp from public, anon, authenticated, service_role;
grant select on public.player_xp to authenticated;
grant select, insert, update on public.player_xp to service_role;
