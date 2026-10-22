# Settled outbox items — PRD 2425

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-keys-live-in-agent-links -->

## s1-01-keys-live-in-agent-links — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-keys-live-in-agent-links
prd: 2425
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

The plan says the new key columns point at a table of API keys, but no such table exists: keys are stored with the agent links. Should the columns point at the agent links table instead?

## The decision, in plain words

The new columns point at the agent links table, the one that already holds every API key, because no separate key table exists. Nothing else in the design changes.

## The intro, for fun

A plan named a table that was never built.

## The punchline, for fun

The keys had been living next door all along.

## The options, in plain words

A. Point the new columns at the agent links table, which holds every key today.
B. Build a separate keys table first and point the columns at it: one more migration, and every existing key would have to move.

## What I had to decide

PRD 2425's plan says `cancelled_by_key` and `closed_by_key` reference `api_keys`. There is no such table: PRD 2022 stores an API key as an `agent_tokens` row of scope `api` (20261210090000_api_keys.sql), and `runner_jobs.sent_by_key` already references `agent_tokens (id)`. Both new columns follow it, `on delete set null`, so a deleted key leaves what it did in place.

## What I did meanwhile

Built both foreign keys on `agent_tokens (id)`, `on delete set null` as `sent_by_key` does, and proved in supabase/checks/api_key_jobs.sql that deleting a key leaves the job and the round as they were.

## What it costs to change later

Pointing them somewhere else later is one migration that drops and re-adds two constraints; no row changes, since the ids stay the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant a separate keys table to come later: none is planned in PRD 2022's migration.

```

<!-- /omni-outbox-settled: s1-01-keys-live-in-agent-links -->

<!-- omni-outbox-settled: s1-03-database-checks-the-key -->

## s1-03-database-checks-the-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-database-checks-the-key
prd: 2425
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Should the database itself refuse a key that may not close a job's questions, and a job that is already carried on, or leave both checks to the web server?

## The decision, in plain words

The database checks the key itself: it must be live, from the same workspace, made by someone still in it, and allowed on the job's repository. It also refuses a job that is already carried on.

## The intro, for fun

A lock on the door, and another on the safe.

## The punchline, for fun

The database keeps its own lock, door or no door.

## The options, in plain words

A. The database checks the key and refuses a job already carried on, so any caller that reaches it is held to the same rules.
B. Leave both checks to the web server and let the database trust its caller: fewer rules in the database, one place to get wrong.

## What I had to decide

The plan asks the two functions to close a round for a key, with exactly one of a person and a key. It leaves open whether the data layer re-checks what the web server already checks (BR-PRODUCT-63 and BR-PRODUCT-64: same workspace, key not revoked, maker still a member, repository on the key's list) and whether a job a resume already continues is refused there (`runner_jobs.continues` is unique, so the insert would fail anyway). Both functions now call runner_job_closer_check(), and runner_job_answer raises 55000 before the insert, so a caller gets a clear refusal, not a unique violation.

## What I did meanwhile

Built runner_job_closer_check() with the same SQLSTATEs the routes read (P0002, 55000, 42501, 22023), granted it to the service role only, proved each refusal, and killed the mutations that dropped a rule from it.

## What it costs to change later

Removing the checks later is a function replace, with no data change; adding them back after they were left out would be the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the routes of the next slices still want to run the same checks before calling the functions, or rely on the refusals alone.

```

<!-- /omni-outbox-settled: s1-03-database-checks-the-key -->

<!-- omni-outbox-settled: s1-04-older-type-tests-follow-the-columns -->

## s1-04-older-type-tests-follow-the-columns — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-older-type-tests-follow-the-columns
prd: 2425
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Three older tests of the runner tables fail because the database types gained columns. Should this slice update them, though they sit outside its own area, or leave them red?

## The decision, in plain words

This slice updates the three assertions, and nothing else in those two test files. They pin the order of the generated types, so any new column breaks them, and the preflight must be green.

## The intro, for fun

New columns arrived, and the old tests wanted the old seating plan.

## The punchline, for fun

The seating plan is redrawn; nobody else was moved.

## The options, in plain words

A. Update the three assertions in this slice, so the preflight is green and later slices start from green tests.
B. Leave them red and let the first later slice that owns those test files fix them: this slice would not be green on its own.

## What I had to decide

supabase/database.types.ts is s1's alone (plan, shared ground), but apps/galaxy/src/runners/runners.migration.test.ts and runners.questions.migration.test.ts match the generated shape of runner_jobs, runner_job_questions, runner_job_answer and runner_job_dismiss to the column, so s1's new columns and arguments turn three assertions red (lines 163 and 188 of the first, 156 to 158 of the second). Those files are in the territory of s3, s6, s7 and s8 (waves 2 to 6), none of which runs in wave 1. The preflight has to be green for the sub-PR, so the assertions are brought up to the new shape here.

## What I did meanwhile

Edited only those three assertions (the regular expressions), added no test and removed none, and ran both files green. The generated types are unchanged by this.

## What it costs to change later

Moving the edits to another slice later means reverting two small hunks here and re-making them there; s3 would find the files already matching the types.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a later slice of this PRD also edits the same lines: the plan names those files for s3, s6, s7 and s8, and none runs in wave 1.

