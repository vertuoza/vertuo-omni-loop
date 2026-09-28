-- Contributions (PRD 328): who authored each pull request merged into a sector repository's default
-- branch, and who opened each omni:prd issue, per workspace. The app's dashboard (/app) reads it: the
-- chart of the pull requests you got into main over the last 7 days, and the PRDs you created this
-- season.
--
-- The game workflow fills it (`pnpm game:contributions`, game/cli/contributions.mjs): at each poll it
-- reads the last 40 days from GitHub and upserts one row per item on the primary key. It is not the
-- ledger: a row can be rewritten, backfilled or deleted, and the table dropped, without touching the
-- ledger's permanent history, and the ledger and the economy never read it. It rebuilds from GitHub
-- within its window, so the weekly backup leaves it out.
--
-- Every grant below is explicit: revoked first, then granted, so the result is the same whether or
-- not the project grants new tables to the API roles by default (config.toml › auto_expose_new_tables).

create table public.contributions (
  workspace_id uuid        not null references public.workspaces (id) on delete cascade,
  kind         text        not null check (kind in ('pr-merged', 'prd-opened')),
  repo         text        not null,
  number       int         not null,
  login        text        not null,
  at           timestamptz not null,
  seen_at      timestamptz not null default now(),
  primary key (workspace_id, kind, repo, number)
);

comment on table public.contributions is
  'Who authored each pull request merged into a sector repository''s default branch (pr-merged), and who opened each omni:prd issue (prd-opened), per workspace. Written by the game workflow (pnpm game:contributions) over the last 40 days, read by the workspace''s members. Not the ledger: rebuilt from GitHub within its window.';
comment on column public.contributions.repo is 'The repository, as the workspace''s sectors name it.';
comment on column public.contributions.number is 'The pull request''s or the issue''s number.';
comment on column public.contributions.login is 'Its author''s GitHub login, in lower case.';
comment on column public.contributions.at is 'merged_at for a pull request, created_at for an issue.';
comment on column public.contributions.seen_at is 'When a poll first wrote the row.';

alter table public.contributions enable row level security;

create policy "a member reads their workspace's contributions" on public.contributions
  for select to authenticated using (public.is_member(workspace_id));

-- Nobody signed out reads it; signed in, the rows above, and no policy lets anyone signed in write.
-- Only the service role writes it, as game:contributions does: an upsert on the primary key.
revoke all on public.contributions from public, anon, authenticated, service_role;
grant select on public.contributions to authenticated;
grant select, insert, update on public.contributions to service_role;
