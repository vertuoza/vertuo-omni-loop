---
prd: 962
title: Grounded dashboards
blocked-by: none
spec: file
proof: video
---

# Grounded dashboards

**Date:** 2026-10-02 · **PRD:** #962 · **Touches:** `apps/galaxy/src/dashboard/board/board.css`,
`apps/galaxy/src/dashboard/board/Board.tsx`, `apps/galaxy/src/engineering/engineering.css`,
`apps/galaxy/src/engineering/EngineeringBoard.tsx`, and their render tests. **Out of scope:** any
data, route, copy, chart or ordering change; the Waiting for you tile; the sidebar and the top bar.

## Problem

The four dashboards (Home `/app`, Fleet `/app/fleet`, Workspace `/app/workspace` and Engineering
`/app/engineering` with its per-repository pages) look like they float. Only the tiles have a frame.
Every panel under them is bare text on the page ground: the per-day charts, the People table, the
Repositories table and the fleet ranking (all drawn by `Board.tsx`), and on Engineering the Omni Loop
panel, Loop health, the merged-per-day chart and the three top-5 lists. `.board-chart`,
`.board-people`, `.board-repos` and `.board-fleets` set no border, surface or padding. So:

- headings and figures sit loose in the white space, with nothing that says which line belongs to
  which panel;
- panels side by side end at very different heights (Loop health runs far below the chart beside it),
  and nothing shows they form one row;
- inside the tiles, a label that wraps ("Median time to merge") pushes its figure lower than its
  neighbours', and each tile keeps empty space under its figure.

## Solution

One shared card for every panel, matching the tiles.

1. **`.board-card`** in `board.css`: a 1px `--ask-line-strong` border, a 12px radius, the
   `--ask-surface` background and 18px padding (12px below 720px). It is the only frame rule. Every
   panel `<section>` on the four boards adds the class: `board-chart` (both per-day charts, Omni Loop,
   Loop health, merged per day, and each top-5 list), `board-people`, `board-repos` and
   `board-fleets`. No board writes frame CSS of its own.
2. **Rows end on one line.** The cards in `.board-charts` and `.eng-people` stretch to their grid
   row's height. Their content stays at the top.
3. **Tile figures on one baseline.** `.board-tile` places its label at the top and its figure at the
   bottom (`align-content: space-between`). So in a row of tiles every figure sits on the same line,
   whatever the label's length.
4. **The card header.** A card with a total (the per-day charts) keeps its header row, with the
   heading and the total, and a hairline (`--ask-line`) under it. Every card's `h2` keeps today's
   17px size.
5. **Tables inside a card.** `.board-scroll` still scrolls inside the card, below 720px too. Its
   pinned first column and its right-edge shadow take the card's `--ask-surface` in place of the page
   ground, so the pinned names don't show a different background inside the card.
6. **Themes and forced colours.** Only tokens from `src/ask/theme-tokens.ts` are used, so Omni,
   Light and Dark all follow. Under `forced-colors: active` the card's border is `CanvasText`.

## Decisions

- **Direction:** a card on every panel, chosen over hairline-separated sections or a full layout
  rethink (the person picked it, 2026-10-02).
- **Scope:** all four boards. They share `Board.tsx` and `board.css`, so the card goes in once
  (the person picked it).
- **Voice objection (persona:F-E Developer):** "Cards everywhere is exactly the generated-dashboard
  look I distrust. If each board grows its own copy-pasted frame CSS instead of one shared rule, that's
  the slop I expect to break in production." Settled `accepted`: one `.board-card` rule is
  the only frame rule, and a render test checks that every panel carries it.
- **Proof:** a proof video once it ships (the person said yes).
- `Week.tsx` and `Rankings.tsx` are not drawn on any of the four boards today, so they are left
  as they are.

## User stories

- As a workspace member opening any board, I see each panel as one framed block, so I can tell at
  a glance which figures belong together.
- As a member reading the Engineering board, the Omni Loop, Loop health and merged-per-day panels
  end on the same line, so the row reads as one row.
- As a member scanning the tiles, every figure sits on the same line, so I compare them without
  hunting.
- As a member on a phone, the cards stack one per row and nothing scrolls sideways except a table
  inside its own card.

## Scope

In: the `.board-card` rule and the tile alignment in `board.css`; adding `board-card` to the panel
sections in `Board.tsx` and `EngineeringBoard.tsx`; the card-aware pinned column in
`board.css`'s phone rules; the stretch on `.eng-people`; render-test assertions.

Out: changing what any panel shows, its order, its copy or its chart drawing; `Week.tsx`,
`Rankings.tsx` and the Waiting for you tile (already framed); the app shell.

## Test seams

Following `omni kb show testing`: a UI workflow gets a component or page test for its states, plus a
manual browser pass for visual risk.

- `apps/galaxy/src/dashboard/board/render.test.ts`: rendering a board (with fleets, so it holds
  every panel) gives every panel section (`board-chart`, `board-people`, `board-repos` and
  `board-fleets`) the class `board-card`.
- `apps/galaxy/src/engineering/render.test.ts`: rendering the Engineering board gives the Omni
  Loop, Loop health, merged-per-day and each top-5 section the class `board-card`, and the same on a
  repository's page.
- The empty and unreadable states (`EmptyEngineering`, `CouldNotLoad`) keep their markup unchanged.
- Manual pass: the four boards in Light and Dark, at about 1400px and at 393px, on the preview
  deployment. That pass is what the proof video records.

## Risks

Following `omni kb show releasing`: a merge to `main` changes the galaxy app's stylesheet and two
components. It touches no migration, the kit or the plugin. The risk is visual only: a card
padding that crowds a panel at some width, or a pinned table column that shows the wrong background.
Rollback is reverting the feature PR's merge commit. Nothing stored changes.

## Acceptance criteria

- On each of the four boards, every panel below the tiles is drawn inside a card with the tiles'
  border, radius and surface, in Omni, Light and Dark.
- In any row of tiles, the figures sit on one baseline when one tile's label wraps to two lines.
- On Engineering at 1400px, the Omni Loop, Loop health and merged-per-day cards end on the same
  line; so do the three top-5 cards.
- At 393px, cards stack one per row with 12px padding, the tiles stay two by two, the page has no
  horizontal scroll, and the Repositories and People tables scroll inside their cards with the first
  column pinned on the card's surface.
- Under `forced-colors: active`, each card shows a visible border.
- The frame comes from the single `.board-card` rule: no other selector in `board.css` or
  `engineering.css` sets a panel's border, radius or surface.
