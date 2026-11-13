---
prd: 2809
title: Runner jobs that never lose work
blocked-by: none
spec: file
phase0: server
---

## Problem

A runner job is one attempt that dies with its machine. Today (PRD 1830, PRD 1911, bug 2170):

- A runner silent for over 90 s, a runner that registers again after a restart, or a claim never
  reported running for 10 minutes ends the job `failed · runner lost`, and nothing is retried
  (`apps/galaxy/src/runners/runners.service.ts`).
- When a job ends, `cleanUp` runs `git worktree remove --force` on the job's folder
  (`kit/lib/runner/runner.ts`), which also removes the worktrees the skill made inside it, one per
  slice; an `agent/job-<id>` branch that was never pushed is deleted; after a restart the hourly
  sweep removes the stranded folders (`kit/lib/runner/sweep.ts`). Nothing is saved first.
- So a laptop-free loop loses work exactly when a machine does: uncommitted edits and local-only
  commits of a slice in flight are gone, and a person must notice the red row and press Resume.

The skills that build (`/omni:yolo`, `/omni:wave`, `/omni:do-work`, `/omni:pr-care`…) already pick
up from what GitHub holds (claims, sub-PRs, merged slices). What is lost is only what was never
pushed, and the fact that nobody restarts the job.

This is the first area of concept #2800 (the Fleet's Operation room): the missions it plans keep
moving with the laptop closed only if a lost runner never loses work.

## Solution

### 1. A resume is a new job row

- A job that ends `failed · runner lost`, `failed · the worktree could not be made` or
  `failed · the tmux session could not be started` is **lost** when its skill is a **resumable
  skill**: `yolo`, `yolo-fix`, `wave`, `do-work`, `pr-care`, `bug-fix`, the runnable skills
  that pick up from what GitHub holds (`RESUMABLE_SKILLS`, a subset of `RUNNABLE_SKILLS` in
  `kit/lib/runner/line.ts`, held to it by a test). In the same
  transaction that ends it, the database queues a **resume**: a new `runner_jobs` row with the same
  line, repository, sender (the key and its maker too, BR-PRODUCT-125), target (`to_runner` or
  fleet), `resumes = <lost job's id>` (unique, so a second mark queues nothing), `attempt =
  <lost attempt> + 1`, and `resume_after = now() + <wait>`: 1 minute after the first loss, 5 minutes
  after the second.
- `runner_claim()` never hands out a job before its `resume_after`. The wait lets a runner that was
  only silent come back, be refused, and save its work before the resume starts.
- **At most 3 attempts.** The third loss queues nothing: the job reads **Lost 3 times**, each loss
  listed, and today's Resume button (PRD 2375) sends the line again as the person who presses it, as
  attempt 1 of a new chain.
- **Never resumed:** a cancelled job, a refused one, the skill's own failure (its exit code), a
  timeout, a job whose skill is not resumable. No timeout or limit is raised.

### 2. The fence

- A report on a job that has ended is refused (409), as today, and the runner stops that job's
  session at once. The GitHub token refresh (`/api/runners/jobs/<id>/github-token`) is refused too
  once a job has ended. A replaced attempt can therefore write nothing to the replacement's row,
  and loses its GitHub token within the hour it was issued.
- **One writer per branch.** A slice claimed by a job is held by that job's whole chain of
  attempts: its resume may build the slice, and no other job may.

### 3. Saving before anything is removed (runner, `kit/lib/runner/checkpoint.ts`)

Before `cleanUp`, before the sweep removes a stranded job folder, and when a 409 stops a job:

1. List the checkout's worktrees (`git worktree list --porcelain`) that are the job's folder or sit
   inside it.
2. For each, find what GitHub does not hold: uncommitted changes (tracked files, and new files git
   does not ignore) and commits not on `origin` (`git rev-list HEAD --not --remotes=origin`).
   Nothing found in any worktree: nothing is saved (the common case).
3. Otherwise make a **snapshot commit** of the uncommitted changes through a temporary index
   (`GIT_INDEX_FILE`, `add -A`, `write-tree`, `commit-tree`), so no branch moves, and write **one
   git bundle** for the job holding, per branch, the ref `omni-checkpoint/<branch>` at its snapshot
   (or its head) and only the commits `origin` lacks.
4. Ask the App for a signed upload link (`POST /api/runners/jobs/<id>/checkpoint`), upload the
   bundle to the private bucket `runner-checkpoints`, then send its **manifest**: per branch its
   name, base commit, head commit, files and commits saved; the bundle's bytes; and the turnover
   handoff note when the job has one, masked as logs are and cut to 8 KB. A Zod schema in
   `runners.contract.ts` reads it on both sides.
5. When the upload fails (no network, refused, over 100 MB), the worktree is **kept** in place and
   the manifest says `local`, with the runner, its size and `keep_until` (7 days). Kept folders count
   against the runner's **disk budget** (`--keep-budget`, 5 GB by default): over it, the oldest kept
   folder is removed and its manifest records what was lost. The sweep tries the upload again on
   each pass and removes a kept folder at its `keep_until`.

