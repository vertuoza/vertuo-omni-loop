# Plan: Runners page, running by default, Needs you, repositories drawer

PRD #3232, its spec beside this plan (`spec.md`). The feature branch `feat/runners-redesign` merges into
`main` through the feature PR (Closes #3232); each slice is a sub-PR from `feat/runners-redesign--<slice>`
into the feature branch (Part of #3232).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Every job falls in one bucket; the page opens on Running, with tabs and counts kept as `?jobs=`, the Needs you band above them, and the empty tabs | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` | — | 1 | build |
| s2 | A Cannot run job offers its one fix beside Cancel: copy the runner command, Show fleet, Send to any runner, or copy `omni update` | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` | s1 | 2 | build |
| s3 | The runner card: one title with the summary line, can it take work first, the fleet on each busy slot, then accounts and tokens, then the gauges with their limit tick, the kit red only when it blocks a job | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` | s2 | 3 | build |
| s4 | A runner's repositories become `<n> repositories · <k> with jobs`, opening the repositories drawer (`?repos=<runner>`) with its search, busy first then A–Z | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` | s3 | 4 | build |

**Shared ground.** Every slice changes the same page: `RunnersPage.tsx`, `runners.css`, `model.ts`,
`demo.ts`, the page's render tests (`render.test.ts`, `health.render.test.ts`, `loss.render.test.ts`,
`page.test.ts`) and `apps/galaxy/app/app/runners/page.tsx`. So all four declare the whole page folder
and the route folder, and each is blocked by the one before it: one slice per wave, s1 to s4, each
starting from the merged work of the last.

## Per slice: done when

### s1 (`ui: yes`)
- `jobBucket` puts every status the `runners` screen lists in exactly one of Needs you, Running, Cannot
  run, Failed and Done, as the spec's table says; a table test covers one job per status (AC-4).
- With no `?jobs=`, or an unknown value, the jobs table lists only the Running bucket; `?jobs=cannot`,
  `failed`, `done` and `all` list theirs; the tabs are links with their counts, Cannot run and Failed in
  `--ask-red` with an icon when above zero; All counts every job (AC-1, AC-2).
- The Needs you band shows on every tab with each job's one action and Terminal, and is not drawn
  when empty; the page's one primary action is chosen among the band, then the open tab (AC-3).
- An empty Running tab reads **Nothing running.**, the last job that ended, and a link per tab with
  jobs; another empty tab reads **No job here.** with `Nothing here in the last 50.` (AC-5).
- The `?jobs=` choice survives the 5 s refresh, and `?terminal=` and `?answer=` still open their
  drawers.

### s2 (`ui: yes`)
- Beside Cancel, a Cannot run row whose reason is `No runner holds <repo>` or `<runner> does not hold
  <repo>` offers to copy `omni runner --name <name> --repos <dir>`; `Update the runner's kit` offers to
  copy `omni update` (AC-6).
- `No runner of <fleet> holds <repo>` offers a workspace owner **Show fleet**, which focuses the fleet
  picker of the first runner holding the repository; anyone else sees the reason only.
- `The runner it was sent to is gone` and `Fleet <fleet> is gone` offer **Send to any runner**, which
  sends the same line and repository to Any runner as the person who presses it; the old job keeps
  its Cancel.

### s3 (`ui: yes`)
- The page says Runners once, with `<n> runners · <k> online · <u> of <s> slots in use` under it, and
  no section heading Runners (AC-9).
- Each runner is a card in the spec's order; its slots read one pip per slot and `<used> of <slots>
  slot(s)`, each busy pip titled with the fleet of the job using it, and `Used by <fleet>, Any runner`
  under them (`slotFleets`: the `toFleet` label, `Any runner`, or the runner's name) (AC-8).
- CPU, Memory and Disk show a tick at the runner's limit when it has one and read in `--ask-red` with
  an icon past it; the kit reads in `--ask-red` with `blocks <n> job(s)` only when `kitBlocks` counts a
  queued job with the kit reason this runner could take.
- The offline, `Update this runner to see its health.` and Paused states keep their words.

### s4 (`ui: yes`)
- A runner card shows `<n> repositories`, then `· <k> with jobs` when some have a job queued or
  running, as a button, instead of the inline list (AC-7).
- It opens a Drawer set on the URL as `?repos=<runner name>` (an unknown name opens nothing): the
  runner's name, `<n> repositories this runner holds`, a search that filters as one types, and the
  list from `repositoryRows`, busy first then A–Z, each with its counts, its last job among the last
  50, and `Also on …` or `Only on this runner`; `Last job: among the last 50 only.` at its foot (AC-7).
- Esc, the close button and a click outside close it and clear `?repos=`; the focus returns to the
  button.
