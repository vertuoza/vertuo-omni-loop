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

<!-- omni-outbox-settled: s4-01-lines-read-by-the-api-itself -->

## s4-01-lines-read-by-the-api-itself — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-lines-read-by-the-api-itself
prd: 2425
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The spec says how a key pages through a job's log lines but not where the API reads them from, nor what the marker for the next page holds. Should the API read the lines itself, and should each marker work for one job only?

## The decision, in plain words

The API reads a job's lines itself, only after the runners' rule has found a job this key may read, and each next-page marker holds the job and the number of the last line, so it works for that job alone. A marker from a list or from another job is refused like any other bad marker.

## The intro, for fun

Every list had its bookmark, and the log wanted one of its own.

## The punchline, for fun

A bookmark for one book is no use in another.

## The options, in plain words

A. The API reads the lines itself, after the runners' rule has found a job the key may read, and each next-page marker works for one job only.
B. The runners' own code gets a read of the lines for the API to call, as it does for the job: the same rules in one place, but it changes code another slice of this wave builds on.

## What I had to decide

The spec gives the route, the paging and the key rules, not where the read lives or what the cursor holds. The runners' files belong to other slices of waves 2 and 3, so the lines are read by a new `jobLines` in the public API's own repository, filtered by workspace and job, after `runners.keyJob` has applied the key rules: any key of the workspace reads the job, a key off its repository list gets 403, a person's job and another workspace's get 404. A line has no creation time and no id of its own, so the cursor cannot be the one the PRD and bug fix lists use: it is the opaque base64url of `['lines', job, seq]` and a page reads `seq > last`, oldest first. It is tagged with its job, as the lists' cursors are tagged with their list, so another job's cursor, a list's cursor and a tampered one all answer 422 with the lists' own message. A job past the PRD 1904 retention reads as an empty `data` with no cursor, and its `log_tail` stays on the job. An id that is no uuid is 404 before the database sees it.

## What I did meanwhile

Built the route, the read and the cursor in the public API's own files, with tests for paging by 50 and by 100, a line added between two pages, a job whose first lines were trimmed, an empty page past the retention, a second key of the workspace, a key off its list, a person's job, another workspace's job and each kind of bad cursor.

## What it costs to change later

Moving the read into the runners' code later means moving one function and its tests; no stored data changes. A cursor handed out before the move would still decode, because its shape would not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a client that reads a running job should be told that the job is still writing, so it knows to read again: the spec does not ask for it, and the page does not say it.
- (author) Whether a cursor held across the retention, whose lines have since been deleted, should answer an empty last page or an error: the spec says an empty page for a job past the retention, so it reads as an empty last page.

```

<!-- /omni-outbox-settled: s4-01-lines-read-by-the-api-itself -->

<!-- omni-outbox-settled: s5-01-refusal-names-the-key -->

## s5-01-refusal-names-the-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-refusal-names-the-key
prd: 2425
slice: s5
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a person sends an answer just after an API key already answered or dismissed the same question, who tells them which key came first: the page or the server?

## The decision, in plain words

The page does: after a refused send it reads the question again and shows who closed it, an API key by its name and the person it acted for, while the server's own refusal words stay as they are.

## The intro, for fun

Two answers crossed on the way, so the page checks who got there first.

## The punchline, for fun

The key signed the round first, and now the page says so.

## The options, in plain words

A. A. The page reads the question again after a refused send and names the key itself, the server's words unchanged.
B. B. The server's refusal words name the key and the page shows them as they are, with no second read.

## What I had to decide

Which side names the API key in the closed state a person sees after a refused send: the page, by reading again, or the server, in its refusal words.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

Built the page's side: after a refused send the drawer reads the question again and shows its closed words, and when the row cannot be read the refusal's words stand. The server was left as it is.

## What it costs to change later

One small function in the page. If the server's refusal words name the key later, the page's second read can go.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The server's refusal words name a login only and read someone for a key, and the server belongs to the slice that builds the key's own answers, so this slice did not change them.

```

<!-- /omni-outbox-settled: s5-01-refusal-names-the-key -->

<!-- omni-outbox-settled: s5-02-sender-line-wraps-on-a-phone -->

## s5-02-sender-line-wraps-on-a-phone — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-sender-line-wraps-on-a-phone
prd: 2425
slice: s5
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