```

<!-- /omni-outbox-settled: s1-04-older-type-tests-follow-the-columns -->

<!-- omni-outbox-settled: s2-01-fixed-by-link-left-out-of-prs -->

## s2-01-fixed-by-link-left-out-of-prs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-fixed-by-link-left-out-of-prs
prd: 2425
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When a bug fix finds the bug was already fixed by an earlier pull request, should that earlier pull request also show among the pull requests the job opened?

## The decision, in plain words

I kept it out of that list: the job opened nothing for it, and the earlier pull request already has its own place on the job as the one that fixed the bug.

## The intro, for fun

The bug was fixed before we got there: where does the old fix go on the job's page?

## The punchline, for fun

Finding a fix and opening one are different jobs, so the page lists them apart.

## The options, in plain words

A. A. Leave the pull request that fixed the bug out of the list of opened pull requests (built).
B. B. List it in both places, as the job's log names it.

## What I had to decide

Whether the pull request a bug fix proved had already fixed the bug (the hand-off's Fixed by line) is also reported in the job's pull request list (prs). The plan names both fields and says prs holds the pull requests the job opened, but not whether the proven one belongs to both.

## What I did meanwhile

bugFixReading leaves the Fixed by link out of prs, so a PR: line that names it counts as fixedBy only. A run that opened its own pull request and also proved another keeps both, each in its own field.

## What it costs to change later

One filter in bugFixReading (kit/lib/runner/log.ts) and its test, plus the runner's expectation: a constant-sized change with no migration, since both fields are only reported and the app stores what it receives.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not see how the Omni page shows the pull request list beside the fixed-by link: the app and its page are slice s1's.

```

<!-- /omni-outbox-settled: s2-01-fixed-by-link-left-out-of-prs -->

<!-- omni-outbox-settled: s2-02-which-jobs-report-pull-requests -->

## s2-02-which-jobs-report-pull-requests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-which-jobs-report-pull-requests
prd: 2425
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Should only bug fix jobs report the pull requests they opened, and should a bug fix that failed or timed out still report the ones it had opened?

## The decision, in plain words

Only the two bug fix skills report them, and a bug fix that ended failed still reports the pull requests it had opened, so a person can find a draft it left behind. A cancelled job reports none.

## The intro, for fun

A job gave up halfway and its draft pull request is still out there: should the page list it?

## The punchline, for fun

A fix that stalls leaves its draft behind, and a list is easier to follow than a hunt.

## The options, in plain words

A. A. Only bug fix jobs report them, a failed one included (built).
B. B. Only a bug fix that ended done reports them; a failed one reports none.
C. C. Every kind of job reports the pull requests its log names.

## What I had to decide

Which jobs add the pull request list (prs) and the fixed-by link to their ending report, and on which endings. The plan names bug fix jobs only, and a failed run's draft is the case the list exists for.

## What I did meanwhile

Only jobs whose command line is /omni:bug-fix or /omni:mega-bug-fix read their log for these fields. A done one adds the outcome, the fixed-by link and the list; a failed one (exit code, vanished, timeout) adds the list and no outcome; a cancelled one adds nothing.

## What it costs to change later

Changing it later means moving one check in kit/lib/runner/runner.ts (bugFixOf, failedWithPrs) and its tests: no migration and no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) I did not check whether feature jobs of other skills also open several pull requests worth listing: the plan names bug fix jobs only.
- (author) A bug fix cancelled from the Omni page reports no pull requests, since the runner kills it without reading its log.

```

<!-- /omni-outbox-settled: s2-02-which-jobs-report-pull-requests -->

<!-- omni-outbox-settled: s3-01-prs-stored-as-links -->

## s3-01-prs-stored-as-links — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-prs-stored-as-links
prd: 2425
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

A bug fix can open several pull requests. Should the server keep each one as its link alone, or as its link with the repository and the number written beside it?

## The decision, in plain words

The server keeps each pull request as its link alone. The repository and the number are read out of the link whenever a key asks for the job, so there is one fact stored and nothing that can disagree with it.

## The intro, for fun

A pull request already carries its repository and its number in its address.

## The punchline, for fun

Storing them twice would only give them a chance to argue.

## The options, in plain words

A. Keep the links alone and read the repository and the number out of each link.
B. Store each pull request as a link, a repository and a number: three facts to keep in step, and a backfill of every stored list.

## What I had to decide

The plan says a key reads each pull request as a link, a repository and a number, and the migration says only that the job keeps a list of at most 50 of them; neither says what one entry of the list is. The runner reports links, so I store the links as reported, in order, and the API derives the repository (in lower case, as a key's list of repositories is written) and the number from each link when it reads the job. A link that is no pull request link, which the report's check never lets in, is left out of the read instead of failing it.

## What I did meanwhile

Stored the links exactly as the runner reported them, and built the key's read to name each one by its link, its repository and its number.

## What it costs to change later

Changing it later means storing the repository and the number too: one backfill of the stored lists, read once from their links, and the one place that reads them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a key would also want each pull request's title or state beside its link: the plan lists none, so none is read.

```

<!-- /omni-outbox-settled: s3-01-prs-stored-as-links -->
