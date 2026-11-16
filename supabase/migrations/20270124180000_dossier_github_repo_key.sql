-- A GitHub webhook finds its repository's snapshots through an index (bug #2956). Every webhook of
-- an organisation looks up the dossier_github rows of its repository (apps/galaxy/src/touched/store.ts,
-- snapshotsOf). It matched summary->>'repo' with ilike, which no index serves: each call decompressed
-- every summary of the workspace (97 ms at 775 rows in production), the costliest query of the
-- database while its CPU stayed above 80%.
--
-- repo_key is the summary's repository in lower case, kept by Postgres from the summary itself, so a
-- refresh that rewrites the summary moves it too and no writer sets it. The lookup is an equality on
-- (workspace_id, repo_key), which the index below serves. Adding a stored column rewrites the table
-- once: a few hundred rows.
--
-- Rollback: a follow-up migration drops the index and the column; the lookup goes back to the ilike.

alter table public.dossier_github
  add column repo_key text generated always as (lower(summary ->> 'repo')) stored;

create index dossier_github_repo_idx on public.dossier_github (workspace_id, repo_key);

comment on column public.dossier_github.repo_key is
  'The summary''s repository (owner/name) in lower case, derived by Postgres: what a webhook looks its repository up by.';
