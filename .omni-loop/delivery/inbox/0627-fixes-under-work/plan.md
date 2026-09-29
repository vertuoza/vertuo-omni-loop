# Plan: Bug fixes and visual updates under Work

PRD #627, spec in `spec.md` beside this plan. Built on the feature branch `feat/fixes-under-work`
into `main` (`Closes #627`), through sub-PRs from `feat/fixes-under-work--<slice>` into the feature
branch (`Part of #627`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A fix is a dossier with a kind: the migration (`dossiers.kind`, the unique key with kind, the `variations` and `bug-record` version kinds, the kind/version pairing in `dossier_push`), its checks, the push and find API taking a kind (missing = `prd`), and the kit's `omni dossier push <n> --kind visual` (or `bug`) and `omni dossier link <n> --kind …` reading `visual/` and `bugs/` folders | `supabase/migrations/20261010090000_` `supabase/checks/dossiers.sql` `apps/galaxy/src/dossier/api` `apps/galaxy/src/dossier/store` `apps/galaxy/app/api/dossiers/` `kit/bin/commands/dossier` `kit/lib/dossier/` `kit/lib/ask/client` `kit/dist/omni.mjs` | — | 1 |
| s2 | Work → Bug Fixes and Work → Visual Updates: the sidebar entries in order, the `/bugs` and `/visual` lists (row, filters Mine/All, repo, search), the fix page at `/bugs/<id>` and `/visual/<id>` with tabs by kind (Before/after, Variations with its round picker, Bug record), the header badge and issue link, and the redirects between `/prd/<id>` and a fix's route; `/prd` lists only `prd` dossiers | `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/fixes/` `apps/galaxy/src/dossier/page/` `apps/galaxy/app/prd/` `apps/galaxy/app/bugs/` `apps/galaxy/app/visual/` | s1 | 2 |
| s3 | The GitHub fallback reads `<delivery>/visual/` and `<delivery>/bugs/` on each repository's default branch into `visual` and `bug` dossiers, so #548, #561 and #571 get pages | `game/dossiers/` | s1 | 2 |
| s4 | The visual fix keeps its variations and its pick: `/omni:visual-fix` commits `variations-r<k>.html` per round and the `data-omni-pick` line, `omni visual <n>` checks every round page, both fix skills push their dossier with `--kind` and print its link, and the help entries say so | `kit/lib/visual/` `kit/lib/bug/` `kit/bin/commands/visual` `kit/plugin/skills/visual-fix/` `kit/plugin/skills/bug-fix/` `kit/lib/help/` `kit/dist/omni.mjs` | s1 | 2 |
| s5 | Each fix shows its state and its Timeline: the live GitHub reader for a fix (issue, `fix/<n>-…` PR, approving reviews, merge, first release after it), the Asked / In review / Merged pill and the risk and regression badges on list rows, and the Timeline tab with Asked, Picked (from the pick line), Approved, Merged and Released, each *not yet*, *unknown* or *not recorded* when so | `apps/galaxy/src/fixes/` `apps/galaxy/src/dossier/github/` `apps/galaxy/src/dossier/page/` `apps/galaxy/app/bugs/` `apps/galaxy/app/visual/` | s2 | 3 |

**Shared ground.** `kit/dist/omni.mjs` (the committed bundle) is rebuilt by s1 and s4; they sit in
waves 1 and 2, since s4's skills call s1's `--kind`. `apps/galaxy/src/fixes/`,
`apps/galaxy/src/dossier/page/`, `apps/galaxy/app/bugs/` and `apps/galaxy/app/visual/` are declared
by s2 (the lists and the page) and s5 (the state and the Timeline added to them); s5 is blocked by
s2 and sits in wave 3. The sidebar's tests (`apps/galaxy/src/nav/sidebar.test.ts`,
`Sidebar.render.test.ts`) are only touched by s2. s2, s3 and s4 share no prefix and run side by
side in wave 2. The migration prefix `20261010090000_` must still sort after every migration on
`main` at merge time (PRD 587 and PRD 612 each add `20261008090000_` on their branches).

## Per slice: done when