### 4. Restoring (runner, on claiming a resume)

1. The claim of a job with `resumes` carries its chain's checkpoints: for each portable one a
   signed download link (minutes) and its manifest; for each local one, its manifest.
2. The runner fetches each bundle into the job's checkout as `refs/heads/omni-checkpoint/<branch>`
   and writes `~/logs/job-<id>.resume.md`: the attempt (`2 of 3`), each saved branch and whether it
   fast-forwards from `origin`'s or diverged, the handoff note, and what could not come
   (`3 files on feat/x--s3 stayed on box-1`). The session's prompt points at it, as a turnover's
   handoff note does today.
3. **The skills' rule:** on a resumed job, after checking out a branch the note lists, first take its
   checkpoint (`git merge --ff-only omni-checkpoint/<branch>`, or a merge when it diverged), before
   anything else. Written once in the kit's runner guidance the resumable skills read.
4. A resume whose chain holds a `local` checkpoint goes to that runner while it is online at its
   `resume_after`; otherwise to any runner, whose note names what stayed behind.

### 5. Forgetting

A chain's bundles are deleted from the bucket when the chain ends (a job of it ends done, cancelled,
or not resumed), and in any case 7 days after upload, by the App's job ledger (an hourly
`checkpoints-forget` kind). Manifests stay with their job rows, holding no file content.

### 6. The Runners page

- The lost job reads **Lost · resuming**, in place of `Failed · runner lost`, with
  `<runner> went silent at <time> · attempt <k+1> of 3 in <wait>` under it, linking the resume.
- The resume reads `after a loss · job <id>`, then `attempt <k> of 3` on a line of its own (as `after answers · job <id>` reads
  today), and once started one line of what came back: `Resumed from the <time> save · <n>
  branches`, `Started over: nothing was unsaved`, or `<n> files stayed on <runner>`.
- A runner keeping local saves shows `Keeps <size> until <day time>` on its row (the last save's
  day and time when it keeps several).
- The third loss reads **Lost 3 times** in `--ask-red`, the losses listed, Resume its one action.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | db | `runner_jobs.resumes`, `runner_jobs.attempt`, `runner_jobs.resume_after` | `runner_jobs.continues` ← `supabase/migrations/20261218100000_runner_job_questions.sql` |
| vertuo-omni-loop | db | `runner_checkpoints` (table), `runner-checkpoints` (bucket) | buckets ← `supabase/migrations/20261023090000_proof_runs.sql:21` |
| vertuo-omni-loop | db | `supabase/migrations/<next free version>_runner_resume.sql` | conventions › A new migration takes the next free version |
| vertuo-omni-loop | kit | `kit/lib/runner/checkpoint.ts`, `kit/lib/runner/resume.ts` | no written convention: follows `kit/lib/runner/turnover.ts` |
| vertuo-omni-loop | api | `POST /api/runners/jobs/<id>/checkpoint` | no written convention: follows `apps/galaxy/app/api/runners/jobs/[id]/github-token` |
| vertuo-omni-loop | job | `checkpoints-forget` (App job kind) | job kinds ← `apps/omni-app/src/jobs/payloads.ts` |
| vertuo-omni-loop | contract | `RESUMABLE_SKILLS`, `CheckpointManifestSchema` | no written convention: follows `RUNNABLE_SKILLS` in `kit/lib/runner/line.ts` |

## Decisions

- **A resume is a new job row** (`resumes`, `attempt`), not attempts under one job and not a
  runner-side journal: the person chose it; it reuses `continues`'s shape and today's 409 fence.
- **Checkpoints are git bundles in a private Omni bucket,** not hidden refs or branches in the
  repository: the person chose it over refs ("something more portable"). Only tracked files and new
  files git does not ignore enter a bundle, so an ignored `.env` never travels; 100 MB cap; deleted
  when the chain ends or after 7 days.
- **The voice.** persona:B-E DEv objected: "A kept worktree on box-1 is my next disk-full ticket,
  and a bundle in Omni's storage is customer code living somewhere new. Who deletes it, and when?"
  Settled `accepted`: the 7-day cap, deletion when the chain ends, and a per-runner disk budget that
  removes the oldest kept folder and says what was lost.
- **Waits 1 then 5 minutes, at most 3 attempts,** and the list of transient losses and resumable
  skills above: the design the person approved.
- **No proof video:** the fake-runner tests are the proof (the person said no).
- **Not here:** fleet-wide capacity and provider waits (`fleet-capacity`), missions and the
  Operation room (`room-and-reviewer`), test logs as verification evidence (the pushed CI is the
  evidence today).

## User stories

- As a person who sent `/omni:yolo 2803` to the fleet and closed the laptop, when box-1 loses power
  mid-slice, I find on Monday that box-3 carried on from box-1's last save, and the slice's
  uncommitted edits are in its sub-PR.
- As the B-E DEv who runs the boxes, I see what each runner keeps, how big it is and until when, and
  nothing kept outlives its week or the disk budget.
- As a reviewer, I never find two runners pushing to one slice branch.

## Scope

