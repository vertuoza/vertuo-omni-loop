# Bug 1179: /omni:yolo builds the slices on a feature branch behind the merged phase-0

## Triage

- **Domain:** delivery loop — `/omni:yolo` and `/omni:wave` (`kit/plugin/skills/`), and `omni board` (`kit/bin/commands/board.ts`), which both read before every wave
- **Risk:** medium — whoever runs `/omni:yolo` on a PRD planned before its phase-0 merged gets slices built against the pre-review spec and plan, and a feature PR left conflicting; the workaround is merging the default branch into the feature branch by hand before the first wave.
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/board.test.ts`
- **Red:** `omni board — a feature branch behind the default branch (issue 1179) > says the feature branch is behind <remote>/<default branch> — a phase-0 merged after the plan — so the wave merges it in first — AssertionError: expected undefined to deeply equal { branch: 'feat/widgets', …(2) }` (5 of 5 failed on main), and in `kit/test/plugin.test.ts`, `/omni:yolo meets the default branch in step 1, before \`omni prd\` reads the plan — AssertionError: expected [ '**meet the default branch**' ] to deeply equal []` (4 of 4 failed on main's skills)

## Fix

`/omni:plan` can cut the feature branch while the phase-0 PR is still open, and `/omni:yolo` read the plan on that branch and ran every wave there, meeting the default branch only at its finish (step 4); landings merged only the previous landing. So the slices followed the spec and plan before review, and the feature PR conflicted on the PRD's folder once phase-0 merged. `omni board --json` now carries `base` (`branch`, `onto`, `behind`): whether the feature branch, or the current landing's when its base is the default branch, carries `<remote>/<repo.defaultBranch>`, and the text board prints a line when it is behind. `/omni:yolo` gained **Meet the default branch** (step 1, before the plan is read; step 3, before each wave; Landings item 1): a merge in a detached worktree, the PRD folder's conflicts taking the default branch's side, a generated path either side, any other conflict the Stuck path, signed and pushed. `/omni:wave` never claims while `base.behind` is true. `/omni:plan` needed no change: its step 2 already merges the default branch.

## Guard

The `a feature branch behind the default branch (issue 1179)` rows of `kit/bin/board.test.ts` (behind, not behind, git cannot say, landing 1, a later landing stacked then retargeted) and the `the default branch met before the plan, the board and the first wave (issue 1179)` rows of `kit/test/plugin.test.ts`, which catch a skill that reads the plan or claims a wave without meeting the default branch. All 9 fail on main.

## Mutation

mutation: no changed core file against origin/main (611c1c17): nothing to mutate
