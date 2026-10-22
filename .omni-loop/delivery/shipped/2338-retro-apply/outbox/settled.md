# Settled outbox items — PRD 2338

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-retro-job-prd-number -->

## s2-01-retro-job-prd-number — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s2
- Wave: 1
- Stays here: An interim display choice that awaits wiring of the PRD source; no lasting guarantee or architecture is settled, so it stays in the ledger.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-retro-job-prd-number
prd: 2338
slice: s2
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

Where should the Runners page read which PRD a retro job is for? The job's line names only the retro pull request, and nothing the page reads links a retro pull request to its PRD.

## The decision, in plain words

The page shows the words 'retro of PRD' and its number when it is given the PRD of that retro pull request, and the retro pull request number, linked to it, when it is not. For now the live page is not given any, so it shows the pull request.

## The intro, for fun

A retro job knows the pull request it was sent for, but not whose story it retells.

## The punchline, for fun

Until someone tells the page, it names the pull request and keeps the PRD to itself.

## The options, in plain words

A. Show the retro pull request, and the PRD once the page is given it (built)
B. Store the PRD number on the job in a new column, written by the retro app's queue step
C. Read the retro pull request from GitHub on every page load

## What I had to decide

Pick where the PRD number of a retro pull request comes from: the retro app's queue step (slice s4) could store it, or the page could read it from the retro pull request.

## What I did meanwhile

The Runners page shows the retro pull request number, linked, under Omni app. Giving the page the map later changes one read and no stored shape.

## What it costs to change later

A person reading the page sees a pull request number instead of the PRD number until the PRD is wired in.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The migration holds only the sender, as the spec's slice says, so no PRD number is stored on the job (author)

```

<!-- /omni-outbox-settled: s2-01-retro-job-prd-number -->

<!-- omni-outbox-settled: s3-01-help-count-test-follows-new-command -->

## s3-01-help-count-test-follows-new-command — adopted

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
- Stays here: A one-off local fix to keep a test green; there is no lasting product behaviour or design decision to record in the knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-help-count-test-follows-new-command
prd: 2338
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Adding the retro command made a test that counts the kit's commands fail, and that test sits outside this slice's list of files: is bumping its count by one the right way to keep it green?

## The decision, in plain words

The count in the help test went from 62 to 63 commands, nothing else in that file changed.

## The intro, for fun

A new command walked in and the headcount noticed.

## The punchline, for fun

The counter now says 63 and has no further comment.

## The options, in plain words

A. A. Bump the count in the help test, which is the smallest change that keeps it green.
B. B. Leave the help test alone and let the wave change it once, after merging all slices.

## What I had to decide

Keep the one-number change in kit/lib/help/entries.test.ts (A), or leave the test red and let another slice change it (B).

Decided by: Jev (hardToRevert 0.80) · agent said false

## What I did meanwhile

The count is bumped on this slice's branch, so its preflight is green.

## What it costs to change later

Reverting is changing three numbers back in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice lists the help entries file but not its test, and the spec does not say who owns the count.

```

<!-- /omni-outbox-settled: s3-01-help-count-test-follows-new-command -->

<!-- omni-outbox-settled: s4-01-retro-queue-wired-outside-territory -->

## s4-01-retro-queue-wired-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 2
- Stays here: A one-off territory call for this slice's wiring line; nothing lasting about the product's behaviour to record in the knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-retro-queue-wired-outside-territory
prd: 2338
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

To make the live app queue the settling job, one line had to change in the file that wires every background task of the GitHub app, which the plan did not give this slice. Is it fine that this slice changed it?

## The decision, in plain words

The slice added the one line that hands the database to the retro, so the live app queues the job; without it, only the pull request text would carry the line.

## The intro, for fun

The queue was built, but nobody had plugged it in.

## The punchline, for fun

One line of wiring later, the lamp turns on.

## The options, in plain words

A. Keep the one wiring line, so the live app queues the job (built)
B. Drop it here and add it in a change that owns the wiring file

## What I had to decide

Keep the one wiring line in the app's list of background tasks (A), or move it to a follow-up change that owns that file (B).

## What I did meanwhile

The wiring line is in place: with the database set, the retro queues the job; without it, the retro still writes the line in its pull request.

## What it costs to change later

B is the removal of one line, and the app then queues nothing until a later change adds it back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice names only the retro folder and the app's test folder, not the file that wires the app's tasks. (author)

```

<!-- /omni-outbox-settled: s4-01-retro-queue-wired-outside-territory -->

<!-- omni-outbox-settled: s4-02-one-job-per-retro-pull-request -->

## s4-02-one-job-per-retro-pull-request — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 2
- Became: ADR-0118

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-one-job-per-retro-pull-request
prd: 2338
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The retro asks a runner to settle a retro pull request's lessons at most once for that pull request, even when the check two weeks after the merge adds new lessons to the same pull request after the first job has finished. Should it ask again in that case?

## The decision, in plain words

The retro looks for any job already sent for that pull request, whatever its state, and sends none if it finds one. New lessons added two weeks later to the same open pull request are then settled by a person running the line the pull request shows.

## The intro, for fun

Two weeks later, the retro remembers one more thing to say.

## The punchline, for fun

It does not ring the runner twice; the note is on the door.

## The options, in plain words

A. One job per retro pull request, whatever its state (built)
B. Ask again once the earlier job ended and a kept lesson still has no outcome

## What I had to decide

Keep one job per retro pull request ever (A), or ask again when the earlier job has ended and a kept lesson still has no outcome (B).

## What I did meanwhile

One job per retro pull request: a replay never sends a second one, and the pull request text keeps the line while a lesson waits.

## What it costs to change later

B changes the lookup to ignore ended jobs: a few words in one query, and no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for exactly one job and no second one on a replay, but says nothing of new lessons the day-14 run adds to a retro pull request whose job already ran. (author)
- Asking again after a job that posted a question would repeat that question to the same person. (author)

```