In: the three columns and the checkpoint table and bucket; the claim's wait; the resume queued on a
loss; the fence on token refresh; the runner's save, upload, keep, budget and restore; the skills'
resume rule; the forget job; the Runners page rows; the fake-runner tests.

Out: fleet capacity, provider waits, missions, the Operation room, any change to a skill's own
failure handling, raising any timeout.

## Test seams

- **The database:** `supabase/checks/runner_resume.sql` (a check step of its own in the `supabase`
  workflow): a loss of a resumable job queues one resume with the right wait, a second mark queues
  none, a third loss queues none, a cancel or a skill failure queues none, `runner_claim()` skips a
  job before its `resume_after`, and the bucket refuses a non-member.
- **The service:** `apps/galaxy/src/runners/runners.service.test.ts` on realistic rows and a fixed
  clock: the token refresh refused for an ended job, the claim carrying the chain's checkpoints, a
  local checkpoint routing the resume to its runner while online, the page rows' words.
- **The runner:** `kit/lib/runner/checkpoint.test.ts` and `resume.test.ts` on temporary git
  repositories with a nested worktree: nothing pushed-only is saved; uncommitted and local commits
  are bundled and come back as `omni-checkpoint/<branch>`; an ignored `.env` never enters; a failed
  upload keeps the folder; the budget removes the oldest and records it.
- **End to end, fake runners:** `kit/lib/runner/resume.e2e.test.ts` drives two in-process runners
  against an in-memory App (the existing fake API of `kit/lib/runner/runner.test.ts`): box-1 is
  killed mid-slice, box-3 resumes from the save, box-1's late report is refused, and three losses
  stop the chain. No model call: the session is a fake that edits files.

## Risks

- **What merging publishes:** a migration on production (`runner_jobs` columns, `runner_checkpoints`,
  the bucket), the arcade's Runners page and API, the App's new job kind, and the kit (`omni runner`):
  a runner on an older kit keeps today's behaviour (nothing saved, the server still queues the
  resume). Rolled back by reverting the PR and a migration that drops the columns, table and bucket.
- **Customer code in Omni's storage:** bundles hold repository files. Private bucket, members'
  runners only, signed links of minutes, 100 MB cap, 7-day retention, ignored files excluded.
- **A stale runner pushes in the window** between its loss and its next refused report: its pushes
  are plain pushes, which fail on a branch the resume moved; a slice's claim names one job at a time.
- **The Legal entries:** L-GDPR-1 (only members read a workspace's data: the bucket's policy and
  the signed links are per workspace), L-GDPR-2 (no credential in a bundle or manifest: ignored
  files are excluded, the handoff note is masked), L-GDPR-4 (bundles and kept folders have a
  retention period, 7 days, and a size cap), L-GDPR-5 (Supabase already named as a processor; no new
  service).
- **The locked laws:**
  - BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-63, BR-PRODUCT-64,
    BR-PRODUCT-12, N-PRODUCT-16: printed for the migration's layer; the design keeps each (no
    membership, ask session, AI key, agent link, answer or ledger row is read or written).
  - N-PRODUCT-15: if broken, unreviewed work reaches every user. Kept: a resume merges nothing a
    person did not. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - Rule BR-PRODUCT-4 (every slice claimed by a draft PR) is kept: a resume takes over the lost job's
    claim, it never builds an unclaimed slice. Rule BR-PRODUCT-125 is kept: a resume keeps the key
    sender and its maker.
- **The business laws:** BL-APPROVALS-1 (an approval covers exactly the files the approver read)
  is kept: a resume changes no approved file and approves nothing. BL-ASK-1 (an answer is never
  reworded) is kept: this PRD reads no person's answer and writes none.

## Acceptance criteria

- A resumable job that ends `runner lost` reads **Lost · resuming**, and exactly one resume row
  exists for it, with `attempt` one more and `resume_after` 1 minute later (5 minutes after a second
  loss); marking it lost again creates no second row.
- No runner claims a resume before its `resume_after`.
- A cancelled job, a refused one, a job whose skill exited non-zero, a timeout, and a job of a skill
  outside `RESUMABLE_SKILLS` are never resumed.
- The third loss of a chain queues nothing and reads **Lost 3 times**, its losses listed, with Resume.
- A report and a GitHub token refresh for an ended job are refused, and the runner stops that
  job's session on the refusal.
- Killed mid-slice with uncommitted edits and an unpushed commit in a nested worktree, the job's
  edits and commit come back on another runner as `omni-checkpoint/<branch>`, and its resume note
  lists the branch; a worktree whose work is all on `origin` saves nothing.
- A file git ignores (a `.env`) is never in a bundle.
- A failed upload keeps the folder on the runner, its row reads `Keeps <size> until <day time>`, and the resume goes to that runner while it is online; over the disk budget the
  oldest kept folder is removed and its manifest names what was lost.
- A chain's bundles are gone from the bucket once the chain ends, and 7 days after upload at most.
- A slice claimed by the lost job is held by its chain: its resume may take it up, and no other job may.
- Every test above runs on fake runners and temporary git repositories, with no model call.
