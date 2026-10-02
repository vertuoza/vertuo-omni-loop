# Plan: Grounded dashboards

PRD #962, whose spec is `spec.md` beside this plan. The work lands on the feature branch
`feat/grounded-dashboards`, merged into `main` by the feature PR (`Closes #962`). Each slice is a
sub-PR from `feat/grounded-dashboards--<slice>` into the feature branch (`Part of #962`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Home, Fleet and Workspace draw every panel in the shared `.board-card`, with tile figures on one baseline and tables pinned on the card's surface on a phone | `apps/galaxy/src/dashboard/board/board.css` `apps/galaxy/src/dashboard/board/Board.tsx` `apps/galaxy/src/dashboard/board/render.test.ts` `apps/galaxy/src/ask/outlines.test.ts` | — | 1 |
| s2 | The Engineering board and each repository's page draw the Omni Loop, Loop health, merged-per-day and top-5 panels in `.board-card`, with the cards in a row ending on one line | `apps/galaxy/src/engineering/EngineeringBoard.tsx` `apps/galaxy/src/engineering/engineering.css` `apps/galaxy/src/engineering/render.test.ts` | s1 | 2 |

Shared ground: none. The two territories don't meet. s2 waits for s1 because it uses the
`.board-card` rule s1 adds to `board.css`. `src/ask/outlines.test.ts` lists the borders that only
divide content: s1 adds the card header's `--ask-line` hairline there, and s2 adds no border of its
own.

## Per slice: done when

**s1**
- `.board-card` in `board.css` is the only rule that gives a panel a border (`--ask-line-strong`),
  a 12px radius, the `--ask-surface` background and 18px padding (12px below 720px). Under
  `forced-colors: active` its border is `CanvasText`.
- In `Board.tsx`, every `board-chart`, `board-people`, `board-repos` and `board-fleets` section
  also carries `board-card`, and `render.test.ts` asserts it on a board rendered with fleets.
- `.board-tile` places its label at the top and its figure at the bottom, so in a row the figures
  share one baseline when one label wraps.
- A card with a total keeps its header row with a `--ask-line` hairline under it, which
  `outlines.test.ts` lists as a divider. The suite stays green.
- Below 720px, a table's pinned first column and its right-edge shadow use `--ask-surface`
  inside a card.
- `pnpm test` is green.

**s2**
- In `EngineeringBoard.tsx`, the Omni Loop, Loop health, merged-per-day and each top-5 section
  carry `board-card`, and `render.test.ts` asserts it on the Engineering board and on a repository's
  page. The empty and could-not-load states keep their markup.
- `.board-charts` and `.eng-people` let their cards stretch to the row's height, so at 1400px the
  three panels end on one line, and so do the three top-5 cards.
- `engineering.css` sets no border, radius or surface on any panel.
- At 393px the page has no horizontal scroll, and the cards stack one per row.
- `pnpm test` is green.