On a phone, the sender of a key's job reads over three or four lines in a narrow column, and the words for whom it acted split across two of them. Leave it, or give that column more room?

## The decision, in plain words

Left as it is. Every word reads in full, nothing is cut off and the contrast is above the floor; the narrow column is how the table folds on a phone for every job today, so widening it would move the whole table.

## The intro, for fun

A long name in a short column wraps, but every word still shows.

## The punchline, for fun

More room for one cell means moving every row, so that waits for a say.

## The options, in plain words

A. A. Leave the folded table as it is, so the sender line wraps in its narrow column.
B. B. Give the sender cell more room in the folded table, and let the Where cell wrap sooner.

## What I had to decide

Whether the table of jobs, folded for a phone, gives the sender cell more room than it has today.

Decided by: Jev (hardToRevert 0.80) · agent said false

## What I did meanwhile

Looked at the page at phone and desktop widths: the words read in full and nothing overflows. Balancing the lines was tried and left out, because it leaves a dot opening the second line.

## What it costs to change later

One style rule for the folded table, and every row of the jobs table moves with it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a key's sender line should keep the words for whom it acted on one line, which needs the page to draw them apart from the maker's name.

```

<!-- /omni-outbox-settled: s5-02-sender-line-wraps-on-a-phone -->

<!-- omni-outbox-settled: s6-02-answer-refused-when-maker-left -->

## s6-02-answer-refused-when-maker-left — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-answer-refused-when-maker-left
prd: 2425
slice: s6
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

A key answers the questions of a job, but the person who made the key that sent the job has left the workspace. Should the answer go ahead?

## The decision, in plain words

No: the answer is refused as not allowed and nothing is closed, so the questions stay open for a person to answer on the page, because the job that resumes would be sent in the name of someone who is no longer a member.

## The intro, for fun

The key still works, but the hand that made it has left the room.

## The punchline, for fun

A person on the page can still pick up the question.

## The options, in plain words

A. A. The answer is refused as not allowed, nothing is closed, and the questions stay open for the page.
B. B. The answer goes ahead and the job that resumes is sent in the name of the maker who left.

## What I had to decide

The spec says the job that resumes is sent by the same key and the person who made it, whoever answers; it does not say what happens when that person left the workspace. The page's own automatic continuation of a key's job already refuses in that case, through the same member check, so the key's answer does too, before anything is closed or queued. The key reads 403 with words that name the reason.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Added the check to the key's answer in the runners' rules and proved it: nothing is closed, nothing is queued, and the key reads 403 while the questions stay open for the page.

## What it costs to change later

Changing it later means removing one check in the runners' rules; no stored row depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the owner of a key whose maker left should be able to hand the job to someone else to answer.

```

<!-- /omni-outbox-settled: s6-02-answer-refused-when-maker-left -->

<!-- omni-outbox-settled: s6-03-acting-for-allows-letter-marks -->

## s6-03-acting-for-allows-letter-marks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-acting-for-allows-letter-marks
prd: 2425
slice: s6
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

The name a key says it acts for takes letters of any alphabet. Should it also take the small marks that many names are made of, such as an accent typed as a separate mark?

## The decision, in plain words

Yes: marks are allowed beside letters, and digits of any alphabet too, while other symbols, new lines and emoji are still refused.

## The intro, for fun

Some names are a letter and a little mark on top.

## The punchline, for fun

Let the marks in, and keep the symbols out.

## The options, in plain words

A. A. Letters with their combining marks, decimal digits of any alphabet, spaces and the five symbols are allowed.
B. B. Only letters, digits, spaces and the five symbols as written, so a name typed with a separate mark is refused.

## What I had to decide

The spec's set is letters of any alphabet, digits, spaces and `. _ ' @ - ·`. A name typed in many alphabets, and accents typed as separate marks, is a letter followed by a combining mark, and a check on letters alone would refuse it as not a letter. The contract allows Unicode letters (L), combining marks (M) and decimal digits (Nd) with the spaces and the five symbols; the value is stored exactly as given.

## What I did meanwhile

Built the check on those three categories and proved it on names in Latin, Cyrillic, Han and Devanagari, an accent typed as a separate mark, digits of another alphabet, an address and a name with padding spaces, and on the refusals: a tag, an emoji, a new line, a number and 81 characters.

## What it costs to change later

Changing it later means changing one pattern in the contract; the values already stored stay as they were given.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a key's owner would rather see only a short list of known names than free text.

```

