# Bug 2693: the Omni app queues a runner job for a repository the workspace removed

## Triage

- **Domain:** runners — the Omni app's runner queue, which the retro and the main watch queue through
- **Risk:** medium — a workspace owner who removed a repository still gets app jobs for it: they sit as Cannot run, or run on a runner that still holds it; Cancel is the workaround
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/retro/runner-queue.removed.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected { job: 'job-1', created: true, …(1) } to deeply equal { job: null, created: false, …(1) }

## Fix

The app's runner queue found the workspace from the GitHub installation and queued the job without
reading whether the workspace had removed the repository. It now reads the repository's `removed_at`
first: for a removed repository it queues nothing, gives back no earlier job, and says
`the workspace removed <repository>`. A repository the workspace never listed is queued as before.

## Guard

The reproduction, a unit test of the queue: it fails when the queue makes or gives back a job for a
removed repository, and holds that a listed or never-listed repository still gets its job.

## Mutation

mutation: no changed core file against origin/main (badb205d): nothing to mutate
