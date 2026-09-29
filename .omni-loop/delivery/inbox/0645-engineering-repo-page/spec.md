---
prd: 645
title: Engineering board — top people with avatars and a page per repository
blocked-by: none
spec: file
---

# Engineering board — top people with avatars and a page per repository

**Date:** 2026-09-29 · **PRD:** #645 · **Touches:** `apps/galaxy/src/engineering/` (tally, load,
board, demo, CSS), `apps/galaxy/app/app/engineering/[owner]/[repo]/page.tsx` (new route).
No migration, no change to the collector (`apps/omni-app/src/pr-stats/`), the game, the kit, or
any other board.

## Problem

The Engineering board (PRD 612, `/app/engineering`) has two gaps a reader hits at once:

1. **The top-5 lists are hard to read.** Most opened, Most merged and Most reviews are plain
   `<ol>` lists. Each row sets the name and the count in the same bold run
   (`pierrederval 676`): the count is not aligned, nothing separates it from the name, and nothing
   shows how far the first person is ahead of the others.
2. **There is no way to see one repository.** The Repositories table gives one row per tracked
   repository, but a name is plain text. The tiles, the Omni Loop panel, the per-day chart and the
   three lists always count every tracked repository together, so "who merges in pdf-builder?"
   has no answer.

## Solution

**1. Top people as ranked rows with bars (design A, with avatars).** Each of the three lists keeps
its place and title and becomes five rows. A row shows the rank (muted), an avatar (28 px), the
login, and the count right-aligned in tabular figures. Under them runs a thin bar whose length is
the count divided by the list's first count. The bar is plasma for Most opened, green for Most
merged and cyan for Most reviews, all tokens the theme already has.

The **avatar** is, in this order:

- the person's **game hero**: drawn on the server as a pixel SVG in their fleet's colour, the way
  the hero block on `/app` draws it (`heroLook` + `spritePixels`). It is used when the login
  matches (case-insensitively) the `github_login` of a player in the reader's workspace whose
  stored hero is valid.
- otherwise their **GitHub picture**, `https://github.com/<login>.png?size=56`, as a round `<img>`
  with an empty `alt` (the login is written beside it).

The game stays a removable layer: the board reads players only to pick a face. With no player
rows, or with the players read failing, every row falls back to the GitHub picture and the board
still renders. A failed players read never turns the board into "could not load".

**2. A page per repository.** In the Repositories table, each repository name becomes a link to
`/app/engineering/<owner>/<repo>`, and the link keeps the current `?period=`. The new page shows,
top to bottom:

- `← All repositories`, a link back to `/app/engineering` with the same period;
- the repository `owner/name` as the page's one heading;
- the period switch, whose links stay on this page;
- the six tiles, the Omni Loop panel, Merged per day, and the three top-people lists, all counted
  over that repository alone.

It has no Repositories table: one row would repeat the tiles. It is the same computation as the
board (`engineeringOf`), fed with one tracked repository, and it runs the same reads narrowed to
that repository.

## Decisions

- **Own route, not a filter** (asked): `/app/engineering/<owner>/<repo>` is a shareable address.
  The sidebar's prefix match keeps "Engineering" highlighted there.
- **Design A plus avatars** (asked, from a lab of five designs): hero first, GitHub picture as the
  fallback.
- **Who has a page:** only a repository the workspace **tracks**. Any other `owner/repo`, an
  untracked one, or a signed-in person in no workspace gets the same situations as the board
  (demo, closed, sign-in card, no-workspace notice), and an untracked or unknown repository gets
  Next's `notFound()`. The match is case-insensitive, and the heading shows the tracked spelling.
- **Faces read:** one extra read per board, `players` rows whose `github_login` is one of the at
  most 15 logins shown, with their `hero` and their fleet's colour. Row-level security already lets
  a member read their workspace's players. A player with no fleet, or a fleet colour that is not a hex, is
  drawn in the hero's own colours (`heroLook` with no tint), as the hero block does.
- **No new stored data:** everything is computed from `pull_requests`, `pull_request_reviews`,
  `repositories` and `players` as they are today.
