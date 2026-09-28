# Plan: Lighter app pages

PRD #498. The spec, `spec.md`, sits beside this plan. The work goes on the feature branch
`feat/lighter-app-pages`, which merges into `main` (`Closes #498`). Each slice is a sub-PR from
`feat/lighter-app-pages--<slice>` into the feature branch (`Part of #498`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The top bar stands out (T1), and every app page but the PRD page is full width, with prose kept at 900 px and form fields capped at 900 px | `apps/galaxy/src/nav/app-bar.css` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/dashboard/dashboard.css` `apps/galaxy/src/knowledge/knowledge.css` `apps/galaxy/src/docs/docs.css` `apps/galaxy/src/page-width.test.ts` | — | 1 |
| s2 | The PRD header runs edge to edge, every line in it spans the full width, and the PRD list is full width | `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/page/PinnedHead.tsx` `apps/galaxy/src/dossier/page/head-style.test.ts` | — | 1 |
| s3 | The Questions tab folds answered and moved rounds, never folds an open round, and counts questions: `7/10 · 3 to answer` on the tab and in a strip with a meter | `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/page/QuestionsPane.tsx` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/page.test.ts` | s2 | 2 |

**Shared ground.**
- `apps/galaxy/src/dossier/page/dossier.css` is declared by s2 (the header's frame, `.dossier-history`)
  and s3 (the rounds). s3 is blocked by s2 and runs in wave 2, so the two changes never merge side by
  side.
- The page gutter crosses s1 and s2 without shared ground:
  - s1 declares it once, in `ask.css`, as `--ask-gutter`: 16 px, and 24 px from 900 px wide.
  - `.ask-main` uses it for its side padding.
  - s2 reads `var(--ask-gutter, 16px)` to pull the header out to the edges and to pad its rows.
  - Neither slice edits the other's file.

## Per slice: done when

**s1**
- `.app-bar` has `background: var(--ask-surface)` and `border-bottom: 2px solid var(--ask-line-strong)`,
  and still wraps below 900 px as today.
- None of `.dash`, `.ask-page`, `.ask-col`, `.km-main`, `.km` or the docs layout declares a
  `max-width`, and none is centred.
- `.docs-article` is `max-width: 900px`.
- Inputs, selects and textareas in `.ask-main` are at most 900 px wide.
- `.ask-main` pads its sides with `--ask-gutter`, which is 16 px, and 24 px from 900 px wide.
- `page-width.test.ts` reads the stylesheets as text and proves each line above.
- A browser pass at 1920 px in Omni, Light and Dark shows the bar standing apart from the page, and
  Home, Questions, Shared with me, History, Fleets, Knowledge and Docs using the full width.

**s2**
- `.dossier-head` has no `border-radius`, no side or top border and no margin. It keeps
  `--ask-surface` and a 1.5 px `--ask-line-strong` bottom border.
- It reaches the top bar, the sidebar and the window's right edge. It stays pinned at ≥ 900×700,
  as today.
- The rule above `.dossier-tabs` spans the header's full width, and the rows are padded by the
  gutter.
- `.dossier-history` has no `max-width`.
- `head-style.test.ts` proves the stylesheet side of this.
- A browser pass at 1920 px and 390 px shows it, with no sideways scroll.

**s3**
- `questionsView` returns `asked`, `answered` and `open` counted in questions. A moved round counts
  only in `asked`.
- The tab reads `<answered>/<asked>` plus a `N to answer` badge when anything is open, and
  `<asked>/<asked> answered` otherwise.
- A strip above the list repeats the counts with a meter.
- **Answered and moved rounds:**
  - Each is a closed `<details>` whose `<summary>` is the round's line: status mark, rule ·
    category, the headers, the count, the time asked, and the outcome.
  - Unfolded, an answered question reads `chip · question → chosen option(s)`, with no filled
    option box.
- **An open round:**
  - It is not a `<details>`. It sits on `--ask-sunk` with a 4 px `--ask-yellow` left edge.
  - It shows every option as an outlined button.
  - A quick round keeps `QuickAnswer` or "Waiting for <owner>".
- Every round element keeps its round id and its `scroll-margin-top`.
- The class names the tests read are kept.
- `view.test.ts` covers the spec's case: 3 + 1 answered, 2 open and 1 moved give 4/7 · 2 to answer.
- `render.test.ts` covers the three states and the quick round.
- A browser pass shows an answered round folding with Tab, Enter and Space, and the page working
  with JavaScript off.
