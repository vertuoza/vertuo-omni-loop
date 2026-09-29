---
prd: 698
title: Person profile and chip links
blocked-by: none
spec: file
---

# Person profile and chip links

**Date:** 2026-09-29 · **PRD:** #698 · **Touches:** `apps/galaxy/src/people/` (the chips), a new
`apps/galaxy/src/profile/` and route `app/app/people/[login]/`, `apps/galaxy/src/nav/UserMenu.tsx`,
the chip call sites PRD 652 added, and the `who` filter of `/prd`, `/bugs` and `/visual`. No
migration, no change to the game, the kit or the omni-app.

## Problem

PRD 652 gave the app one `PersonChip` and one `FleetChip`, drawn in 21 places. Neither goes
anywhere: a chip is a `<span>`. Seeing "Anna · PIRATES" on a board, you cannot open Anna, nor the
Pirates fleet, without retyping an address.

There is also no page for a person. The home board (`/app`) is always *you*; `/app/fleet` and
`/app/workspace` show a fleet and the whole workspace. Nothing shows one colleague's numbers and
work, and the avatar menu has no way to reach your own: it holds your name, `@login` and Sign out.

## Solution

**A profile page per person,** `/app/people/<login>`, where `<login>` is the GitHub login in lower
case. It is read-only and resolved in the viewer's workspace (the one `/app/fleet` uses,
`memberWorkspace`), through the people directory (`People.byLogin`). A login that is no member of
that workspace renders "not in this workspace", never data of another workspace. From top to bottom:

1. **Header:** the person's face (hero, else GitHub photo, else initial, as PRD 652's `faceOf`),
   name, `@login` linking to `https://github.com/<login>`, their `FleetChip` (a link) or SOLO, and
   their season place.
