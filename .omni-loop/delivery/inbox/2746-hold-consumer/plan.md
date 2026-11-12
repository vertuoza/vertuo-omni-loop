# Plan: Hold a consumer PR until its provider is served

PRD #2746 · spec: `spec.md` beside this plan · feature branch `feat/hold-consumer` into `main`
(`Closes #2746`) · sub-PRs from `feat/hold-consumer--<slice>` into the feature branch (`Part of #2746`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni hold <owner/repo>#<n> [--json]` reads a pull request's `Merge after` lines and prints one row per provider (open → held, merged → clear, closed unmerged → fail, unreadable → held) and the verdict, with its help entry | `kit/lib/hold/` `kit/bin/commands/hold.ts` `kit/bin/commands/index.ts` `kit/bin/hold.test.ts` `kit/lib/help/entries.ts` | — | 1 | build |
| s2 | `/omni:ultra-yolo` and `/omni:ultra-wave` write one `Merge after <owner/repo>#<n>` line per provider target on a consumer target's pull request, from the plan's cross-target blockers | `kit/plugin/skills/ultra-wave/` `kit/plugin/skills/ultra-yolo/` `kit/test/hold-lines.test.ts` | — | 1 | build |
| s3 | the point `merge-after.served` (replace, after; `wait` verdict) joins the catalog; `omni hold` reads a merged provider's config through `gh` and names its hook as `probe`; `/omni:pr`, ultra-yolo's finish, `/omni:mega-bug-fix` and `/omni:mega-pr-care` run `omni hold` before ready, follow each probe, keep the pull request draft while held and raise one high item on a provider closed unmerged | `kit/lib/flow/points.ts` `kit/lib/flow/verdict` `kit/lib/flow/schema` `kit/lib/flow/points.test.ts` `kit/lib/flow/__snapshots__/` `kit/lib/hold/` `kit/bin/hold.test.ts` `kit/plugin/skills/pr/` `kit/plugin/skills/ultra-yolo/` `kit/plugin/skills/mega-bug-fix/` `kit/plugin/skills/mega-pr-care/` `kit/test/flow-points.test.ts` `kit/test/hold-ready.test.ts` | s1, s2 | 2 | deep |
| s4 | `/omni:drive` and `/omni:mega-drive` park a held PRD on its waiting line, run `omni hold` again each tick, mark it ready once clear and report it stuck past `limits.stallDays`; the guide explains the hold and the point | `kit/plugin/skills/drive/` `kit/plugin/skills/mega-drive/` `docs/guide/flow.md` `docs/guide/several-repositories.md` `kit/test/hold-drive.test.ts` | s1 | 2 | build |

**Shared ground.** `kit/lib/hold/` and `kit/bin/hold.test.ts` are declared by s1 and s3: s1 builds the
command, s3 adds the provider's probe on top, so s3 waits for s1. `kit/plugin/skills/ultra-yolo/` is
declared by s2 (the lines it writes) and s3 (its finish runs `omni hold`), so s3 also waits for s2.
s4 shares no prefix with s3 and runs beside it in wave 2. The point joins the catalog in the same
slice as the skills that follow it, because `kit/test/flow-points.test.ts` holds every skill a point
lists to it. Each skill slice tests its text in a file of its own (`kit/test/hold-*.test.ts`), so no
two slices share a test. The generated `kit/dist/` is rebuilt by the wave, never listed.

## Per slice: done when

### s1
- `omni hold demo-org/web#88`, its `gh` injected with a body saying `Merge after demo-org/api#41`
  and #41 open, prints the row `demo-org/api#41 open held` and the last line `held: demo-org/api#41 …`,
  exit 1: the test that would have caught the kit-gaps review's item 5 cases (a consumer merged before
  its provider).
- #41 merged, with no probe read yet, prints `clear`, exit 0; #41 closed unmerged prints `fail`, exit
  1; a `gh` that fails prints `held: demo-org/api#41 could not read: <why>`, exit 1, never clear.
- A body with no `Merge after` line prints `clear · no Merge after line`, exit 0; several lines give
  one row each, in the body's order; a line with no `owner/repo` means the consumer's own repository.
- `--json` prints the rows and the verdict as one object; `omni help hold` describes the command.

### s2
- `/omni:ultra-wave`'s and `/omni:ultra-yolo`'s text say: a consumer target's pull request body
  carries one `Merge after <owner/repo>#<n>` line for each provider target the plan makes it wait for
  (a slice blocked by a slice of another target), in the plan's order, as `/omni:mega-bug-fix`
  writes them.
- `kit/test/hold-lines.test.ts` holds both skills to that text.

### s3 (deep: a new verdict and a config read across repositories)
- `merge-after.served` is a point of the catalog, modes `replace` and `after`, inputs `provider`,
  `pr`, `merge-sha` and `consumer`; `omni check config` accepts a config declaring it and refuses a
  `before` hook there; `omni flow verdict merge-after.served` reads `pass`, `wait <why>` and
  `fail <why>`, and every other point still refuses `wait`.
- `omni hold`, for a merged provider whose default-branch config (read through `gh api`, injected in
  the test) declares the point, prints `probe` naming `<owner/repo>:<hook path>`, exit 0, and runs
  nothing; a hook file it cannot read is `held: the probe <path> of <owner/repo> cannot be read`.
- `/omni:pr` (its Done row), `/omni:ultra-yolo`'s finish, `/omni:mega-bug-fix` and
  `/omni:mega-pr-care` run `omni hold` before `gh pr ready`, follow each named probe with its inputs
  filled and hand its output to `omni flow verdict`, and mark ready only when every row is clear or
  passes; otherwise the pull request stays a draft and its status comment says
  `waiting for <owner/repo>#<n> to be served: <why>`. A `fail` raises one high outbox item naming both
  pull requests.
- `kit/test/flow-points.test.ts` and `kit/test/hold-ready.test.ts` are green.

### s4
- `/omni:drive` and `/omni:mega-drive` park a PRD whose pull request `omni hold` reads as held on its
  waiting line, run `omni hold` again each tick, and mark it ready through `/omni:pr` once it is clear;
  a probe still on `wait` past `limits.stallDays` is reported stuck on the status comment, naming the
  provider and the last reason. Nothing else notifies anyone.
- `docs/guide/flow.md` lists the point and its `wait` verdict; `docs/guide/several-repositories.md`
  explains the `Merge after` line and the hold, with a fictional `demo-org` example.
- `kit/test/hold-drive.test.ts` holds both skills to that text.
