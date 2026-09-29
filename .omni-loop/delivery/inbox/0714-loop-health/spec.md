---
prd: 714
title: Engineering board — only merges into main, and the loop's health
blocked-by: none
spec: file
---

# Engineering board — only merges into main, and the loop's health

**Date:** 2026-09-29 · **PRD:** #714 · **Follows:** PRD 612 (the Engineering board and its
collector), PRD 645 (a page per repository) · **Touches:** `supabase/migrations/` (one new file),
`supabase/checks/repositories.sql`, `apps/omni-app/src/pr-stats/` (the collector's read and rows),
`apps/galaxy/src/engineering/` (tally, load, board, demo, CSS), `kit/lib/board.mjs` (one export),
`kit/lib/markers.mjs` (one marker). No change to the game, the person profile, the skills, or any
other board.

## Problem

The Engineering board is meant to say whether Omni Loop is worth it. Today it can only say that the
loop is used, and even that number is inflated.

1. **Every base branch counts** (a decision PRD 612 recorded). The loop's sub-PRs go into feature
   branches, and the loop merges them itself, minutes after opening them, with no review. They count
   as merged PRs, as Omni-man's signed share, and in his median time to merge. So "signed vs the
   rest" compares agent self-merges with pull requests people reviewed. Whoever runs `/omni:yolo`
   is also credited in **Most opened** and **Most merged** for every sub-PR the loop opened and
   merged under their GitHub login. In a repository that promotes `develop` into `main`, the
   promotion pull request counts a second time, and reads as signed, because it carries the signed
   commits.
2. **Failures do not show.** The board counts what merged. A slice labelled `omni:needs-fix`, a
   claim nobody finished, or a `/omni:yolo` run that ended held never produces a merged pull
   request, so it is invisible. Nothing on the board says what is stuck right now, or how often
   slices get stuck.

## Solution

**1. Only merges into main count, across the whole board.** A pull request counts when its base is
`main`, `master` or `develop`, and its head is none of the three: a promotion from `develop` into
`main` is not new work, and counts nowhere. The rule applies to every number built from pull
requests: PRs opened, PRs merged, open now, median time to merge, commits, lines, the per-repository
table, the merged-per-day chart, **Most opened**, **Most merged**, and the Omni Loop panel's share,
signed-vs-rest median and lines. On a repository's page (PRD 645) the same rule holds.

The Omni Loop panel gains one line under its lines: **"+ 34 sub-PRs merged into feature
branches"**, the Omni-man-signed pull requests merged in the period into any other base. With none,
the line reads "+ 0 sub-PRs merged into feature branches".

**2. A Loop health panel,** beside Omni Loop, on the board and on each repository's page. It has two
parts.

- **Right now:** every open pull request the loop has stuck, one row each: its kind, then
  `owner/repo#n` linking to the pull request on GitHub, then how long ago it was opened. The kinds,
  and the rule for each, over tracked repositories only:
  - **Stuck:** an open pull request labelled `omni:needs-fix`.
  - **Held:** an open, Omni-man-signed pull request into `main`, `master` or `develop` whose status
    comment says `state: stuck`: a `/omni:yolo` run that ended held, or a fix the loop could not
    finish.
  - **Stale claim:** an open draft sub-PR (Omni-man-signed, into any other base) with no commit
    beyond its claim, opened more than 60 minutes ago. This is the kit's own rule, read from the
    kit's own code, so the board and `omni board` always agree.

  A pull request shows once, under the first kind it meets in that order. At most 10 rows show,
  oldest first, then "and 3 more". With none: **"Nothing stuck right now"**.
- **In the period:** **"4 of 34 merged sub-PRs got `omni:needs-fix` first (12%)"**: of the
  sub-PRs merged in the period, those labelled `omni:needs-fix` at some point before they merged.
  With no sub-PR merged in the period: "No sub-PR merged in this period".

**3. The collector reads what the panel needs.** In the query it already sends, it also reads each
pull request's head branch, whether it is a draft, its labels, the date of its latest commit, and
when `omni:needs-fix` was first added to it. For an open, Omni-man-signed pull request into `main`,
`master` or `develop`, and only for those, it reads the comments in a second, small query to find the
status comment and its `state`. The migration resets every repository's collection cursor, so the
next run reads the last 90 days again and fills the new columns.

### Stored shapes

`public.pull_requests` gains six columns, all additive:

- `head text`: the head branch name.
- `draft boolean not null default false`.
- `labels text[] not null default '{}'`: the label names.
- `head_committed_at timestamptz`: the committed date of the pull request's latest commit.
- `needs_fix_at timestamptz`: when `omni:needs-fix` was first added, from the pull request's
  timeline; null when never.
- `status_state text`: the `state` of the loop's status comment (`claimed`, `implementing`, …,
  `done`, `stuck`), read only for open signed pull requests into `main`, `master` or `develop`;
  null otherwise, or when there is no status comment.

