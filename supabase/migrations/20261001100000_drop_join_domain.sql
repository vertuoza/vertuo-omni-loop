-- One-click sign-up with GitHub (PRD 359, docs: .omni-loop/delivery/inbox/0359-github-sign-up/spec.md),
-- second half: joining by email domain goes. galaxy's sign-in callback now joins a person to the
-- workspaces of their GitHub orgs (join_workspaces_by_github(), 20261001090000), and the sign-up hook
-- no longer reads a domain, so join_by_domain() and workspaces.join_domain have no reader left.
--
-- Proven by supabase/checks/access.sql (neither exists; joining by org fills the memberships).
-- Rollback: a follow-up migration adds join_domain back (vertuoza.com on the vertuoza workspace) and
-- recreates join_by_domain() as 20260926120000_workspaces.sql wrote it, with its grant to authenticated.

drop function public.join_by_domain();

alter table public.workspaces drop column join_domain;

comment on table public.workspace_members is
  'Who belongs to which workspace. A person may belong to several. Written by create_workspace_from_installation(), join_workspaces_by_github(), the service role or a migration.';
