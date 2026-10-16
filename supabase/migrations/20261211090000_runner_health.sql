-- A runner's machine health (PRD 2102, docs: .omni-loop/delivery/inbox/2102-runner-health/spec.md,
-- sections 4 and 5): every 15 s a runner sends its machine's CPU, load, cores, memory and disk, numbers
-- only, to POST /api/runners/<id>/health, for the Runners page.
--
-- - runners.health: the runner's last report, with the server's `at`; null for a runner that never sent
--   one (a runner from before this PRD).
-- - runner_samples: one row per report: its runner, the runner's workspace (for row-level security), the
--   server's time, and the figures the page draws its sparklines from. One row per runner and instant.
--   The route deletes a runner's samples older than an hour on each report, so a runner holds about 240
--   rows and no cron is needed (apps/galaxy/src/runners/runners.service.ts). `tokens_5h` stays null
--   until the runner counts tokens.
--
-- The routes write both as the service role, as they write runners and runner_jobs; a member of the
-- workspace reads them, anyone else reads nothing, and nobody signed in writes them.
--
-- Proven by supabase/checks/runner_samples.sql.
-- Rollback: a follow-up migration drops runner_samples and runners.health. Nothing else reads them.

alter table public.runners add column health jsonb;

comment on column public.runners.health is
  'The runner''s last health report (PRD 2102): its machine''s figures, numbers only, and the server''s `at`. Null for a runner that never sent one.';

create table public.runner_samples (
  runner_id    uuid not null references public.runners (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  at           timestamptz not null default now(),
  cpu          real check (cpu between 0 and 100),
  mem_used     bigint check (mem_used >= 0),
  mem_total    bigint check (mem_total >= 0),
  disk_free    bigint check (disk_free >= 0),
  tokens_5h    bigint check (tokens_5h >= 0),
  primary key (runner_id, at)
);

comment on table public.runner_samples is
  'A runner''s health samples of the last hour (PRD 2102): one per report, every 15 s. Written by the routes as the service role, read by the workspace''s members.';
comment on column public.runner_samples.at is 'When the server received the report.';
comment on column public.runner_samples.cpu is 'The busy share of all cores since the previous sample, in percent.';
comment on column public.runner_samples.tokens_5h is 'The machine''s tokens of the last 5 hours; null until the runner counts them.';

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.runner_samples enable row level security;

-- The person's workspaces are read once per statement, never once per row (bug #1832).
create policy "a member reads their workspace's runner samples" on public.runner_samples
  for select to authenticated
  using (workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the table: the routes do, as the service role, adding samples and deleting old ones.
revoke all on public.runner_samples from public, anon, authenticated, service_role;
grant select on public.runner_samples to authenticated;
grant select, insert, delete on public.runner_samples to service_role;
