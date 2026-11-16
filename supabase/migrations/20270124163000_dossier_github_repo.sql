-- The repository of each GitHub snapshot, as a column of its own (#2952): every GitHub webhook reads the
-- snapshots of the workspace's dossiers in the repository it names (apps/galaxy/src/touched/store.ts).
-- That read filtered on `summary->>'repo' ilike <repository>`, which no index holds, so each webhook
-- detoasted every summary of the workspace (~5 MB, up to 57 kB a row): 36% of the production
-- database's time, ~54 ms a call, ~480k calls a month.
--
-- - repo: the summary's repository in lower case, generated from it by the database and stored, so no
--   writer sets it and it can never disagree with the summary. The read compares it with the
--   repository in lower case: the same match, in any case, as the ilike it replaces.
-- - dossier_github_workspace_repo_idx: the read's two filters, so it reads only its repository's rows.
--
-- Adding a stored generated column rewrites the table once (~775 rows in production).
--
-- Rollback: a follow-up migration drops the index and the column, once the read filters on the summary
-- again; nothing else reads the column.

alter table public.dossier_github
  add column repo text generated always as (lower(summary ->> 'repo')) stored;

create index dossier_github_workspace_repo_idx on public.dossier_github (workspace_id, repo);

comment on column public.dossier_github.repo is
  'The summary''s repository (owner/name) in lower case, generated from summary and stored, for the read by repository.';
