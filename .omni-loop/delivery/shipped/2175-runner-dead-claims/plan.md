# Plan: Runner jobs recover from a dead job's claims and never wait on a question

PRD #2175. The spec is `spec.md`, beside this plan. The feature branch `feat/runner-dead-claims` goes
into `main` with `Closes #2175`. Each slice is a sub-PR from `feat/runner-dead-claims--<slice>` into
the feature branch, with `Part of #2175`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The board reads a draft sub-PR labelled `labels.released` as `claimed-stale` at once, and one still on `labels.inProgress` whose last commit and last update are both older than `limits.claimDeadMinutes` (240) as `claimed-stale` too. An unknown date is never stale. The config gains both keys; `couldBeStale` reads the new candidates; the engineering tally counts the same way. | `kit/lib/board.ts` `kit/lib/board-dead-claims.test.ts` `kit/bin/commands/board.` `kit/bin/board-dead-claims.test.ts` `kit/lib/config.ts` `kit/lib/config-dead-claims.test.ts` `apps/galaxy/src/engineering/tally.` `mutation/` | — | 1 | deep |
| s4 | An unattended run never asks. Under `OMNI_UNATTENDED`, `omni ask question` and `omni ask wait` exit 3 with `unattended`; `/omni:yolo` skips step 6's question and ends red with the outbox posted; the briefing's kit default **Asking** says to ask nothing and record an outbox item. | `kit/lib/env/read.` `kit/lib/ask/` `kit/bin/commands/ask.` `kit/bin/ask-unattended.test.ts` `kit/plugin/skills/yolo/` `kit/templates/playbook/briefing.md` `kit/test/unattended.test.ts` `apps/galaxy/src/docs/` `docs/guide/any-agent.md` | — | 1 | build |
| s2 | When a runner job ends while it holds claims, the runner's watcher releases them. Each job gets `OMNI_JOB`, `OMNI_RUNNER` and `OMNI_UNATTENDED`. `release()` finds the open draft sub-PRs whose status comment says `job: <id>`, swaps `labels.inProgress` for `labels.released`, and posts the alarm comment. The job's report carries `released` and `releaseError`, stored in two new `runner_jobs` columns. The Runners page shows *Released #n, …* or *Could not release this job's claims: <why>*. | `kit/lib/runner/` `kit/lib/env/read.` `kit/bin/commands/runner.` `kit/README.md` `docs/guide/runners.md` `supabase/migrations/` `supabase/database.types.ts` `apps/galaxy/src/runners/` | s1 | 2 | deep |
| s3 | A takeover reuses the same work or rebuilds. `omni claim check <prd> <slice>` prints `reuse` or one of the five `rebuild: <reason>` lines. `/omni:pr`'s Claim mode writes the `job:` line when `OMNI_JOB` is set. `/omni:wave`'s takeover of a `claimed-stale` slice reuses it (relabel, *taken over from job <id>*) or closes it with the reason, deletes its branch and claims afresh. `/omni:do-work` merges the feature branch into a reused branch, then runs the preflight and a diff review before its own work. | `kit/lib/claim/` `kit/bin/commands/claim.` `kit/bin/claim.` `kit/bin/omni.ts` `kit/lib/help/entries.` `kit/plugin/skills/pr/` `kit/plugin/skills/wave/` `kit/plugin/skills/do-work/` `kit/test/takeover.test.ts` `apps/galaxy/src/docs/` | s1 | 2 | deep |

**Shared ground.** Several slices declare the same prefixes; the waves keep them apart:

- `kit/lib/env/read.` is declared by s4 (`OMNI_UNATTENDED`) and s2 (`OMNI_JOB`, `OMNI_RUNNER`), in
  waves 1 and 2.
- `apps/galaxy/src/docs/`, the docs built from the skills' text, is declared by s4 and s3. They run
  in waves 1 and 2.
- **The law-proof tests stay untouched.** `kit/test/plugin.test.ts` proves N-PRODUCT-15,
  BR-PRODUCT-3 and BR-PRODUCT-5, and `kit/bin/ask-hook.test.ts` proves N-PRODUCT-7 and N-PRODUCT-8,
  all locked. `kit/lib/board.test.ts`, `kit/lib/config.test.ts` and `kit/bin/ask.test.ts` prove
  rules. No slice's territory names them: each slice writes its tests in new files, which it does
  name (`*-dead-claims.test.ts`, `ask-unattended.test.ts`, `unattended.test.ts`,
  `takeover.test.ts`). They must still pass unchanged.
