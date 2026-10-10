---
screen: dashboard
status: draft
mock: null
implements: [apps/galaxy/app/app/page.tsx, apps/galaxy/src/dashboard/]
routes: [/app]
supersedes: null
---

## Purpose

The app's home, your dashboard: your hero, fleet, season points and places, Waiting for you, then
the board for the period chosen, whose People table is your team (`apps/galaxy/app/app/page.tsx`,
`apps/galaxy/src/dashboard/Dashboard.tsx`). It sits inside the app shell, the sidebar and the top
bar (`apps/galaxy/app/app/layout.tsx`).

## Regions

- **You** (`dashboard/YouBlock.tsx`): your hero, your name, your points in the season
  (`<n> pts · <season> season`), your places, your fleet's chip; with no hero yet, "Play in the
  arcade to get your hero and your score".
- **Waiting for you** (`dashboard/counts/WaitingTile.tsx`): what waits on you.
- **The board** (`dashboard/board/Board.tsx`) with scope *you*: the period switch (7 days, 30 days,
  Season; `?period=`), the PRDs tile counting your PRDs at each stage, the merges and PRDs charts
  with their totals, the People table headed **Your fleet** with your fleet's chip (or **Your fleet
  · SOLO**, with a line to the Fleet page), and Repositories involved.
- Each part streams in its own block once the workspace is known (`dashboard/stream/`).

## States

- **Demo:** the demo world in development (or `OMNI_LOOP_DEMO=1`).
- **No database:** "The dashboard is not open here" (`dashboard/DashboardScreen.tsx`).
- **Signed out:** only the sign-in card, which comes back through `/app/callback`.
- **Signed in, in no workspace:** "Your account is not in a workspace", with Switch account.
- **A part whose read failed:** "Couldn’t load this. Reload in a moment.", and the rest of the page
  renders (`dashboard/Notes.tsx`).
- **GitHub not linked:** "Link your GitHub in the arcade" (`dashboard/Notes.tsx`).
- **No fleet of your own:** "No fleet of your own. See a fleet’s board on Fleet".

## Words

Waiting for you · Your fleet · Repositories involved · 7 days · 30 days · Season · PRDs · total ·
"Couldn’t load this. Reload in a moment." · "Link your GitHub in the arcade".

## Refusals

- A failed read empties only its own part, never the page (`dashboard/DashboardScreen.tsx`).
- The rankings, the Outbox settled tile, the week and the season's counts left the dashboard: the
  fleet ranking is on Workspace (`dashboard/Dashboard.tsx`, PRD 572).

## Open questions

- Is Waiting for you the page's primary region, or the board? The order puts You first.
- The dashboard is shot in three themes, Omni, Light and Dark (`apps/galaxy/scripts/shots.ts`):
  which is the reference a review compares with?
- The loading state of each streamed part is not drawn in the copy: what does a part say while it
  is being read?

## Source

- apps/galaxy/app/app/page.tsx@a383f31
- apps/galaxy/app/app/layout.tsx@240c4a5
- apps/galaxy/src/dashboard/Dashboard.tsx@42646ea
- apps/galaxy/src/dashboard/DashboardScreen.tsx@353abb5
- apps/galaxy/src/dashboard/YouBlock.tsx@1fa360a
- apps/galaxy/src/dashboard/counts/WaitingTile.tsx@b30706c
- apps/galaxy/src/dashboard/board/Board.tsx@3c6e58a
- apps/galaxy/src/dashboard/Notes.tsx@2022a57
- apps/galaxy/scripts/shots.ts@b48bee0
- /omni:invade 2026-10-10 (written by hand from its screen-library step, PRD 1407 s9)
