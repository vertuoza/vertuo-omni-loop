---
prd: 652
title: Person and fleet chips everywhere
blocked-by: [645]
spec: file
---

# Person and fleet chips everywhere

**Date:** 2026-09-29 · **PRD:** #652 · **Touches:** `apps/galaxy/src/people/` (new), every screen
listed under **Scope**, the board/fleet/ranking loads, `apps/galaxy/src/nav/viewer.ts`, and one
migration that adds `hero` to `public.workspace_roster`. No change to the game, the kit or the
omni-app.

## Problem

The Omni app names people and fleets in 26 places, and almost all of them are bare text. The Home
board's **Your team** table reads `PIERRE ◀ | ■ PIRATES`. The engineering lists, the ask and
dossier "asked by / answered by" lines, the bell and the outbox show a name or an `@login` and
nothing else. Only two places draw a face: the hero block on `/app` and the GitHub avatar in the
user menu. Mascots appear only on Settings › Fleets and the landing page.

The data is there but it gets lost on the way. The roster read already carries the GitHub avatar,
which the People table never draws. The player's arcade hero is stored in `public.players.hero`,
but no member read returns it. Each fleet's `mascot` reaches the galaxy view, then the board,
fleet and ranking loads drop it (`Pick<Fleet, 'name' | 'label' | 'color' …>`). There is no shared
component, so every screen formats a person its own way.

The page also says **team** where the product word is **fleet**.

## Solution

**Two atomic chips, drawn once and used everywhere** (design **A · Bare sprite**, picked from five
rendered directions). The picture sits inline with no frame, beside the name in the row's weight.

- **`PersonChip`** (`src/people/PersonChip.tsx`) takes a `Person`: `{ name, face }`. It renders
  the face (24 px in tables, 18 px in a sentence: `size="table" | "inline"`) and then the name.
  The face is decided once, by `faceOf` (below), and carried as data. The chip is then a plain
  component that also works inside client components, because it never computes a face itself.
- **`FleetChip`** (`src/people/FleetChip.tsx`) takes a `FleetTag` (`{ name, label, color, mascot }`)
  or `'solo'`. It renders the mascot, drawn by the existing `mascotSvg`, which falls back to a
  caped hero in the fleet colour when the fleet has no mascot. The label follows, in the fleet
  colour. `'solo'` renders the grey **SOLO** text of today.

**The face, in this order** (`faceOf`, a pure function in `src/people/face.ts`, lifted from PRD
645's engineering `faceOf` and replacing it):

1. the person's **arcade hero**, when their player row holds a valid hero (`validHero`). It is
   drawn as a pixel SVG string, tinted in their fleet's colour exactly as the hero block on `/app`
   draws it: `heroLook` → `spritePixels` → `pixelSvg`, with no tint when the fleet colour is not a
   hex;
2. else their **GitHub photo**: the roster's `avatar_url` when it has one, else
   `https://github.com/<login>.png?size=48` (the login URL-encoded), as a round `<img alt="">`;
3. else an **initial** in a neutral circle: the name's first letter.

The picture is decorative (`alt=""`, `aria-hidden` on the SVG in a chip), because the name is
always written beside it. Screen-reader text and every row's text content stay as they are today.

**One people directory per page.** `loadPeople(db, workspace)` (`src/people/load.ts`) reads
`workspace_roster` (which now returns `hero`) and the workspace's fleets once. It returns a
`People` value with `byId(userId)` and `byLogin(login)` (case-insensitive), each a `Person` with
its fleet `FleetTag`. A screen that holds an account id (ask, dossier, bell) resolves it with
`byId`. A screen that holds only a GitHub login (engineering, outbox replies, fix timelines)
resolves it with `byLogin`. A login that matches no member still gets a face, from step 2's GitHub
URL. When the directory read fails, every person falls back to the GitHub photo or the initial,
and the page renders as it does today: a failed faces read never turns a screen into "could not
load". This keeps the game a removable layer.

**Fleets keep their mascot.** `FleetTag` gains `mascot: string | null`. The board's `SeasonView`
pick, `fleetTags()`, the you-block's fleet, `FleetHead` (`/app/fleet`) and `FleetRank` (ranking and
picker) carry `color` and `mascot` through, since both are already on the galaxy's `Fleet`.

