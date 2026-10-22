# Plan: A runner job stopped mid-way never reads Done

PRD #2375, its spec beside this plan (`spec.md`). The feature branch `feat/job-stopped-mid-way`
merges into `main` with `Closes #2375`; each slice is a sub-PR from
`feat/job-stopped-mid-way--<slice>` into the feature branch, with `Part of #2375`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A job can record that it stopped mid-way and how many slices it left merged: `runner_jobs.outcome` accepts `stopped` and `human`, and `slices_merged` and `slices_total` hold a count no lower than 0 and no higher than its total | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | build |
| s2 | A `/omni:yolo` or `/omni:yolo-fix` job that exits 0 with no hand-off line ends with outcome `stopped` and its PRD's slice count, every other ending unchanged, and `omni runner follow` ends it on `Stopped mid-way · <k> / <n> slices merged` | `kit/lib/runner/` `kit/bin/commands/runner.ts` `kit/bin/commands/runner-follow.ts` `kit/bin/commands/runner.test.ts` | — | 1 | build |
| s3 | The Runners page shows a stopped job as `Stopped mid-way` in red, with its slice count and released claims, and one Resume button, the page's primary, that sends the same line again as the person who presses it | `apps/galaxy/src/runners/` `apps/galaxy/app/api/runners/` | s1, s2 | 2 | build |

**Shared ground.** No prefix is declared by two slices. The end report's shape is named twice: the
kit's `kit/lib/runner/api.ts` (s2) sends it, and galaxy's `runners.contract.ts` (s3) reads it. s3
waits for s2, so it reads the shape s2 settled. `kit/dist/` and `apps/omni-app/api/` are generated:
no slice lists them, and the wave rebuilds them once.

## Per slice: done when

### s1

- A migration dated after the newest on `main` widens the `outcome` check to `answers`, `held`,
  `ready`, `human` and `stopped`. It adds `slices_merged` and `slices_total`, nullable, with
  `0 <= slices_merged <= slices_total`, and its header names its rollback.
- A check under `supabase/checks/`, its own step of the `supabase` workflow, proves:
  - `stopped` and `human` are accepted, and another value is refused;
  - a count below 0 or above its total is refused;
  - members read the columns, and only the service role writes them.
- `supabase/database.types.ts` is what `node scripts/supabase-types.ts` writes from a fresh local
  database (conventions › The database types are generated, never written).

### s2

- `runOutcome` returns `stopped` for a `yolo` or `yolo-fix` job whose last line is no hand-off for
  its PRD. A hand-off line keeps `answers`, `held` or `ready`, and every other skill returns what
  it does today.
- At such an ending the runner counts the PRD's slices with `omni board <n> --json` (merged out of
  all), and its end report carries `slicesMerged` and `slicesTotal`, or neither when the board
  cannot be read. The job still ends.
- `omni runner follow <n>` ends a stopped job on `Stopped mid-way · <k> / <n> slices merged`, or
  `Stopped mid-way` alone without a count, and gives the line to send again.

### s3 (`ui: yes`)

- The end report's `stopped` outcome and its counts are accepted and stored on the job.
- The page shows a stopped job as `Stopped mid-way` in the red of Failed (`is-fail`), with
  `<k> / <n> slices merged` when known and its released claims, as the library's `runners` screen
  says.
- Its one action is Resume, the page's primary, which posts the same line, repository and target
  as Send again does, as the signed-in person. Nothing resumes by itself.
- A done job with a hand-off outcome, and a failed or cancelled job, read and act as before (the
  model and render tests say so).