2. **Board:** the home board's *you* scope built for this person (`Scope { kind: 'you', userId,
   login }` with their id and login), with the same 7d / 30d / season tabs (`?period=`) and the same
   numbers: points, pull requests, PRDs, answers. The answers count comes from the existing
   count-only read; no question or answer text is ever read for another person.
3. **Their work**, five short lists, each filtered by the chosen period, newest first, at most 10
   rows, then **see all** when more exist:
   - **PRDs** they opened (a PRD dossier's `opened_by`, or its issue's author, the rule `/prd`'s
     *Mine* already uses): `#n` and title, the stage pill (`STAGE_LABELS`), linking to its dossier
     page. See all: `/prd?who=<login>`.
   - **Bug fixes** they asked for (the rule `/bugs`'s *Mine* uses): the `/bugs` row, state pill
     included, linking to the fix's page. See all: `/bugs?who=<login>`.
   - **Visual updates** they asked for: the same, on `/visual`. See all: `/visual?who=<login>`.
   - **Pull requests** they authored in the workspace's tracked repositories (`pull_requests.author`):
     `owner/repo#n`, opened or merged date, `+additions −deletions`, linking to GitHub.
   - **Reviews:** pull requests they reviewed (`pull_request_reviews.reviewer`): `owner/repo#n` and
     the date of their first review, linking to GitHub.
4. **Empty states:** an empty list reads "nothing in this period". A workspace with no tracked
   repository says so under the two pull request lists, with a link to Settings › Repositories.

Your own profile is the same page; nothing on it is editable.

**The chips become links.**

- `Person` gains an optional `login` (lower case); `People.byId` and `People.byLogin` fill it.
  `PersonChip` renders an `<a class="person-chip" href="/app/people/<login>">` when it has a login,
  and today's `<span>` when it has none.
- `FleetChip` renders an `<a href="/app/fleet?fleet=<name>">`; SOLO stays a `<span>`.
- Both take `link?: boolean` (default `true`). A chip drawn inside another link or button passes
  `link={false}` and stays a `<span>`, so no page ever nests `<a>` in `<a>` and a click there still
  goes where it goes today: the bell's lines, the fix list rows, ask history rows, the ask "for me"
  link, the fleet picker, and the share button.
- A linked chip looks like today's chip, plus the app's link hover (underline on the name) and a
  visible focus ring.

**My profile in the avatar menu.** `UserMenu` gets a **My profile** menu item between the
name/`@login` block and Sign out, linking to `/app/people/<viewer login>`. It follows the menu's
existing WAI-ARIA menu-button keyboard pattern (arrow keys, Home/End, Escape). A viewer with no
GitHub login sees no such item.

**`who=<login>` on the lists.** `/prd`, `/bugs` and `/visual` accept `who=<login>` besides `mine` and
`all`: the rows that person opened or asked for, by the same rule *Mine* uses for the viewer. The
Mine / All toggle shows neither as pressed under `who=<login>`, and a line above the list reads
"Opened by @login" (or "Asked by @login") with a link to their profile.

## Decisions

- **The route is `/app/people/<login>`**, the GitHub login, not a user id: it is readable, stable per
  workspace (`players` is `unique (workspace_id, github_login)`), and the chips resolved by login
  (engineering, fixes) have no user id.
- **Read-only, and nothing new exposed.** Every number and row on the profile is already readable by
  any member on `/app/workspace`, `/app/fleet`, `/app/engineering`, `/prd`, `/bugs` or `/visual`.
- **No migration.** Pull requests and reviews are readable by members under existing row-level
  security; the roster already carries the login.
- **Fix rows reuse the fix lists' reader,** so the profile makes no GitHub call `/bugs` and
  `/visual` do not already make, and gets PRD 691's stored facts for free once it merges.
- **A chip inside another link stays plain** rather than restructuring those rows.
- **10 rows per list, filtered by the board's period,** so the page stays one screen of work.

## User stories

- As a member looking at a board, I click a colleague's chip and land on their profile.
- As a member, I click a fleet chip anywhere and land on that fleet's board.
- As anyone signed in, I open the avatar menu and choose **My profile** to see my own page.
- As a member on a profile, I switch 7d / 30d / season and both the board and the lists follow.
- As a member, I follow **see all** under someone's bug fixes and land on `/bugs?who=<login>`.

## Scope

In: the profile route and module, the link behaviour of both chips and their call sites, the menu
item, the `who=<login>` filter on the three lists.

Out: editing a profile, a list of all people, profiles across workspaces, any new stored data, any
change to the game, the kit or the omni-app.

## Test seams

Tests follow `omni kb show testing`: `*.test.ts` beside the code under `apps/galaxy/src/`, run by
`pnpm test`, never calling GitHub or Supabase.

- **`src/profile/`** pure functions: choose the rows of one person and one period, cap at 10 and
  say whether more exist, build each **see all** address. Unit tests with small, named rows.
- **Profile page render:** header, board, the five lists, each empty state, the no-repository line,
  "not in this workspace", signed out (the sign-in card), demo and closed as `/app/fleet`.
- **Chips:** `PersonChip` with and without a login, `link={false}`; `FleetChip` for a fleet and SOLO.
- **No nested links:** a test renders every screen that draws a chip inside a link (bell, fix list,
  ask history, "for me", fleet picker, share button) and asserts no `<a>` contains an `<a>`.
- **Menu:** **My profile** is a menuitem with the right address, reached by the arrow keys, absent
  without a login.
- **Routes:** `who=<login>` on `/prd`, `/bugs`, `/visual` keeps only that person's rows, and the toggle
  and the "Opened by / Asked by" line render as stated.

## Risks

A merge to `main` publishes the galaxy app only: no migration runs, and the kit is untouched.
Rollback is reverting the feature PR. The one behaviour change on existing screens is that chips
become clickable; a wrongly linked chip is cosmetic and reverted with the same PR. A page that reads
the fix lists' GitHub facts inherits their rate budget; the profile reads at most the same facts as
one `/bugs` and one `/visual` load.

## Acceptance criteria

Acceptance scenarios are off in this repository (`acceptance.enabled` is false); each criterion
becomes an ordinary test.

1. Clicking a `PersonChip` that has a login, outside another link, opens `/app/people/<login>`.
2. Clicking a `FleetChip` of a fleet, outside another link, opens `/app/fleet?fleet=<name>`; SOLO is
   not a link.
3. No rendered page contains an `<a>` inside another `<a>`.
4. The avatar menu shows **My profile**, between the name and Sign out, opening
   `/app/people/<viewer login>`; it is reachable with the keyboard.
5. `/app/people/<login>` of a member shows their header, their board for `?period=` (7d by default),
   and the five lists of that period, at most 10 rows each, with **see all** when more exist.
6. `/app/people/<login>` of someone outside the viewer's workspace shows "not in this workspace" and
   no data.
7. `/prd?who=<login>`, `/bugs?who=<login>` and `/visual?who=<login>` list only that person's rows,
   with the "Opened by / Asked by @login" line linking to their profile.
8. No migration, and no GitHub read beyond those `/bugs` and `/visual` already make.
