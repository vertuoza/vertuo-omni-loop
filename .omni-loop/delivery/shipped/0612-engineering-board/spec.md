---
prd: 612
title: Tracked repositories and the Engineering board
blocked-by: none
spec: file
---

# Tracked repositories and the Engineering board

**Date:** 2026-09-29 · **PRD:** #612 · **Touches:** `supabase/migrations/` (two new files),
`supabase/checks/repositories.sql` (new), `apps/omni-app/src/pr-stats/` (new Inngest function),
`apps/omni-app/api/inngest.mjs`, `apps/galaxy/src/repositories/` (new),
`apps/galaxy/src/engineering/` (new), `apps/galaxy/app/app/settings/repositories/` and
`apps/galaxy/app/app/engineering/` (new routes), `apps/galaxy/src/nav/sidebar.ts`.
No change to the game, `sectors`, `contributions`, `.github/workflows/game.yml`, the Workspace
board, or the kit.

## Problem

A workspace's repositories live only in the game's `sectors` table, and a migration is the only way
to change it. Vertuoza has three of them there (vertuo-omni-loop, vertuo-ai-domain,
vertuo-workflow-domain). vertuo-backend-php, vertuo-apps and pdf-builder show up nowhere, even
though Vertuoza's engineers merge pull requests in them every day. No owner can add a repository.

The only pull request numbers the app has come from the game's `contributions` poller
(`game.yml`). It runs for Vertuoza only, on a personal token, and only while the game is switched
on. It counts merged pull requests and PRD events, nothing more. There is no time to merge, no view
of who opens or reviews the most, no commits or lines, and no way to see how much of the work
Omni Loop signs.

## Solution