**Home's heading.** `Your team` becomes **Your fleet** followed by the viewer's `FleetChip`. A solo
player reads **Your fleet · SOLO**, with today's solo note under the table.

**The user menu.** Its avatar button shows the viewer's own face through the same `faceOf`, so
it becomes your hero when you have one. The viewer read gains the viewer's player row (hero and
fleet colour) in the current workspace. When that read fails, the menu keeps today's GitHub avatar
or initial.

## Decisions

- **Hero first, then GitHub, then an initial** (asked).
- **Design A · Bare sprite** (asked, from five rendered directions: bare, pill, arcade tile, hero
  with fleet badge, two lines). A fleet row keeps its mascot inline in the same way.
- **All 26 spots in this PRD** (asked), except the `<select>` dropdowns (Ask history's Asked
  by / Answered by, Share with). A browser cannot draw a picture inside an `<option>`, so they stay
  text.
- **Heading: "Your fleet" and then the fleet chip** (asked). The word *team* leaves the People
  heading.
- **Blocked by PRD 645** (asked): this PRD lifts 645's engineering `faceOf` into `src/people/` and
  moves the engineering lists onto `PersonChip`, so it waits for 645 to merge.
- **One directory, not one read per screen**: `workspace_roster` is the one member read that holds
  the login, the avatar and the fleet. It gains `hero`. `ask_members` stays as it is (it carries the
  email the Share button uses), and the names a screen prints today stay as they are, since only the
  picture is added.
- **The migration replaces the function**: a changed return type needs
  `drop function public.workspace_roster(uuid)` and then `create function`, with the same
  `security definer`, member guard and grants, and `hero jsonb` as a sixth column. It only adds a
  column, so the old app keeps working against the new function (it ignores `hero`).
- **Unknown logins use the public GitHub photo URL**: no API call and no token, and a login not in
  the workspace still gets a real face.
- **The chip carries a decided face, not raw data**, so a client component (the ask question
  page) renders it from props without importing `@omni/design`.

## User stories

- As a member on Home, I see **Your fleet [pirate] PIRATES**, and each row of the table starts with
  my colleague's hero or GitHub photo, so I know who is who at a glance.
- As a member reading a dossier's questions, I see who asked and who answered by their faces, not
  only their names.
- As a member on the Workspace board, each fleet in the ranking shows its mascot in its colour.
- As a member who has not built a hero, my GitHub photo shows wherever I appear. When I build one
  in the arcade, my hero replaces it everywhere.
- As a member on the Engineering board, a reviewer from outside the workspace still shows their
  GitHub photo.

## Scope

In, each moving to `PersonChip` or `FleetChip`:

- **Dashboards:** the People table's Name and Fleet columns (Home, `/app/fleet`, `/app/workspace`,
  `src/dashboard/board/Board.tsx`); Home's heading (`Dashboard.tsx`); the you-block's fleet
  (`YouBlock.tsx`, whose big hero stays); the Workspace fleet ranking; the `/app/fleet` picker and
  page header.
- **Engineering:** the three top-five lists and the per-repository page (after PRD 645).
- **Ask:** the "shared by" lines (`ForMe.tsx`), the "asked by · answered by" lines
  (`WorkspaceHistory.tsx`), "Already answered by" (`AskQuestion.tsx`, `question.ts`), and "Shared
  with" (`ShareButton.tsx`, outside its `<select>`).
- **Dossier:** "opened by" (`DossierPage.tsx`), the questions pane's asked/answered/waiting lines
  (`QuestionsPane.tsx`), `QuickAnswer.tsx`, and the outbox replies' `@login` lines
  (`outbox-answers.tsx`, `OutboxSend.tsx`).
- **Fixes:** "asked by @author" (`FixList.tsx`) and the timeline's "by @login" (`TimelinePane.tsx`).
- **Navigation:** the bell's "shared by" line (`Bell.tsx`) and the user menu's avatar button
  (`UserMenu.tsx`).
- The migration, `loadPeople`, `faceOf`, the two chips and their CSS (`src/people/people.css`),
  the demo and fake stores gaining heroes and mascots, and the tests below.

