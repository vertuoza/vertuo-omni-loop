-- The loop's health on the Engineering board (PRD 714, docs:
-- .omni-loop/delivery/inbox/0714-loop-health/spec.md): six columns on public.pull_requests that the
-- prStats collector fills, all additive, each nullable or defaulted, so every row already stored stays
-- valid. The board counts only pull requests into main, master or develop whose head is none of the
-- three (head), and its Loop health panel reads the rest (draft, labels, head_committed_at,
-- needs_fix_at, status_state).
--
-- Every repository's collection cursor is reset, so the next runs read the last 90 days again and fill
-- the new columns; upserts keyed on the pull request make that re-read write the same rows.
--
-- Row-level security and the grants are unchanged: they are table-wide (20261008090000_repositories.sql),
-- so members read the new columns, the service role writes them, and nobody signed in writes them.
--
-- Proven by supabase/checks/repositories.sql.
-- Rollback: revert the pull request; the columns stay, unused, until a follow-up migration drops them.

alter table public.pull_requests
  add column head              text,
  add column draft             boolean not null default false,
  add column labels            text[] not null default '{}',
  add column head_committed_at timestamptz,
  add column needs_fix_at      timestamptz,
  add column status_state      text;

comment on column public.pull_requests.head is
  'The head branch name; null until the collector reads it again. A head of main, master or develop is a promotion, counted nowhere on the board.';
comment on column public.pull_requests.draft is 'Whether the pull request is a draft, as last read.';
comment on column public.pull_requests.labels is 'The pull request''s label names, as last read.';
comment on column public.pull_requests.head_committed_at is 'The committed date of the pull request''s latest commit, as last read.';
comment on column public.pull_requests.needs_fix_at is 'When omni:needs-fix was first added to the pull request, from its timeline; null when never.';
comment on column public.pull_requests.status_state is
  'The state: line of the loop''s status comment (claimed, implementing, …, done, stuck), read only for open signed pull requests into main, master or develop; null otherwise, or with no status comment.';

-- Read the last 90 days again, to fill the new columns.
update public.repositories set collected_until = null;
