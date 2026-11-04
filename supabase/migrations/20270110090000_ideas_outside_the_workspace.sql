-- A public board's ideas keep who added them inside the workspace (bug 2634).
--
-- The table's read grant and its public-board policy let anyone with the public key read every column
-- of a public board's ideas, added_by and workspace_id among them, while ideas_board(), which the page
-- reads, leaves those out. Now:
-- - signed out, the table answers only the columns ideas_board() shows, and a column added later stays
--   unreadable until someone grants it;
-- - signed in, someone outside the workspace reads the board through ideas_board() alone, since a
--   column grant cannot tell them from a member, who still reads the whole row.
--
-- ideas_board() and ideas_public_board() stay callable signed out: the board's page and this policy
-- need them. Proven by supabase/checks/ideas.sql and supabase/checks/access.sql.
--
-- Rollback: `grant select on public.ideas to anon` and set the policy's roles back to
-- anon, authenticated.

revoke select on public.ideas from anon;
grant select (id, repo, title, pitch, lane, prd, created_at, archived) on public.ideas to anon;

alter policy "anyone reads the ideas of a public board" on public.ideas to anon;

comment on table public.ideas is
  'An idea of a repository''s board (PRD 1246). A member of the workspace adds and changes it; nobody deletes one, a member archives it. While the board is public, anyone reads it through ideas_board(), and signed out the table answers the same columns.';
