# Plan: the People table says how many people it lists

PRD #1262, the spec beside this plan (`spec.md`). One feature branch, `feat/people-count`, into `main`
(`Closes #1262`); each slice is a sub-PR from `feat/people-count--<slice>` into the feature branch
(`Part of #1262`). This PRD is a test of `/omni:validate-e2e`: its feature PR is closed without merging.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Under the `People` heading a line reads `N people` (`1 person` for one), N being the number of rows the table lists, and none is shown when the people cannot be read | `apps/galaxy/src/dashboard/` | — | 1 |
| s2 | Sorting the table by a header leaves the number the line shows unchanged, proven at the page level | `apps/galaxy/src/dashboard/board/render.test.ts` | s1 | 2 |

**Shared ground.** `apps/galaxy/src/dashboard/board/render.test.ts` sits under s1's territory and is
s2's own, and `People` is also drawn on Home and on the Fleet screen, whose render tests (under
`apps/galaxy/src/dashboard/`) s1 may have to update. s2 waits for s1 (wave 2), so the two never merge
side by side. No generated path is listed.

## Per slice: done when

**s1**

- On the workspace page, a line `N people` is drawn under the `People` heading, N being the number of
  rows of the table (criterion 1).
- With exactly one person the line reads `1 person` (criterion 2).
- When the people cannot be read, the table is replaced by the "could not load" message and no count
  line is drawn (criterion 4).
- The existing render tests of the dashboard, Home and the Fleet screen still pass; one that checked
  exact People markup is updated in this slice.

**s2**

- A render test sorts the People table by two different headers and shows the same count line each
  time (criterion 3).
- No source file changes: the count is already independent of the sort, and this slice proves it.
