-- PRD stages in the contributions (PRD 572): besides a merged pull request (pr-merged) and an opened
-- omni:prd issue (prd-opened, a PRD drafted), a PRD's phase-0 PR merging (prd-started, in progress)
-- and its feature PR merging (prd-shipped). game:contributions writes them from the merged pull
-- requests it already reads, `number` being the PRD issue's and `login` its author's, and the
-- dashboards count them per day.
--
-- It only widens the check on `kind`: no row is rewritten, and no grant or policy changes.

alter table public.contributions drop constraint contributions_kind_check;
alter table public.contributions add constraint contributions_kind_check
  check (kind in ('pr-merged', 'prd-opened', 'prd-started', 'prd-shipped'));

comment on table public.contributions is
  'Who authored each pull request merged into a sector repository''s default branch (pr-merged), who opened each omni:prd issue (prd-opened), and when each PRD''s phase-0 PR (prd-started) and feature PR (prd-shipped) merged, credited to the PRD issue''s author, per workspace. Written by the game workflow (pnpm game:contributions) over the last 40 days, read by the workspace''s members. Not the ledger: rebuilt from GitHub within its window.';
comment on column public.contributions.number is 'The pull request''s or the issue''s number; for prd-started and prd-shipped, the PRD issue''s.';
comment on column public.contributions.login is 'Its author''s GitHub login, in lower case; for prd-started and prd-shipped, the PRD issue''s author''s.';
comment on column public.contributions.at is 'merged_at for a pull request (and for the PRD stage it marks), created_at for an issue.';
