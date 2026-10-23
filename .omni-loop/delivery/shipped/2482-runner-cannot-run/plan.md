# Plan: A queued job no runner can take reads Cannot run

PRD #2482, spec beside this plan (`spec.md`). The feature branch `feat/runner-cannot-run` goes into
`main` with `Closes #2482`; each slice is a sub-PR from `feat/runner-cannot-run--<slice>` into the
feature branch, with `Part of #2482`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A queued job whose target is gone, or that no runner of its target holds the repository of, reads Cannot run in red with its reason; the Waiting line picks its runners by the same rule as the claim | `apps/galaxy/src/runners/page/` | — | 1 | build |
| s2 | The board carries a runner's `githubApp` and a job's `needsApp`, and a queued job that needs its key's GitHub App, with no runner of its target able to run one, reads Cannot run with `No runner can run it as <key>'s GitHub App` | `apps/galaxy/src/runners/page/` `apps/galaxy/src/runners/runners.` | s1 | 2 | build |

**Shared ground:** `apps/galaxy/src/runners/page/` is declared by s1 and s2: the page model
(`model.ts`), the Waiting line (`health.ts`), the row (`RunnersPage.tsx`) and their tests
(`model.test.ts`, `health.test.ts`, `render.test.ts`). s2 is in wave 2, blocked by s1, so it adds the
App rule to the function s1 wrote, never beside it.

## Per slice: done when

**s1** (`ui: yes`)
- One pure function of the page model takes a job, the board's runners and the workspace's fleets, and
  returns the reason a queued job cannot run, or null; a job that is not queued is always null.
- A runner counts for a job when the job went to it, to its fleet, or to any runner and it has no
  fleet, and it holds the job's repository; offline, busy and paused runners count.
- The reasons, the first that applies: `The runner it was sent to is gone`, `Fleet <fleet> is gone`,
  `<runner> does not hold <owner/name>`, `No runner of <fleet> holds <owner/name>`,
  `No runner holds <owner/name>`; unit tests hold each, and each way a runner can take a job.
- A queued job with a reason renders `Cannot run` in the `fail` tone in place of Queued, the reason in
  the `runners-why` line under it, and keeps its Cancel (`render.test.ts`).
- `waitingWords` picks its runners with the same rule: for a job sent to any runner, a paused runner
  with a fleet does not count (`health.test.ts`); a Cannot run job shows no Waiting line.
- The page's demo board (`demo.ts`) holds one Cannot run row.

**s2** (`ui: yes`)
- The board's runner carries `githubApp` (from `runners.github_app`) and its job `needsApp` (the key
  that sent it holds an App, or `runner_job_needs_app` marks it), read as the service role; both are
  optional on the contract, and a board without them still parses (`runners.contract.test.ts`).
- `runners.service.test.ts` holds both fields on the board, from the store's in-memory fakes; no test
  calls GitHub or a real database.
- A queued job with `needsApp`, whose target's runners hold the repository but none has `githubApp`,
  reads Cannot run with `No runner can run it as <key>'s GitHub App`; one runner with `githubApp`
  makes it Queued; an absent field reads as false.