- **Demo:** `demoEngineeringBoard` gains a repository argument, and the demo's people get a mix of
  heroes and GitHub pictures, so both kinds of face show without a database.

## User stories

- As a member reading the Engineering board, I see at a glance who leads each list, by how much,
  and with the face I know them by.
- As a member, I click `vertuoza/pdf-builder` in the table and read that repository's own
  opened/merged counts, time to merge, per-day chart and top people, for the same period.
- As a member, I send `/app/engineering/vertuoza/pdf-builder?period=30d` to a colleague, and it
  opens on the same view for them.

## Scope

In: the three lists' new look with avatars, the faces read, the repository links in the table, the
per-repository route and its demo, and the tests below.

Out: a list of a repository's open pull requests, per-person pages, new metrics, a period other
than 7d/30d/season, changes to the collector or the schema, and any change to the other dashboards'
People tables.

## Test seams

Following `omni kb show testing`: vitest beside the code; no test calls GitHub or Supabase.

- `tally.test.ts`: `engineeringOf` fed one tracked repository counts only its pull requests and
  reviews (tiles, people, omni, perDay), even when the rows hold other repositories. The bar ratio
  (count ÷ leader) is exact, and a list of one person is at 100 %.
- A pure `faceOf(login, players)` (new, in `src/engineering/`): a hero for a matching player with a
  valid hero, whatever the login's case; the GitHub picture for no player, an invalid hero, or a
  login with characters a URL needs escaped (it is encoded).
- `load.test.ts`: the one-repository load asks for that repository only (`.eq('repo', …)` on the
  fake client), returns "not tracked" for a repository outside the tracked list, and a failing
  faces read still returns the board, with every face on the GitHub picture.
- `render.test.ts`: a list row renders the rank, the avatar (an SVG for a hero, an `<img>` with
  `alt=""` for GitHub), the login, the right-aligned count and a bar whose width is the ratio. A
  repository name in the table is a link to its page carrying `?period=`. The repository page
  renders the back link, the heading, and no Repositories table.
- `page.test.ts` for the new route: demo, closed, signed out, no workspace, a tracked repository,
  and an untracked one (`notFound`). The period defaults to 7d.
- `src/nav/sidebar.test.ts`: `/app/engineering/vertuoza/pdf-builder` marks Engineering current.

A manual browser pass at 1280 px and at 393 px, light and Omni themes: rows do not wrap the count
under the name, the bars line up, and both kinds of avatar show.

## Risks

A merge to `main` publishes the galaxy app (a Vercel deploy); nothing here reaches the database
or the kit. The risks are:

- **GitHub pictures load from `github.com`.** A reader's browser asks GitHub for each picture
  (the login is already on the page). If a content-security policy later blocks it, the `<img>`
  shows its empty box and the row still reads.
- **One more read per board** (the faces). It is small (at most 15 logins) and fails soft.

Rollback: revert the feature PR's merge commit. No stored shape changes, so nothing else is
undone.

## Acceptance criteria

1. On `/app/engineering`, each of Most opened, Most merged and Most reviews shows up to five rows
   with a rank, an avatar, the login, a right-aligned count and a bar scaled to the first row's
   count, in that list's colour.
2. A person whose GitHub login is a player in the workspace shows their game hero in their fleet's
   colour. Anyone else shows their GitHub picture.
3. With the players read failing, the board still renders, and every avatar is the GitHub picture.
4. Each repository name in the Repositories table links to `/app/engineering/<owner>/<repo>`,
   keeping the current period.
5. `/app/engineering/<owner>/<repo>` for a tracked repository shows `← All repositories`, the
   repository as the heading, the period switch (whose links stay on the page), the six tiles, the
   Omni Loop panel, Merged per day and the three lists, all counted over that repository only, and
   no Repositories table.
6. The same address for a repository the workspace does not track returns a 404. Signed out, it
   shows the sign-in card, and in demo mode it shows the demo repository board.
7. The sidebar keeps Engineering marked current on a repository page.
8. At 393 px wide, nothing scrolls sideways, and a long login wraps without pushing the count off
   its column.

Acceptance scenarios: none. `acceptance.enabled` is false here, so these criteria become ordinary
tests (the seams above).
