---
prd: 2375
title: A runner job stopped mid-way never reads Done
blocked-by: none
spec: file
phase0: server
---

## Problem

A runner job ends `done` whenever its agent exits with code 0. For `/omni:yolo` and `/omni:yolo-fix`,
PRD 2223 reads the job's last log line, its hand-off, into an outcome (`answers`, `held`, `ready`).
With no hand-off line the outcome stays null, and the Runners page shows **Done** in green. PRD 2223
chose that on purpose.

It hides work left half-built. Job 93914438 ran `/omni:yolo 2338`, built two sub-PRs and exited before
merging any slice. The feature PR still read `slices: 0 / 5 merged`, and the page said Done in green,
so nobody looked until a person compared it by hand (issue #2366). The person decided (#2366): "a job
stopped mid way IS NOT DONE - it is probably even more 'blocked' than anything else".

## Solution

1. **The runner.** A `/omni:yolo <n>` or `/omni:yolo-fix <n>` job that exits 0 with no hand-off line
   for its PRD gets the outcome `stopped`, in place of null. At that ending the runner counts the
   PRD's slices as the terminal follow already does (`omni board <n> --json`, merged out of all) and
   reports them with the job's end: `slices_merged`, `slices_total`. A count it cannot read is left
   null and stops nothing. Every other skill, and every other ending, is unchanged.
2. **The database.** One migration:
   - `runner_jobs.outcome` accepts `stopped`, and `human`. `human` is the value the page's Need human
     state already writes, which the check refuses today.
   - It adds `slices_merged` and `slices_total`, both nullable, `0 ≤ merged ≤ total`.
3. **The Runners page.** A `stopped` job reads **Stopped mid-way**, in the red of Failed. Under it, in
   one line: `<k> / <n> slices merged`, when known, then the claims it released, as today. Its one
   action is **Resume**, the page's primary when present. Resume sends the same line, repository and
   target again, as the person who presses it, exactly as Send again does. Nothing resumes by itself.
4. **The terminal follow** ends such a job on `Stopped mid-way · <k> / <n> slices merged`, and gives
   the same line to send again.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | database | `runner_jobs.outcome = 'stopped'` | `outcome` values ← `supabase/migrations/20261217090000_runner_outcome.sql` |
| omni-loop | database | `runner_jobs.slices_merged`, `slices_total` | no written convention: follows `runner_jobs.released` ← `supabase/migrations/20261214090000_runner_released.sql` |
| omni-loop | page words | `Stopped mid-way`, `Resume`, `<k> / <n> slices merged` | `OUTCOME_WORDS` ← `apps/galaxy/src/runners/page/model.ts:54` |
| omni-loop | page tone | `is-fail` | `statusTone` ← `apps/galaxy/src/runners/page/model.ts:101` |

## Decisions

- **Stopped mid-way is not Done** (decided by @pierrederval on #2366). This replaces PRD 2223's
  decision that a yolo job with no hand-off line reads Done.
- **How it shows** (asked): red, `Stopped mid-way`, the slices merged out of the total, and one Resume
  button. Not reusing Need human, and no automatic restart.
- **Scope** (asked): `/omni:yolo` and `/omni:yolo-fix` only, the skills with a hand-off line to miss.
- **The voice's objection** (Lead Engineer, `persona:Lead Engineer`): "PRD 2223 chose Done on purpose:
  a job whose log simply lost its last line will now show red for no reason, and people will learn
  to ignore red too." Settled **none**: the person approved the design over it. The reason they
  approved: a false red costs one look at the Terminal, while a false green hides work left mid-way.
- **Taken without asking, the most reversible option:** `human` is added to the outcome check in the
  same migration, because the page writes it already. A follow-up migration reverts both values.

## User stories

- As the person watching the Runners page, I see at once which job stopped before finishing, and
  what it left, so I resume it rather than trusting a green Done.
- As the person following a job in the terminal, the follow ends on the same words.

## Scope

In: the runner's ending for `/omni:yolo` and `/omni:yolo-fix`, the job's slice count, the
migration, the Runners page state and its Resume action, the terminal follow's words, and the
library's `runners` screen (a draft).

Out: other skills' endings, any automatic resume, and a job that failed or timed out (Failed already
reads red).

## Test seams

Following the testing form:

- **Kit, unit:** `runOutcome` and the runner's ending:
  - a yolo or yolo-fix job exiting 0 with no hand-off line is `stopped`, with its count;
  - one with a hand-off line keeps its outcome;
  - other skills are unchanged;
  - a count that cannot be read is null.
- **The follow's words.**
- **Database:** a check under `supabase/checks/` proves `stopped` and `human` are accepted, a bad
  count is refused, and only the service role writes them. The migration is dated after the newest
  on `main`, and `supabase/database.types.ts` is regenerated.
- **Galaxy:** `model.ts` and the render tests: the red `Stopped mid-way` state, the count line,
  Resume as the one primary, and Resume sending the same line.

## Risks

Merging publishes the kit (the runner's ending, through the plugin and `kit/dist`), galaxy (the
Runners page) and a migration on production Supabase. Rollback: revert the merge, then a follow-up
migration drops the two columns and the two outcome values once no row uses them.

- A job whose agent ended normally but lost its last log line reads red: one look at the Terminal
  answers it (the objection above, approved over).

The Legal entries it touches:

- **L-GDPR-4:** a job's ending and its count are records of what was done, kept with the job.

The locked laws it touches. The paths are governed by every locked law:

- BR-PRODUCT-3: an agent could wave its own work through. Resume is a person's press. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-5: a feature merged with questions open. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-6: a risky change nobody explained reaches main. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-12: an answer changed after it was given. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-28: a stranger tied to a team. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger reads a team's questions. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-39: a session of no workspace read or deleted. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-59: the workspace's AI key seen by a member. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent reads another team's work. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-64: a leaver still reads through an agent. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-94: an agent answers in a person's name. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-3: a badly ranked question slips past. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-4: a change switches its own gate off. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-7: a broken hook blocks a person. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-8: questions sent to a server nobody chose. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-13: the install writes outside its folder. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-14: a rule quietly loses its test. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-16: the ledger rewritten. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-17: a secret reaches the browser. Changing it needs @pierrederval to approve the pull request on GitHub.

## Acceptance criteria

1. A `/omni:yolo <n>` or `/omni:yolo-fix <n>` job that exits 0 with no hand-off line for PRD n ends
   `done` with outcome `stopped` and its slice count (`slices_merged`, `slices_total`), or a null
   count when the board cannot be read. One with its hand-off line keeps its outcome, as today.
2. Any other skill's job ends exactly as today.
3. The database accepts the outcomes `stopped` and `human`, and refuses a count where merged is
   below 0 or above total.
4. The Runners page shows a `stopped` job as `Stopped mid-way`, in red, with `<k> / <n> slices
   merged` when known and its released claims, and one Resume button, which is the page's primary.
5. Resume queues the same line, repository and target as a new job sent by the person who pressed
   it. No job resumes by itself.
6. `omni runner follow <n>` ends such a job on `Stopped mid-way · <k> / <n> slices merged`.
7. A job that exits 0 with a hand-off line, and a job that failed or was cancelled, read as before.
