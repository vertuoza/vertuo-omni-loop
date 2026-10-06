# Plan: Rank and sort the People table

PRD #1017, built from `spec.md` beside this plan. The feature branch `feat/people-ranking` merges
into `main` through the feature PR, whose body opens with `Closes #1017`; each slice is a sub-PR
from `feat/people-ranking--<slice>` into the feature branch, whose body opens with `Part of #1017`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every board's People table lists its people by points, then PRs, then name, and its first column is `RANK`, each row's place by points with shared ranks | `apps/galaxy/src/dashboard/` `apps/galaxy/src/profile/` | — | 1 |
| s2 | Every header of the People table is a link that sorts it by its column, `?sort=<key>` and `&dir=asc` or `&dir=desc`, keeping the rest of the query, with ▼ or ▲ and `aria-sort` on the sorted header | `apps/galaxy/src/dashboard/` `apps/galaxy/src/profile/` | s1 | 2 |

**Shared ground.** Both slices declare `apps/galaxy/src/dashboard/` and `apps/galaxy/src/profile/`:
both change `apps/galaxy/src/dashboard/board/Board.tsx`, `board.css` and `render.test.ts`, and the
render tests of every page that draws the board (`dashboard/render.test.ts`,
`dashboard/fleet/render.test.ts`, `dashboard/home/render.test.ts`, `dashboard/stream/render.test.ts`,
`profile/page.test.ts`) may read the People table's order or headers. s2 is blocked by s1, so they
sit in waves 1 and 2 and never merge side by side.

## Per slice: done when

**s1 — points order and the rank**
- `peopleRows` (`tally.ts`) orders rows by points, highest first, then PRs merged, highest first,
  then name A to Z, case-insensitive; a dash or `?` in points sorts below every number (spec
  criterion 1). `tally.test.ts`'s `'sorts by PRs merged, then points, then name'` is replaced by a
  test of this order.
- Each row carries `rank`: standard competition ranking by points among the table's rows (125, 50,
  50, 0, 0 rank 1, 2, 2, 4, 4); a row whose points are a dash or `?` has no rank, tested in
  `tally.test.ts` (criterion 2).
- The People table draws `RANK` as its first column, right-aligned, `–` for a row with no rank,
  tested in `render.test.ts` (criterion 2).
- Every render test of a page drawing the board passes with the new order and column.
- `pnpm test` is green.

**s2 — sortable headers**
- A new pure `apps/galaxy/src/dashboard/board/sort.ts`, tested in `sort.test.ts`: reads `sort` and
  `dir` from the query (unknown values give `points`, natural direction, criterion 8); orders rows
  by each of `rank`, `name`, `fleet`, `points`, `prs`, `prds` (shipped, then building, then open)
  and `questions`, in both directions, a dash or `?` last in both, ties falling back to the default
  order (criteria 4, 5); builds each header's link through `hrefWith`, keeping `period` and
  `fleet`, ending in `#board-people`, the current sort's header linking to the other direction
  (criteria 4, 6).
- `Board` reads the sort from its `query`, orders the rows before drawing, and draws every People
  header as a link; the sorted header alone shows ▼ or ▲ (hidden from a screen reader) and carries
  `aria-sort`, tested in `render.test.ts` (criteria 7, 9).
- The rank of every row is the same in every sort, tested in `render.test.ts` (criterion 3).
- The period switch's links keep `sort` and `dir`, tested in `render.test.ts` (criterion 6).
- `pnpm test` is green.
