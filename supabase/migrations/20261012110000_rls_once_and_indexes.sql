-- Snappy pages (PRD #657), s9: the indexes the slow reads miss, and the uid read once per statement.
--
-- Who may read and write what does not change: supabase/checks/access.sql (and every other file in
-- supabase/checks/) proves it on the pull request.
--
-- Rollback: a follow-up migration that restores is_member() and the three policies from the
-- previous texts kept in the comments below, and drops the four indexes.

-- ── Indexes ─────────────────────────────────────────────────────────────────────────
-- The workspace dashboards read a workspace's contributions over a window of `at`.
create index if not exists contributions_workspace_at_idx on public.contributions (workspace_id, at);
-- "Opened by you": the dashboards count a person's dossiers.
create index if not exists dossiers_opened_by_idx on public.dossiers (opened_by);
-- Recent activity reads versions and answers by date, across dossiers and sessions.
create index if not exists dossier_versions_created_at_idx on public.dossier_versions (created_at);
create index if not exists ask_rounds_answered_at_idx on public.ask_rounds (answered_at);

-- ── is_member(): the uid once per statement ───────────────────────────────────────
-- Previous body (20260926120000_workspaces.sql):
--   select exists (
--     select 1 from public.workspace_members m where m.workspace_id = workspace and m.user_id = auth.uid()
--   )
-- `create or replace` keeps the function's grants (authenticated and service_role only).
create or replace function public.is_member(workspace uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m where m.workspace_id = workspace and m.user_id = (select auth.uid())
  )
$$;

-- ── Policies that compared a bare auth.uid() ──────────────────────────────────────
-- Every other policy already reads `(select auth.uid())`. A policy that calls
-- `public.is_member(workspace_id)` on the row's own column keeps it as it is: wrapped in a select it
-- would still run once per row, since its argument is the row's.

-- Previous (20260926120000_workspaces.sql):
--   for select to authenticated using (user_id = auth.uid())
alter policy "a person reads their own memberships" on public.workspace_members
  using (user_id = (select auth.uid()));

-- Previous (20260926120000_workspaces.sql):
--   for insert to authenticated
--   with check (user_id = auth.uid() and public.is_member(workspace_id) and exists (select 1 from public.my_github()))
alter policy "a member joins as themself, with GitHub linked" on public.players
  with check (user_id = (select auth.uid()) and public.is_member(workspace_id) and exists (select 1 from public.my_github()));

-- Previous (20260926120000_workspaces.sql):
--   for update to authenticated
--   using (user_id = auth.uid() and public.is_member(workspace_id))
--   with check (user_id = auth.uid() and public.is_member(workspace_id))
alter policy "a player edits only themself" on public.players
  using (user_id = (select auth.uid()) and public.is_member(workspace_id))
  with check (user_id = (select auth.uid()) and public.is_member(workspace_id));
