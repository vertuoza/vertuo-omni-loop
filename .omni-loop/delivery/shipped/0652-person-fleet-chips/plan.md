# Plan: Person and fleet chips everywhere

PRD #652, spec in `spec.md` beside this plan. It is built on `feat/person-fleet-chips`, which
merges into `main` with `Closes #652`. Each slice is a sub-PR from `feat/person-fleet-chips--<slice>`
into the feature branch, with `Part of #652`. The PRD is blocked by PRD 645: s3 starts only once
645's engineering faces are on `main` and merged into the feature branch.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The tracer: `workspace_roster` returns `hero` (migration and SQL check); `src/people/` holds `faceOf`, `loadPeople`, `PersonChip`, `FleetChip` and their CSS; `FleetTag` carries `mascot`; the People table on Home, Fleet and Workspace draws both chips, and Home's heading reads **Your fleet** followed by the viewer's fleet chip (or **· SOLO**) | `supabase/migrations/20261012090000_roster_hero.sql` `supabase/checks/dashboards.sql` `apps/galaxy/src/people/` `apps/galaxy/src/dashboard/board/` `apps/galaxy/src/dashboard/Dashboard.tsx` `apps/galaxy/src/dashboard/home/` `apps/galaxy/src/dashboard/render.test.ts` | — | 1 |
| s2 | Fleets show their mascot beyond the table: the Workspace fleet ranking, the `/app/fleet` picker and header, and the you-block's fleet line, with `color` and `mascot` carried through `FleetRank`, `FleetHead` and the you-block's fleet | `apps/galaxy/src/dashboard/board/Board.tsx` `apps/galaxy/src/dashboard/board/render.test.ts` `apps/galaxy/src/dashboard/fleet/` `apps/galaxy/src/dashboard/rankings/rank.ts` `apps/galaxy/src/dashboard/rankings/rankings.test.ts` `apps/galaxy/src/dashboard/you.ts` `apps/galaxy/src/dashboard/YouBlock.tsx` `apps/galaxy/src/dashboard/load.ts` `apps/galaxy/src/dashboard/load.test.ts` `apps/galaxy/src/dashboard/render.test.ts` | s1 | 2 |
| s3 | The Engineering top-five rows and the per-repository page use `PersonChip`, by login through the people directory; PRD 645's engineering `faceOf` is removed in favour of `src/people/face.ts`; a login outside the workspace keeps its GitHub photo | `apps/galaxy/src/engineering/` | s1 | 2 |
| s4 | The ask screens show faces: "shared by" (For me), "asked by · answered by" (history rows), "Already answered by" (question page) and "Shared with" (outside the `<select>`), each resolved by account id through the people directory | `apps/galaxy/src/ask/` | s1 | 2 |
| s5 | The dossier screens show faces: "opened by", the questions pane's asked, answered and waiting lines, the quick answer, and the outbox replies' and send result's `@login` lines (by login) | `apps/galaxy/src/dossier/` | s1 | 2 |
| s6 | The fix screens show faces: "asked by @author" on `/bugs` and `/visual`, and every "by @login" moment on a fix's timeline, by login | `apps/galaxy/src/fixes/` | s1 | 2 |
| s7 | The top bar shows faces: the user menu's button is the viewer's hero when they have one (the viewer read gains their player row, and falls back to today's avatar or initial when it fails), and the bell's "shared by" line carries the sharer's chip | `apps/galaxy/src/nav/` `apps/galaxy/src/waiting/` | s1 | 2 |

**Shared ground.** `apps/galaxy/src/dashboard/board/Board.tsx`, `apps/galaxy/src/dashboard/board/render.test.ts` and
`apps/galaxy/src/dashboard/render.test.ts` are in both s1 (the People table and Home's heading) and s2 (the
fleet ranking and the you-block). s2 is blocked by s1 and runs in wave 2, so they never share a
wave. Every wave-2 slice imports `apps/galaxy/src/people/` without changing it: a slice that needs a change
there raises it as an outbox item rather than widening its territory.

## Per slice: done when

**s1**
- The new migration drops and recreates `public.workspace_roster(uuid)` with a sixth column
  `hero jsonb`, keeping `security definer`, the `is_member` guard, and the `authenticated`-only
  grant. `supabase/checks/dashboards.sql` checks that `hero` is returned (null with no player row)
  and that a non-member gets nothing. A vitest over the migration asserts the guard and the grant.
- `faceOf` returns a hero SVG tinted in the fleet colour for a valid hero (untinted for a non-hex
  colour); else the roster `avatar_url`; else `https://github.com/<login>.png?size=48`, encoded;
  else the name's initial. Login matching ignores case.
- `loadPeople` resolves by id and by login, carries each member's `FleetTag` with `mascot`, and
  a failing roster read yields a directory whose lookups fall back to the GitHub photo or the
  initial, never an error.
- `PersonChip` renders each face kind decoratively (`alt=""` or `aria-hidden`) and then the name.
  `FleetChip` renders the mascot, or the caped-hero fallback, and then the label in the fleet
  colour; for `'solo'` it renders **SOLO**.
- On Home, Fleet and Workspace, each People row's Name cell starts with the member's face and its
  Fleet cell is a `FleetChip`. Each row's text content is unchanged.
- Home's People heading reads **Your fleet** followed by the viewer's fleet chip, or
  **Your fleet · SOLO**. The tests that expected **Your team** now expect this.
- `pnpm test` is green.

**s2**
- `FleetRank` and `FleetHead` carry `color` and `mascot`. Their load tests prove it.
- The Workspace fleet ranking rows, the `/app/fleet` picker links and the `/app/fleet` header
  each show a `FleetChip`, and keep the "◀ (your fleet)" marker and text.
- The you-block's fleet line is a `FleetChip` followed by "fleet". Its big hero is unchanged.
- `pnpm test` is green.

**s3–s6** (each for its own screens)
- Every person the spec's Scope lists for that screen group renders through `PersonChip`,
  resolved through `loadPeople` by account id (ask, dossier) or by login (engineering, outbox,
  fixes).
- A login or id that matches no member still renders, with its GitHub photo or the initial.
- With the roster read failing, the screen renders exactly as before, but with GitHub photos or
  initials.
- Existing text assertions still pass, and each render test asserts a chip beside the text.
- `<select>` options stay text only.
- s3: `src/engineering/` no longer defines its own face function.
- `pnpm test` is green.

**s7**
- The user menu button shows the viewer's hero SVG when their player row in the current workspace
  holds a valid hero. Otherwise it shows today's GitHub avatar or initial, including when the player
  read fails. `UserMenu.test.ts`, `AppBar.test.ts` and `viewer.test.ts` cover the three cases.
- The bell's "shared by" line shows the sharer's `PersonChip` (inline size).
- `pnpm test` is green.
