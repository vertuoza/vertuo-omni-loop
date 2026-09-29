# Plan: Person profile and chip links

PRD #698, spec in `spec.md` beside this plan. The feature branch `feat/person-profile` goes into
`main` with `Closes #698`. Each slice below is a sub-PR from `feat/person-profile--<slice>` into the
feature branch with `Part of #698`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Person and fleet chips are links (person → `/app/people/<login>`, fleet → `/app/fleet?fleet=<name>`), plain inside another link, and no page nests `<a>` in `<a>` | `apps/galaxy/src/people/` `apps/galaxy/src/nav/Bell` `apps/galaxy/src/fixes/FixList.tsx` `apps/galaxy/src/fixes/render.test.ts` `apps/galaxy/src/ask/page/ForMe` `apps/galaxy/src/ask/page/WorkspaceHistory` `apps/galaxy/src/ask/page/history-render.test.ts` `apps/galaxy/src/ask/page/ShareButton` `apps/galaxy/src/ask/page/share-render.test.ts` `apps/galaxy/src/dashboard/fleet/FleetScreen` `apps/galaxy/src/dashboard/fleet/render.test.ts` | — | 1 |
| s2 | The avatar menu has **My profile** between the name and Sign out, opening `/app/people/<viewer login>` | `apps/galaxy/src/nav/UserMenu` `apps/galaxy/src/nav/user-menu` `apps/galaxy/src/nav/viewer-view` | — | 1 |
| s3 | A profile page at `/app/people/<login>`: header, the person's board per period, their pull requests and reviews, and its states (not in this workspace, signed out, demo, closed, no tracked repository) | `apps/galaxy/src/profile/` `apps/galaxy/app/app/people/` | — | 1 |
| s4 | `/prd`, `/bugs` and `/visual` accept `who=<login>`, with the "Opened by / Asked by @login" line | `apps/galaxy/src/fixes/list` `apps/galaxy/src/fixes/FixList.tsx` `apps/galaxy/src/fixes/FixListRoute` `apps/galaxy/src/fixes/routes.test.ts` `apps/galaxy/src/fixes/render.test.ts` `apps/galaxy/src/dossier/page/history` `apps/galaxy/src/dossier/page/DossierHistory` `apps/galaxy/app/prd/page.tsx` `apps/galaxy/app/bugs/page.tsx` `apps/galaxy/app/visual/page.tsx` | s1 | 2 |
| s5 | The profile lists the PRDs they opened, the bug fixes and visual updates they asked for, 10 per period, with **see all** to `who=<login>` | `apps/galaxy/src/profile/` `apps/galaxy/app/app/people/` | s3, s4 | 3 |

**Shared ground.**

- `apps/galaxy/src/fixes/FixList.tsx` and `apps/galaxy/src/fixes/render.test.ts`: s1 draws the
  asked-by chip plain inside the row link, and s4 adds the `who=<login>` line and toggle state. s4
  waits for s1 (wave 2).
- `apps/galaxy/src/profile/` and `apps/galaxy/app/app/people/`: s3 builds the page, and s5 adds the
  work lists to it. s5 waits for s3 (wave 3).
- `apps/galaxy/src/nav/`: s1 owns `Bell*` and s2 owns `UserMenu*`, `user-menu*` and `viewer-view*`;
  the prefixes do not meet, so both run in wave 1.

## Per slice: done when

**s1**
- `Person` carries an optional `login`, filled by `People.byId` and `People.byLogin`.
- `PersonChip` with a login renders a link to `/app/people/<login>`, and without one renders the
  `<span>` of today. `FleetChip` renders a link to `/app/fleet?fleet=<name>`, and SOLO stays a
  `<span>`. Both take `link={false}`, and then render a `<span>`.
- The bell lines, fix list rows, ask history rows, the "for me" link, the fleet picker and the share
  button pass `link={false}`. A test renders each of them and finds no `<a>` inside an `<a>`.
- A linked chip has no underline at rest. On hover or focus only its name (the person's name or the
  fleet's label) is underlined, never the face or mascot, and focus shows a visible ring.

**s2**
- **My profile** is a `menuitem` between the name block and Sign out, linking to
  `/app/people/<viewer login>`, reached with the arrow keys, Home and End.
- A viewer with no GitHub login sees no **My profile**.

**s3**
- `/app/people/<login>` of a member of the viewer's workspace shows these parts, all following
  `?period=7d|30d|season` (7d by default):
  - the header: face, name, a GitHub link for `@login`, a fleet chip or SOLO, and their season place
  - their board, the home *you* scope built with their id and login: points, PRs, PRDs and answers,
    the answers read as a count only
  - their pull requests (`owner/repo#n`, opened or merged, `+/-`, a GitHub link) and their reviews
    (`owner/repo#n`, the date of their first review), at most 10 each
- The pure selection functions in `apps/galaxy/src/profile/` (by person and period, capped at 10,
  whether more exist) have unit tests.
- A login outside the workspace shows "not in this workspace", with no data. Signed out shows the
  sign-in card, and demo and closed behave as `/app/fleet` does.
- An empty list reads "nothing in this period". A workspace with no tracked repository shows that
  line, linking to Settings › Repositories, under both pull request lists.
- No migration, and no GitHub read.

**s4**
- `who=<login>` on `/prd` keeps the PRDs that person opened. On `/bugs` and `/visual` it keeps the
  fixes they asked for. Each uses the rule *Mine* uses for the viewer.
- Under `who=<login>`, neither Mine nor All is pressed. A line reads "Opened by @login" (on `/prd`)
  or "Asked by @login" (on the fix lists), and links to their profile. The filter form keeps
  `who=<login>`.
- There are route and render tests for all three lists, and `who=mine` and `who=all` behave as
  today.

**s5**
- The profile shows three lists, each for the chosen period, at most 10 rows, then **see all**
  linking to `/prd?who=<login>`, `/bugs?who=<login>` or `/visual?who=<login>`:
  - **PRDs** they opened: `#n`, the title and the stage pill, each linking to its dossier page
  - **Bug fixes** they asked for: the `/bugs` row with its state pill, linking to the fix's page
  - **Visual updates** they asked for: the `/visual` row with its state pill
- The fix rows come from the fix lists' own reader, so the profile makes no GitHub read beyond what
  `/bugs` and `/visual` already make.
- The render tests cover full lists, empty lists and **see all**.