**Settings → Repositories** (`/app/settings/repositories`, in the sidebar under Settings, beside
Fleets) lists the workspace's repositories, one row each: `owner/name`, a **Tracked** switch, and
the last collection ("collected 3 min ago", "not collected yet", "last collection failed ·
retrying"). An owner's **Add repository** button lists the repositories the workspace's Omni App
installation can see that are not in the list yet. One click adds a repository, tracked. A link
under the list, "Missing one? Give the Omni App access on GitHub →", opens the installation's
settings page on GitHub. A repository the App cannot read shows **"Omni App has no access"** with
the same link, and stays tracked. A member who is not an owner sees the same list, read only.
A workspace with no App installation sees an empty state that links to installing the App.

**The collector.** A new Inngest function in omni-app, `prStats`, runs on a 15-minute cron. For
each workspace with a `github_installation_id`, it takes an installation token and reads every
**tracked** repository. It pulls the pull requests updated since that repository's last successful
collection, sorted by `updated`. The first collection of a repository backfills 90 days. For each
pull request it upserts one `pull_requests` row, its reviews and its Omni-man signature. Each
repository is its own Inngest step, so a failure (rate limit, no access, GitHub error) is recorded
on that repository's row and retried on the next run, without stopping the others. omni-app gains
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for these writes.

**Dashboard → Engineering** (`/app/engineering`, every member, the same 7d / 30d / season picker
as the other boards) shows, over tracked repositories only:

- Tiles: PRs opened · PRs merged · open now · median time to merge · commits · lines +/−.
- A per-repository table, sortable: opened, merged, open now, median time to merge, commits, lines.
- Three top-5 lists of people: **most opened**, **most merged** (who pressed Merge), **most
  reviews**.
- An **Omni Loop** panel: the share of merged pull requests Omni-man signed, their median time to
  merge beside the rest's, and their lines. For example: "31 of 58 merged PRs (53%) · 4.1 h vs
  19.6 h".
- A chart of merged pull requests per day, with the part Omni-man signed.
- With nothing collected yet: "No tracked repositories yet → Settings → Repositories".

**Vertuoza, and only Vertuoza,** starts with six tracked repositories: `vertuoza/vertuo-ai-domain`,
`vertuoza/vertuo-workflow-domain`, `vertuoza/vertuo-omni-loop`, `vertuoza/vertuo-backend-php`,
`vertuoza/vertuo-apps` and `vertuoza/pdf-builder`. They come from a migration that inserts them for
the workspace whose slug is `vertuoza`, and does nothing when there is no such workspace. No other
workspace is seeded with anything: a new workspace starts with an empty list.

### Stored shapes

- `public.repositories`: `workspace_id`, `full_name` (`owner/name`, lower case, unique per
  workspace), `tracked boolean default true`, `added_by`, `added_at`, `collected_at`,
  `collected_until` (the `updated` cursor), `collect_error text`.
  Members read it (`is_member`). Only the security-definer RPCs write it:
  `add_repository(p_workspace, p_full_name)` and
  `set_repository_tracked(p_workspace, p_full_name, p_tracked)`, both owner-only through a guard
  that raises `42501`, following `20261003090000_own_fleets.sql`. The service role writes the
  collection columns.
- `public.pull_requests`: `workspace_id`, `repo`, `number` (unique together), `author`,
  `author_is_bot`, `opened_at`, `merged_at`, `closed_at`, `merged_by`, `base`, `commits`,
  `additions`, `deletions`, `omni_signed boolean`. Members read, the service role writes.
- `public.pull_request_reviews`: `workspace_id`, `repo`, `number`, `reviewer`, `first_at`
  (unique on repo, number, reviewer). Members read, the service role writes.

## Decisions

- **One PRD for both** the repository list and the statistics (the person's choice): the
  statistics are useful only over the repositories the list adds.
- **The Omni GitHub App collects**, not the game's personal token. It works for any workspace, and
  it does not depend on the game.
- **The collector runs in omni-app on Inngest**, which gets the Supabase service key. Galaxy
  already had the key; the person chose Inngest's retries and per-repository steps.
- **Adding is picking from the App's repositories**: no typing, no typos. A repository the App
  cannot see is added by granting the App access on GitHub.
- **Off hides and keeps.** Switching tracking off stops collection and hides the repository from
  the Engineering board. Its rows stay, so switching it back on brings back its history. There is
  no delete in this PRD.
- **New tables, the game untouched.** `repositories` is not `sectors`. Deleting the game changes
  nothing here, and this PRD changes nothing in the game.
- **Counting rules:**
  - *Opened* counts pull requests whose `opened_at` is in the period, credited to their author.
  - *Merged* counts pull requests whose `merged_at` is in the period. Its people list credits
    `merged_by`, the person who pressed Merge.
  - *Open now* counts the pull requests with neither `merged_at` nor `closed_at` set, whatever the
    period.
  - *Time to merge* is `merged_at − opened_at`, as a median over the pull requests merged in the
    period.
  - *Commits* and *lines* are summed over the pull requests merged in the period.
  - *Reviews* are submitted reviews of any state, once per reviewer per pull request, dated at the
    first one, and never by the pull request's author.
  - All base branches count, sub-PRs into feature branches included.
- **Bots.** Every bot account (a login ending in `[bot]`, or GitHub's `type: Bot`) is left out of
  the people lists but still counted in the tiles and the per-repository table. Omni-man is never
  in the people lists: he has the Omni Loop panel instead.
- **Omni-man signed** means any one of three things: one of the pull request's commits carries the
  trailer `omni sign trailer` prints (its e-mail is the key), the body carries the
  `<!-- omni-loop:signed -->` footer marker, or `omni-loop-invader[bot]` opened it. The person who
  opened a signed pull request keeps their credit in the people lists.
- **Backfill 90 days** on a repository's first collection, which covers every period the board
  offers.

## User stories

- As a workspace owner, I add a repository from Settings by clicking it in the list of what the App
  can see, and it is tracked at once.
- As a workspace owner, I switch a repository's tracking off, and the Engineering board stops
  counting it.
- As a member, I open Dashboard → Engineering and see how many pull requests were opened, merged
  and are open, and how long a merge takes, per repository.
- As an engineering lead, I see who opens, merges and reviews the most over 7 days, 30 days or the
  season.
- As the person running Omni Loop, I see what share of merged work Omni-man signed, and whether it
  merges faster.
- As a Vertuoza member, I find vertuo-backend-php, vertuo-apps and pdf-builder on the board without
  anyone typing them in.

## Scope

**In:** the three tables and their RPCs. The Vertuoza-only seed. The `prStats` Inngest function.
The Settings → Repositories page. The Engineering board. Two sidebar entries.

**Out:**
- Deleting a repository.
- Webhook-driven, real-time updates (the 15-minute cron only).
- Deployments, CI times, issue statistics.
- Changing the game, `sectors`, `contributions`, `game.yml` or the Workspace board.
- Seeding any workspace other than `vertuoza`.
- Granting the App access to repositories on GitHub, which an org admin does by hand.

## Test seams

Following the playbook's testing form: tests sit beside the code (`*.test.mjs` under
`apps/omni-app/`, `*.test.ts` under `apps/galaxy/src/`), and **no test calls GitHub or Supabase**.

- **Collector** (`apps/omni-app/src/pr-stats/`), against a stubbed GitHub and a fake store:
  - the first run backfills 90 days, and the next run reads only what was updated after the cursor;
  - running twice writes the same rows (the upsert never double-counts);
  - a rate limit or a 404 on one repository records `collect_error` on that repository only, and
    the others are still collected;
  - an untracked repository is not read;
  - `omni_signed` is set by a trailer, by the footer marker and by the bot author, and left false
    otherwise;
  - a self-review is dropped, and a reviewer's several reviews make one row.
- **Board math** (`apps/galaxy/src/engineering/`), pure: the median time to merge for even and odd
  counts and for none; the top-5 lists with ties, bots removed and Omni-man removed; the Omni Loop
  share; the period bounds.
- **Pages**: Settings → Repositories as owner, member, empty, no installation and no access; the
  Engineering board with data and empty.
- **Database**: `supabase/checks/repositories.sql` checks that a non-owner is refused
  `add_repository` and `set_repository_tracked` (`42501`), that a member reads and a stranger reads
  nothing, that anon and authenticated users cannot write any of the three tables directly, and
  that the seed adds the six repositories to `vertuoza` and nothing to any other workspace.

## Risks

Merging publishes:

- **The database.** The supabase workflow applies two migrations to production: the three new
  tables with their RPCs, and the Vertuoza seed. Both are additive. Their timestamps must sort
  after every migration on `main` at merge time. PRD 587's feature branch also adds migrations, so
  a clash is renamed before merge (as PRD 517 had to).
- **omni-app.** A new Inngest function. It stays silent until someone presses **Resync** in
  Inngest, and until `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set on the omni-app Vercel
  project. With either missing, the function logs one line and writes nothing.
- **GitHub rate limit.** The 90-day backfill of six busy repositories spends installation API
  calls. Each repository is its own step, and a rate limit ends that step early and resumes from
  the cursor on the next run.
- **App access.** Any of the six repositories that the Vertuoza installation of `omni-loop-invader`
  cannot read shows "Omni App has no access" until an org admin grants it.

**Rollback:** switch the repositories off in Settings to stop collection, or revert the PR. The
tables are new, so dropping them (a follow-up migration) touches nothing else. The ledger and the
game are not involved.

## Acceptance criteria

- On `/app/settings/repositories`, an owner of `vertuoza` sees the six seeded repositories, each
  tracked.
- An owner clicks **Add repository**, sees only repositories the App can see that are not listed
  yet, clicks one, and it appears tracked. A member who is not an owner sees no Add button and no
  switch they can change, and a direct RPC call from them is refused.
- Switching a repository off removes it from every number on the Engineering board within one
  page load. Switching it back on brings its history back.
- A repository the App cannot read shows "Omni App has no access" and a link to the installation's
  settings. The other repositories are still collected.
- Within 15 minutes of an added repository being collected, `/app/engineering` shows its PRs
  opened, merged and open now, and its median time to merge, for 7d, 30d and season.
- The three people lists each show at most five people, never a `[bot]` account and never
  Omni-man. A review of one's own pull request is not counted.
- The Omni Loop panel shows the share of merged pull requests Omni-man signed, and their median
  time to merge beside the others'.
- A workspace other than `vertuoza` starts with no repositories, and its Engineering board shows the
  empty state.
- Running the collector twice in a row changes no count.
- The game, `sectors`, `contributions` and the Workspace board show exactly what they showed
  before.