Row-level security is unchanged: members read, the service role writes. The migration also sets
`collected_until` to null on every repository.

## Decisions

- **Reverses PRD 612's "all base branches count, sub-PRs into feature branches included"** (the
  person's choice): the board counts only pull requests into `main`, `master` or `develop`.
- **A fixed set of three branch names** (the person's choice), not each repository's default branch
  and not its `.omni-loop/config.yml`. A repository whose integration branch has another name counts
  nothing on the board until the set grows.
- **A promotion counts nowhere:** a pull request whose head is itself `main`, `master` or `develop`
  is not work, whatever its base.
- **The whole board** follows the rule (the person's choice), not only the Omni Loop panel.
- **Reviews keep counting on every base branch.** A review is a person's act; the loop's sub-PRs are
  not reviewed by people, so the lists do not move, and the reviews read stays as it is.
- **Right now, and a rate over the period** (the person's choice): the list is what someone can
  unblock today; the rate is the history a list cannot keep.
- **Stale is the kit's rule, unchanged** (the person's choice): no commit beyond the claim and older
  than `limits.claimStaleMinutes`, the kit's default of 60 minutes. The board calls the kit's own
  function, which `kit/lib/board.mjs` exports for it. An agent that died after its first push still
  reads as in flight, on the board as in `omni board`; fixing that is a kit bug-fix of its own.
- **Held is the loop's own status comment,** found by the marker `/omni:pr` writes
  (`<!-- omni-outbox-status -->`, which `kit/lib/markers.mjs` gains as `status`), and its
  `state: stuck` line: exactly how `/omni:yolo` ends held. A red feature pull request with
  `omni:needs-fix` shows as stuck, once.
- **The kit's defaults, not each repository's config:** the labels `omni:needs-fix`, the status
  marker prefix `omni-outbox` and the 60 minutes are the kit's defaults, as the Omni-man signature
  check already reads the kit's default signature. A repository that renamed them is not read by
  them.
- **A sub-PR is a signed pull request into any other base,** not the `omni:sub` label: a repository
  with `labels.autoCreate: false` and no such label still has sub-PRs.
- **Comments are read only where a status can hold a run:** open, signed pull requests into a main
  branch, a handful per repository, so the installation's shared GitHub budget (bug 638) barely
  moves.
- **At most 10 rows right now,** oldest first, so a bad day does not push the board down the page.

## User stories

- As the person running Omni Loop, I see the share of real merges Omni-man signed, and his median
  time to merge beside the rest's, without the loop's self-merged sub-PRs in either.
- As an engineer who runs `/omni:yolo`, I am no longer credited in Most opened and Most merged for
  the sub-PRs the loop opened and merged under my login.
- As an engineering lead, I open the Engineering board and see which of the loop's pull requests are
  stuck, held or claimed and abandoned right now, and click through to unblock them.
- As an engineering lead, I see how often the loop's slices got stuck before merging, over 7 days,
  30 days or the season.
- As a Vertuoza member, I see a `develop → main` promotion counted nowhere, so a repository that
  promotes does not count its work twice.

## Scope

**In:** the migration and its check; the collector's new fields, the needs-fix date and the status
state; the counting rule across the board and the repository page; the sub-PR line; the Loop health
panel with its two parts; the demo board's new data; the two kit exports.

**Out:**
- Fixing the kit's stale rule for an agent that died after its first push (a `/omni:bug-fix`).
- The person profile (PRD 698), which lists a person's own pull requests on every base; it is a
  list, not a count, and stays as it is.
- Reading each repository's branch names, labels or limits from its config.
- A history of stale claims and held runs over the period (they are states, with no event to count).
- Notifications, Slack, or any action from the panel beyond the link.
- The game, `contributions`, `game.yml`, the Workspace and Fleet boards.

## Test seams

Following the playbook's testing form: tests sit beside the code, and **no test calls GitHub or
Supabase**.

- **Board math** (`apps/galaxy/src/engineering/tally.test.ts`), pure, with a fixed clock:
  - a pull request into `main`, `master` and `develop` counts; one into a feature branch counts
    nowhere; `develop → main` and `main → develop` count nowhere;
  - every tile, the table, the per-day chart, Most opened, Most merged and the Omni Loop share and
    medians follow the rule; reviews do not;
  - the sub-PR line counts signed pull requests merged into other bases in the period;
  - Loop health right now: stuck, held and stale claim each by its rule; a pull request meeting two
    kinds shows once, under the first; a fresh claim, a claim with a commit beyond it, a closed or a
    merged pull request is not listed; at most 10 rows, oldest first, with the rest counted;
  - the rate: needs-fix before merging counts, needs-fix after merging or never does not; no sub-PR
    merged gives its own words.
- **Collector** (`apps/omni-app/src/pr-stats/`), against a stubbed GitHub and a fake store: the new
  columns mapped from a pull request; `needs_fix_at` is the first `omni:needs-fix` label event and
  null without one; the status query runs only for open signed pull requests into a main branch, and
  `status_state` is read from the marked comment's `state:` line, null with no marked comment.
- **Kit:** `kit/lib/board.test.mjs` still passes with the stale rule exported; `markers.status` is
  `<!-- <prefix>-status -->`.
- **Pages** (`render.test.ts`, `repo-page.test.ts`): the Loop health panel with rows, with more than
  10, and empty; the sub-PR line; the repository page shows both panels.
- **Database** (`supabase/checks/repositories.sql`): a member reads the six new columns, a stranger
  reads none, and nobody signed in writes them; after the migration, every repository's
  `collected_until` is null.

## Risks

Merging publishes:

- **The database.** The supabase workflow applies one migration to production: six nullable or
  defaulted columns on `pull_requests`, and every repository's cursor reset. Its timestamp must sort
  after every migration on `main` at merge time.
- **A 90-day re-read.** The next collections read every tracked repository's last 90 days again.
  The collector pauses at half the installation's budget (bug 638) and carries on at the next run,
  so the re-read may take a few runs. Until a repository is re-read, its older rows have no head,
  labels or dates: the main rule already holds (`base` is stored), promotions still count, and Loop
  health shows less than it will.
- **The numbers drop.** PRs merged, Omni-man's share and his median time to merge fall the moment
  this merges, because sub-PRs leave them. That is the point; the release note says so.
- **The kit.** Two additive exports in `kit/lib/`; the release bundles them. No skill, command or
  config changes.
- **omni-app.** The collector sends one more small query per batch that holds an open signed pull
  request into a main branch. A status comment rewritten with no other change to its pull request is
  seen at that pull request's next update (a push, a label, a new comment).

**Rollback:** revert the pull request. The board and the collector go back to counting every base
branch; the six columns stay, unused, until a follow-up migration drops them.

## Acceptance criteria

- On `/app/engineering`, a sub-PR merged into a feature branch in the period is in none of PRs
  opened, PRs merged, open now, median time to merge, commits, lines, the table, the chart, Most
  opened, Most merged or the Omni Loop share; a pull request merged into `main`, `master` or
  `develop` is.
- A pull request from `develop` into `main` counts nowhere on the board.
- The Omni Loop panel shows "+ N sub-PRs merged into feature branches", N being the signed pull
  requests merged into other bases in the period.
- An open pull request labelled `omni:needs-fix` in a tracked repository shows under Loop health as
  stuck, linked to it on GitHub, within one collection.
- An open signed pull request into `main` whose status comment says `state: stuck` shows as held.
- An open draft sub-PR with only its claim commit, opened more than 60 minutes ago, shows as a
  stale claim; the same pull request 59 minutes after it opened, or with a commit beyond its claim,
  does not.
- With nothing stuck, the panel says "Nothing stuck right now"; with more than 10, it shows 10 and
  "and N more".
- The period line reads "K of M merged sub-PRs got `omni:needs-fix` first (P%)".
- A repository's page shows both panels counted over that repository alone.
- After the migration, every repository is re-read from 90 days back, and running the collector
  twice in a row changes no count.
- The reviews list, the person profile, the game and the other boards show exactly what they showed
  before.
