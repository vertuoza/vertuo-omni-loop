# Plan: The PRD page shows its stage and what to do next

PRD #426, spec beside this plan (`spec.md`). The feature branch `feat/prd-page-stage` merges into
`main` with `Closes #426`; each slice is a sub-PR from `feat/prd-page-stage--<slice>` into the
feature branch, with `Part of #426`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The header shows the stage and its next action: "PRD #n" links to the issue, the track lights the stage read from GitHub (issue, phase-0, feature and retro PRs, merged sub-PRs), one button, the links line, and "Stage unknown" when GitHub does not answer | `apps/galaxy/src/dossier/github/` `apps/galaxy/src/dossier/page/stage` `apps/galaxy/src/dossier/page/StageHeader` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/page/source.ts` `apps/galaxy/src/dossier/page/source.test.ts` `apps/galaxy/app/prd/[id]/page.tsx` `apps/galaxy/src/dossier/page/page.test.ts` `apps/galaxy/src/signup/github-app.ts` `apps/galaxy/src/signup/github-app.test.ts` | — | 1 |
| s2 | The Outbox tab lists the open decisions then the settled ones, read from the feature branch or the shipped folder, and the outbox stage's button answers the outbox or reviews and merges | `apps/galaxy/src/dossier/github/` `apps/galaxy/src/dossier/page/stage` `apps/galaxy/src/dossier/page/OutboxPane` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/dossier.css` | s1 | 2 |
| s3 | The Retro tab renders retro.md, from the retro branch while its PR is open and from the default branch once merged | `apps/galaxy/src/dossier/github/retro` `apps/galaxy/src/dossier/github/summary` `apps/galaxy/src/dossier/page/RetroPane` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/dossier.css` | s2 | 3 |
| s4 | The page stays current and demo mode shows a sample: the 2-second signature covers the stage and the open outbox count, and demo mode shows an outbox-stage sample with no GitHub call | `apps/galaxy/src/dossier/page/live` `apps/galaxy/src/dossier/page/demo` | s2 | 3 |

**Shared ground.** `src/dossier/github/` (s1, s2; s3 names only its `retro` and `summary` files
inside it), `view.ts`, `view.test.ts`, `render.test.ts`, `DossierPage.tsx` and `dossier.css` are
declared by s1, s2 and s3, one per wave (1, 2, 3). `stage` files are s1's and s2's (waves 1 and 2).
s4's `live` and `demo` files are its own, so it shares wave 3 with s3. `github/summary` names the
file that holds the GitHub summary's type; s1 creates it, s2 and s3 add to it.

## Per slice: done when

**s1: the stage header**
- The reader finds the App's installation by `home_repo`, creates an installation token, reuses it
  until a minute before it expires, and never returns it to the page; tested against a stubbed
  `fetch`.
- It reads the repository's `.omni-loop` config for `branches.feature`, `branches.phase0`,
  `branches.retro` and `paths.delivery`, finds the PRD's folder and topic, reads issue `#n`, the most
  recent PR per head branch (open, merged; closed-unmerged as absent) and counts merged sub-PRs.
- Each read fails on its own; the App not installed (404) and GitHub unreachable give "unknown".
- The GitHub summary is cached 60 s per dossier: a second read within it makes no call.
- `stage.ts` gives each stage and next action of the spec's table (idea, PRD, inbox, outbox without
  outbox data yet: "Being built · m/t slices" or Review & merge when the feature PR is ready,
  shipped, retro, unknown), tried from the latest stage down.
- The header renders "PRD #n ↗" linking to the issue (a draft shows DRAFT), the six-stage track with
  the current stage lit and written in words, the one button (Build it copies `/omni:yolo <n>` and
  says "Copied"), and the links line with only what exists, each marked merged or open.
- The route reads GitHub only for a signed-in member on a numbered dossier; a signed-out visitor, a
  draft and demo mode make no call (page.test.ts with a stubbed reader).

**s2: the Outbox tab**
- The reader lists the open items and `settled.md` from `<delivery>/outbox/<folder>/` on the feature
  branch before shipping and from `<delivery>/shipped/<folder>/outbox/` after, parsed with
  `kit/lib/outbox/outbox.mjs`, and finds the feature PR's outbox comment by its marker.
- The tabs read Questions, Before/after, Spec, Plan, Outbox; Outbox's badge is "k open", else
  "k settled", else none, and an empty Outbox is dimmed with "No decision yet: the outbox fills while
  the PRD is built."
- The pane shows "Answer on the PR" when an item is open, the open items highest rank first (rank,
  question, options, recommendation), then the settled ones in file order (title, verdict, answer).
- In the outbox stage, an open item makes the button **Answer the outbox** (the outbox comment, else
  the feature PR).
- GitHub unreadable: the tab says "GitHub did not answer. The page tries again within a minute."

**s3: the Retro tab**
- The reader reads `retro.md` from the retro branch while its PR is open and from the default branch
  once merged; none when there is no retro PR.
- The sixth tab, Retro, has the badge "open PR" or "merged", "Open the retro PR" on top and
  `retro.md` rendered with `src/dossier/markdown.ts`; empty, it is dimmed with "The retro is written
  when the feature PR merges."
- GitHub unreadable: the tab says so, as the Outbox tab does.

**s4: staying current, and demo mode**
- The signature changes when the stage or the open outbox count changes, and not otherwise
  (live.test.ts).
- Demo mode's sample is a PRD in the outbox stage with open and settled items and no retro, and no
  GitHub call is made.