<!-- /omni-outbox-settled: s4-02-one-job-per-retro-pull-request -->

<!-- omni-outbox-settled: s4-03-retro-body-rewrite-keeps-outcomes-not-quotes -->

## s4-03-retro-body-rewrite-keeps-outcomes-not-quotes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 2
- Became: ADR-0119

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-retro-body-rewrite-keeps-outcomes-not-quotes
prd: 2338
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When the retro writes its pull request again, on a replay or two weeks after the merge, its new text keeps each lesson's outcome but not the exact rule words the settling skill quoted. Is that enough for the reviewer?

## The decision, in plain words

The rewritten text shows, under each finding, where the lesson went or why it stays, and closes the issue of each settled lesson. The rule's own words stay in the change itself, where the reviewer reads them, but not in the text.

## The intro, for fun

The retro came back two weeks later and tidied the notes.

## The punchline, for fun

It kept every verdict, just not the quotes.

## The options, in plain words

A. Rewrite the text, keeping each outcome and closing each settled lesson's issue (built)
B. Leave the text alone once the settling skill has written it

## What I had to decide

Keep the rewrite as built (A), or leave the pull request's text alone once the settling skill has written it (B).

## What I did meanwhile

The rewrite shows each outcome and closes each settled lesson's issue; the quoted rule is in the diff.

## What it costs to change later

B is a check in the publish step before it rewrites the text: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The settling skill, built in a later slice, writes the quoted rules into the pull request's text, and the spec does not say what a later rewrite by the retro keeps of them. (author)

```

<!-- /omni-outbox-settled: s4-03-retro-body-rewrite-keeps-outcomes-not-quotes -->

<!-- omni-outbox-settled: s5-01-runner-skill-list-meets-shipped-migration -->

## s5-01-runner-skill-list-meets-shipped-migration — adopted

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
- Stays here: A local choice not to write a follow-up migration; no lasting product guarantee changes, since other checks already refuse the name.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-runner-skill-list-meets-shipped-migration
prd: 2338
slice: s5
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The database's own copy of the list of skills a runner runs, written in a migration that already shipped, does not name the new retro skill: should a follow-up migration add it?

## The decision, in plain words

The new skill is on every list but the database's older copy, which only decides which names a repository's owner may not reuse for a skill of their own. Its test now expects the older list.

## The intro, for fun

The skill list grew a name; one old copy never got the memo.

## The punchline, for fun

A later migration can hand it the memo, and nothing runs in the meantime.

## The options, in plain words

A. A. Leave the shipped migration alone and let its test expect the list without retro-apply, with a comment saying why.
B. B. Add a follow-up migration, in a slice of its own, that adds retro-apply to the database's list, and restore the test's full expectation.

## What I had to decide

Keep A, or add the follow-up migration that redefines set_repository_runner_skill with retro-apply in its list (B).

## What I did meanwhile

Everything else names retro-apply; the line check of the kit and the app already refuse a repository skill of that name when a job runs.

## What it costs to change later

B is one new migration copying the function with one more name, plus the test's expectation going back to the full list; A is undone by deleting the filter in the test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD names no migration for the skill list, and the slice's territory holds no supabase path, so a migration would leave it. (author)

```

<!-- /omni-outbox-settled: s5-01-runner-skill-list-meets-shipped-migration -->

<!-- omni-outbox-settled: s1-01-config-rule-test-gains-retro-checks -->

## s1-01-config-rule-test-gains-retro-checks — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-22T06:07:56Z
- Channel: feature pull request #2339
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2339#issuecomment-6334021975
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-23
- Raised: 2026-10-21
- Slice: s1
- Wave: 1
- Stays here: a one-off placement of two test cases for retro.guards beside the config rule's checks; it states no lasting rule (the testing form already says where tests of other behaviour go).

### The answer, as it was given

```text
A. A. Keep the new checks beside the rule's checks in the same file, the rule's own checks untouched.
```

### The item, as it was raised

```text
---
id: s1-01-config-rule-test-gains-retro-checks
prd: 2338
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The test file that proves the config's signature rule was touched to add the new retro setting: can a person confirm the rule it proves still holds as it did?

## The decision, in plain words

The rule's own checks are unchanged. The file gains the new setting's checks beside them, and its list of the config's sections now names the new section.

## The intro, for fun

A guard of the config's rules got a visitor.

## The punchline, for fun

Nobody moved the guard; the visitor just signed the book.

## The options, in plain words

A. A. Keep the new checks beside the rule's checks in the same file, the rule's own checks untouched.
B. B. Move the new setting's checks to a test file of their own, leaving only the one-word section list change in the rule's file.

## What I had to decide

Keep A, or move the new setting's checks to a test file of their own (B).

Decided by: Jev (hardToRevert 0.70) · agent said true

## What I did meanwhile

The new checks sit beside the rule's checks; nothing waits on the answer.

## What it costs to change later

B is a move of two test cases to a new file, with no change to the code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The testing form asks that tests of other behaviour go in a file of their own, but the slice's territory names only this test file for the config; a new file would leave the territory. (author)

```

<!-- /omni-outbox-settled: s1-01-config-rule-test-gains-retro-checks -->