- s1 shares no ground with s4, and s2 shares none with s3. Each wave's pair runs side by side.
- `kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them.

## Per slice: done when

### s1 (deep: the board's states, delivery core, with a mutation floor)

- **The rules.** `isClaimedStale` (or its successor) reads:
  - a draft carrying `labels.released` as stale at once;
  - a draft still carrying `labels.inProgress` as stale once its head commit date and its
    `updatedAt` are both older than `limits.claimDeadMinutes`;
  - a draft with no commit beyond its claim as stale after `claimStaleMinutes`, as today.
- **The board tests** (`kit/lib/board-dead-claims.test.ts`, a new file):
  - released → `claimed-stale`;
  - quiet at 241 min → `claimed-stale`, at 239 → `in-flight`;
  - an unknown head commit date → `in-flight` (BR-PRODUCT-2);
  - `merged` and `stuck` still win;
  - today's cases are unchanged.
- **The config.** It reads `labels.released` (default `omni:released`) and `limits.claimDeadMinutes`
  (default 240, a positive integer), and `kit/lib/config-dead-claims.test.ts` covers both.
- **`omni board`.** It passes `updatedAt`, `labels` and both limits. `couldBeStale` also reads the
  last commit of released and quiet-candidate drafts. `kit/bin/board-dead-claims.test.ts` covers it.
- **The engineering tally.** `apps/galaxy/src/engineering/tally.ts` counts released and quiet claims
  as stale, with its tests.
- **Mutation.** `pnpm mutation:changed` leaves no survivor in the changed lines of `kit/lib/board.ts`
  or `kit/lib/config.ts`. Their floors in `mutation/floor.json` never go down; raising one is an
  ordinary edit.

### s4

- **`omni ask`.** `OMNI_UNATTENDED` is read in `kit/lib/env/read.ts`. Under it:
  - `omni ask question` and `omni ask wait` print `unattended` and exit 3;
  - they open no round and wait for nothing;
  - `kit/bin/ask-unattended.test.ts` proves it.
- **`/omni:yolo`.** Step 6's **Answer here** names `OMNI_UNATTENDED` as a reason to skip it. The run
  then ends red with the outbox posted, as with `answers.enabled` off.
- **The briefing.** The kit default **Any agent › Asking** in `kit/templates/playbook/briefing.md`
  gains the line: under `OMNI_UNATTENDED`, ask nothing; a decision becomes an outbox item ranked
  high.
- **The checks on the text.** `kit/test/unattended.test.ts` reads the yolo skill and the briefing
  for the unattended rule. The existing plugin and docs tests pass unchanged. The `any-agent` guide
  page says the same.

### s2 (deep: the runner acts on GitHub when a job ends) (`ui: yes`)

- **The job's environment.** Each job's session gets `OMNI_JOB=<id>`, `OMNI_RUNNER=<name>` and
  `OMNI_UNATTENDED=1`, read through `kit/lib/env/read.ts`. `runner.test.ts` proves it.
- **The release.** `release(job, repo, reason)` in `kit/lib/runner/release.ts`, with `gh` injected,
  is tested to:
  - release only open drafts that carry `inProgress` and whose status comment names this job;
  - leave another job's claim, or one with no job line, alone;
  - swap the label and post the alarm comment;
  - still remove `inProgress` when the `released` label is missing, and report it;
  - turn a `gh` failure into `released: []` and a `releaseError`.
- **When it runs.** The job's end path calls `release` for done, failed, timeout and cancelled, and
  the hourly sweep calls it for a job the server marked lost. Each final report carries `released`
  and `releaseError`.
- **The app.**
  - **Contract:** `JobUpdateSchema` gains `released` (at most 50 numbers) and `releaseError` (at
    most 200 characters), both optional.
  - **Migration:** it adds `runner_jobs.released int[]` and `runner_jobs.release_error text`, dated
    after main's newest.
  - **Types:** `database.types.ts` is regenerated from the migrations, never hand-edited.
  - **Tests:** contract, controller, service and migration tests.
- **The Runners page.** A job row shows `Released #<n>, …` (linked) or `Could not release this job's
  claims: <why>` in `--ask-red`, as the `runners` draft screen draws it. Model and render tests cover
  both, and neither shows when there is nothing to say.
- **The docs.** The kit README and `docs/guide/runners.md` say what a release does and that
  `omni:released` must exist in the repository.

### s3 (deep: the takeover decides what happens to someone else's work)

- **`omni claim check`.** `omni claim check <prd> <slice>`, with git injected
  (`kit/lib/claim/check.test.ts`), prints and exits:
  - `reuse` (exit 0);
  - `rebuild: plan row changed: territory`;
  - `rebuild: plan row changed: title`;
  - `rebuild: outside territory: <path>` (the outbox dir and generated paths never count);
  - `rebuild: no claim commit`;
  - `rebuild: slice not in the plan` (exit 1 for each rebuild line).

  It is registered in `kit/bin/omni.ts` and the help entries. `kit/bin/claim.test.ts` runs it
  through `main()` on a fixture repository.
- **`/omni:pr` Claim mode.** It writes `- job: <id> · runner <name>` in the status comment when
  `OMNI_JOB` is set.
- **`/omni:wave` step 2's `claimed-stale` takeover.**
  - It runs `omni claim check` first.
  - On `reuse`: it adds `labels.inProgress` and removes `labels.released`, writes the status comment
    `claimed` with *taken over from job <id>* (or *from a quiet claim*), and tells the subagent the
    branch is reused.
  - On `rebuild`: it closes the sub-PR with `Closed to rebuild: <line>`, deletes its remote branch,
    and claims the slice afresh through Claim mode.
- **`/omni:do-work --in-wave` on a reused branch.** It merges the feature branch in, runs the
  preflight, and reviews the branch's diff against the slice's done-when. It fixes each finding
  within `limits.attempts` or records it as an outbox item, before its own work.
- **The checks on the text.** `kit/test/takeover.test.ts` reads the pr, wave and do-work skills for
  the job line, the two takeover branches and the re-verification. The existing plugin and docs tests
  pass unchanged.