<!-- /omni-outbox-settled: s6-03-acting-for-allows-letter-marks -->

<!-- omni-outbox-settled: s6-04-dismiss-needs-no-body -->

## s6-04-dismiss-needs-no-body — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-04-dismiss-needs-no-body
prd: 2425
slice: s6
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

A key dismisses the questions of a job with nothing to add. Should it have to send a body at all?

## The decision, in plain words

No: a dismissal with no body, or an empty one, is accepted and acts for no one, and a body that holds anything but the optional name of whom the key acts for is refused, naming the field.

## The intro, for fun

Saying no thanks should not need a form.

## The punchline, for fun

A bare request closes the round just as well.

## The options, in plain words

A. A. A dismissal needs no body: none, an empty one or an empty object all work.
B. B. A dismissal needs a body, an empty object at least, as the answer does.

## What I had to decide

The spec says the dismissal takes the optional name of whom the key acts for, and nothing more. It does not say whether a call with no body at all is allowed. A body made only of optional fields is optional in most clients, and a call with no body is the shortest way to dismiss, so an empty body, or one of spaces, is read as an empty object. The answer route keeps its body required, since an answer needs its answers.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

Read an empty body as an empty object on the dismissal only, and proved no body, an empty body, a blank body and an empty object all dismiss, while a body that is not JSON, one with a field it does not know and one over 4 KiB are refused with 422.

## What it costs to change later

Changing it later means one flag in the controller; no stored row depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the apps that call the API send a body on every POST and would never notice.

```

<!-- /omni-outbox-settled: s6-04-dismiss-needs-no-body -->

<!-- omni-outbox-settled: s2-03-stopped-mega-bug-fix-relaunch -->

## s2-03-stopped-mega-bug-fix-relaunch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-stopped-mega-bug-fix-relaunch
prd: 2425
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

A mega bug fix that stopped on the line that resumes it now reads Stopped mid-way, with Resume, since the fix that lets a stopped mega bug fix resume on its branches. Should a key be able to relaunch it through the API, as the page offers, or should the bug fix's own word win, so that the relaunch refuses it?

## The decision, in plain words

The stopped reading wins: such a job reports the outcome stopped, the page offers Resume, and the key's relaunch follows the page and resumes it. The job still reports who fixed it and every pull request it opened.

## The intro, for fun

Two fixes met in one file, and each had a word for how the job ended.

## The punchline, for fun

Stopped mid-way beats stuck: the page and the key both offer to carry on.

## The options, in plain words

A. A. The stopped reading wins: the job reports stopped, the page offers Resume, and a key's relaunch resumes it.
B. B. The bug fix's own word wins: the job reads ended, the page offers nothing, and a key's relaunch answers that it cannot.

## What I had to decide

Merging main into the feature branch brought the fix that lets a stopped mega bug fix resume on its branches (#2449): a mega bug fix whose hand-off ends on its resume line reports the outcome `stopped`, and the page offers Resume. This PRD's s2 made the runner report a bug fix's own word (`fixed`, `stuck`, `blocked`…), `fixedBy` and every `PR:` line. The merge keeps both: the ending report carries the bug-fix fields and the outcome, and `stopped` overrides the bug fix's word for that case. With the spec's relaunch rule (does what the page offers for that job), s7 will let a key resume such a job; an app that calls the API may have read a finished bug fix as ended, where a relaunch answers 409.

## What I did meanwhile

Resolved the merge as the union of both sides in the runner and its log tests, kept the mega bug fix's resume tests from main green beside s2's, and carried on with wave 4.

## What it costs to change later

Changing it later is one rule in the runner's ending report (which word wins) and one line in the relaunch's rule; no stored shape changes, and jobs already ended keep the outcome they reported.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an app that already calls the API relaunches a bug fix through this route: one that queues a new bug fix instead, and never calls relaunch, sees no change from A.
- (author) Whether a person reading a key's thread expects Resume on a bug fix that said it was stuck.

```

<!-- /omni-outbox-settled: s2-03-stopped-mega-bug-fix-relaunch -->