**s1**
- `supabase/checks/dossiers.sql` passes: an existing and a new dossier read `kind = 'prd'`; a
  `visual` and a `prd` dossier share a number in one repo; a `bug` dossier refuses a `spec` version,
  a `prd` dossier refuses a `variations` one, a `visual` dossier takes `before-after` and
  `variations`; row-level security reads are unchanged for members and outsiders.
- The migration adds the new unique key before dropping the old one, in one transaction.
- The push API with no kind behaves as today (its existing tests pass unchanged); with
  `kind: 'visual'` it creates or finds the numbered `visual` dossier; an unknown kind is refused.
- `kit/lib/dossier/folder` reads a `visual/<nnnn>-*` folder into one `before-after` and ordered
  `variations` rounds (r1, r2, r10 in numeric order), and a `bugs/<nnnn>-*` folder into one
  `bug-record`; the title is the issue title without `Visual: ` or `Bug: `, else the folder topic.
- `omni dossier push <n>` with no `--kind` sends the same body as today (a test pins it);
  `--kind visual` sends the kind; `omni dossier link <n> --kind bug` asks for the bug dossier.
- `kit/dist/omni.mjs` is a fresh build (`kit/test/dist.test.mjs` green).

**s2**
- The Work group reads PRDs, Bug Fixes, Visual Updates, Questions, Knowledge (sidebar and render
  tests updated).
- `/visual` lists only `visual` dossiers and `/bugs` only `bug` ones, with Mine/All, repo and
  search filters; `/prd` lists only `prd` dossiers and its other filters are unchanged.
- The view model gives a `visual` dossier the tabs Before/after, Variations, Questions, with a round
  picker labelled *Round k*; a `bug` dossier Bug record (markdown) and Questions; a `prd` dossier
  exactly today's tabs.
- `/prd/<id>` of a fix redirects to `/visual/<id>` or `/bugs/<id>`, and a fix route given a PRD's id
  redirects to `/prd/<id>`.

**s3**
- `game/dossiers/folders` reads `visual/` and `bugs/` tree fixtures into `visual` and `bug` dossiers
  with the right artifacts, titles and numbers; a folder that does not read as `<nnnn>-<slug>` is
  skipped with its reason, as for PRD folders.
- The sync test run on a fixture holding `0548-…`, `0561-…` and `0571-…` creates two `visual` and
  one `bug` dossier, and a second run adds no version.
- `inbox/` and `shipped/` are read exactly as before.

**s4**
- `omni visual <n>` passes a folder with `before-after.html` alone, and with `variations-r1.html`
  and `-r2.html`; it fails, one line each, a round page over `limits.beforeAfterMaxBytes`, a round
  page holding a raster `data:image/`, a round name that is not `variations-r<k>.html`, and any
  other file.
- `/omni:visual-fix` writes each round shown to the person as a `variations-r<k>.html` in the fix's
  folder, writes the `data-omni-pick` line (letter, login, date) in `before-after.html` and in the
  PR's **The pick**, and after pushing runs `/omni:dossier-push <n> --kind visual`, carrying on
  whatever it prints; its hand-off prints the page's link.
- `/omni:bug-fix` does the same with `--kind bug`. Neither skill says "never open a dossier" any
  more; both still open no PRD, inbox folder, plan or outbox item.
- The help entries of both skills and of `dossier push` name `--kind`; the help tests pass.

**s5**
- From a GitHub fixture, the fix reader gives: the issue's author and time; the open or merged
  `fix/<n>-…` PR; each `APPROVED` review with login and time; `merged_by` and `merged_at`; the
  first release published after the merge. A GitHub failure gives *unknown*, not an error.
- The pick-line parser reads `<p data-omni-pick>Picked C by @login on 2026-09-29</p>` and ignores
  any other shape; a page without it gives *not recorded*.
- List rows show *Asked*, *In review* or *Merged* by the spec's table, `—` when GitHub does not
  answer, and bug rows show the risk label and a *regression* badge.
- The Timeline tab comes first on a fix's page and lists the moments in the spec's order; a `bug`
  dossier has no Picked line; a moment not reached reads *not yet*.
- Reads go through the same 60-second cache as the PRD outbox counts.