Out: the `<select>` options; the version picker's option label (`VersionPicker.tsx`, also an
`<option>`); `CategoryChip`'s "set by you / a teammate" (it names no person); the arcade's canvas
sprites; any change to how names are chosen; per-person pages; and the unused `Rankings.tsx` and
`Week.tsx`.

## Test seams

Following `omni kb show testing`: vitest beside the code, and no test calls GitHub or Supabase.

- `src/people/face.test.ts`: a valid hero gives a hero SVG tinted in the fleet colour, and a
  non-hex colour draws it untinted. An invalid or missing hero with a roster `avatar_url` gives that
  URL. With no avatar but a login it gives the `github.com/<login>.png` URL, encoded. With neither
  it gives the name's initial. Login matching ignores case.
- `src/people/load.test.ts` (fake client): the directory resolves by id and by login, carries each
  member's fleet with its mascot, and a failing roster read yields a directory where every lookup
  falls back to the login's GitHub URL or the initial, never an error.
- `src/people/chips.test.ts` (render to static markup): `PersonChip` renders each face kind with
  `alt=""` or `aria-hidden`, followed by the name. `FleetChip` renders the mascot SVG and the label
  in `--fleet` colour, the caped-hero fallback for a fleet with no mascot, and **SOLO** for `'solo'`.
  The row's `textContent` equals today's (name only), so the existing row-text tests still pass.
- Existing tests updated where the markup moves: `board/render.test.ts`'s regex
  `<th scope="row" class="board-name">ADA` loosens to "the name cell contains ADA".
  `home/render.test.ts` and `dashboard/render.test.ts` expect **Your fleet** and a fleet chip in
  place of **Your team**. `fleet/render.test.ts`, `engineering/render.test.ts`, the ask and dossier
  render tests, `fixes/list.test.ts` and `nav/UserMenu.test.ts` each assert that a chip is present
  beside the unchanged text.
- `board/load.test.ts` and `fleet/load.test.ts`: `mascot` is carried through `FleetTag`,
  `FleetHead` and `FleetRank`.
- The SQL: `supabase/checks/dashboards.sql` gains a check that `workspace_roster` returns each
  member's `hero` (null with no player row) and still returns nothing to a non-member. A vitest
  reading the new migration, in the manner of `ask/attachments-sql.test.ts`, asserts the `is_member`
  guard and the `authenticated`-only grant survive the replacement.

## Risks

- **The database:** merging applies one migration to production through the `supabase` workflow.
  It replaces `workspace_roster` with a version that has one more column, so the running app, which
  ignores the column, keeps working between the migration and the deploy. Rollback: a follow-up
  migration recreates the function without `hero`, or revert the PR (the extra column is harmless).
- **Broken faces:** a GitHub photo URL for a login that no longer exists shows the browser's broken
  image. The chip draws a neutral circle behind every `<img>` with no script, so a missing photo still
  shows as a circle.
- **Wide diff across screens:** the plan slices by screen group, so each sub-PR stays reviewable
  and a regression is found by screen.
- Rolling the whole feature back is reverting the feature PR; the migration may stay.

## Acceptance criteria

- On Home, the People heading reads **Your fleet** and then the viewer's fleet mascot and label. A
  solo viewer reads **Your fleet · SOLO**.
- In every People table row, the Name cell starts with the member's hero when they have one, else
  their GitHub photo, else their initial. The Fleet cell shows the fleet's mascot and label in its
  colour, or **SOLO**.
- The Workspace fleet ranking, the `/app/fleet` picker and the `/app/fleet` header show each fleet's
  mascot.
- The Engineering top-five rows use `PersonChip`. A login outside the workspace shows its GitHub
  photo.
- Every "asked by", "answered by", "shared by", "opened by", "shared with" and "by @login" line in
  the ask, dossier, bell, outbox and fix screens shows the person's face before their name.
- The user menu button shows the viewer's hero when they have one.
- With the roster read failing, every one of those screens still renders, with GitHub photos or
  initials.
- A row's text, as a screen reader reads it, is the same as today's.
- `pnpm test` is green.
