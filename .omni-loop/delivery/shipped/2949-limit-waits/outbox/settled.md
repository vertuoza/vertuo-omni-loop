# Settled outbox items — PRD 2949

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-lost-resume-keeps-waits -->

## s1-02-lost-resume-keeps-waits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-157, P-PRODUCT-125

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-lost-resume-keeps-waits
prd: 2949
slice: s1
rank: medium
bears-on: none
raised: 2026-11-16
wave: 1
---

## The question, in plain words

When a job that already waited out a provider limit is then lost by its machine, should the retry remember how many times the job already waited?

## The decision, in plain words

The retry remembers the waits: a lost machine still spends one of the three tries, and the waits count carries on, so a job never waits more than six times in all, however it was interrupted.

## The intro, for fun

A job that napped twice and then lost its machine wakes up with a question.

## The punchline, for fun

Counting naps across machines keeps the night from lasting forever.

## The options, in plain words

A. A. Keep the waits count across a loss: six waits at most for the whole chain
B. B. Start the count again after each loss: up to six waits per try

## What I had to decide

Keep the count across a loss, or start it again at zero after each loss.

## What I did meanwhile

A loss's retry copies the waits count of the job it replaces.

## What it costs to change later

A constant in one database function: a follow-up migration changes it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a lost runner spends a try as before, and says nothing of the waits count across a loss (author)

```

<!-- /omni-outbox-settled: s1-02-lost-resume-keeps-waits -->

<!-- omni-outbox-settled: s2-02-limit-resume-claim-attempt-left -->

## s2-02-limit-resume-claim-attempt-left — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s2
- Wave: 2
- Stays here: A deferred, local wording choice with a known small inaccuracy; no lasting guarantee to keep, and it may change when a resume reason field is added.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-limit-resume-claim-attempt-left
prd: 2949
slice: s2
rank: medium
bears-on: none
raised: 2026-11-16
wave: 2
---

## The question, in plain words

When a job waits out a provider limit, the server hands the runner its resume as a try 2 or 3, which the runner reads as a recovery after a lost runner. Should the runner say something different for a limit?

## The decision, in plain words

We left the runner's reading of a resume as it is: it accepts tries 2 and 3, and its note says the earlier job was lost. A limit's resume therefore reads as try 2 of 3 and its note says the runner lost the job.

## The intro, for fun

The runner still thinks it was a power cut.

## The punchline, for fun

It was only the meter running out.

## The options, in plain words

A. Leave the runner as it is for now: the note's wording is slightly off for a limit, nothing breaks
B. Have the server tell the runner why the job resumes, and the runner word its note and its try count for a limit

## What I had to decide

Whether the runner needs to know a resume is for a limit: its note (kit/lib/runner/resume.ts) says 'which its runner lost' and counts the try shown as 2 of 3, and a runner lost during the resumed job reads attempt 2 as one try already spent.

## What I did meanwhile

Nothing changed in the runner's resume code; the limit report and the wait it triggers work without it.

## What it costs to change later

Medium: it needs a field on the resume claim (server, contract, runner) and its note's wording.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The server's resume claim clamps the try to at least 2 (resumeClaimOf), so the runner cannot tell a limit's resume from a lost runner's without a new field.

```

<!-- /omni-outbox-settled: s2-02-limit-resume-claim-attempt-left -->

<!-- omni-outbox-settled: s3-02-claim-all-out-edges -->

## s3-02-claim-all-out-edges — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s3
- Wave: 2
- Became: BR-PRODUCT-158, P-PRODUCT-126

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-claim-all-out-edges
prd: 2949
slice: s3
rank: medium
bears-on: none
raised: 2026-11-16
wave: 2
---

## The question, in plain words

Which machines count as having every account out, so the queue hands them nothing? The spec names a fresh report with every account out until a time still to come, but not the odd reports.

## The decision, in plain words

A machine is skipped only when its report is under two minutes old, lists at least one account, and every account is out until a time still to come. A report with no account listed, an account out with no reset time, or a reset time that does not read as a time leaves the machine judged by its own pause, as before, so it still gets work.

## The intro, for fun

A machine says every account is out, then mumbles about when they come back.

## The punchline, for fun

When in doubt, the machine keeps its job and decides for itself.

## The options, in plain words

A. A. Skip a machine only on a clear, fresh report of every account out until a time to come
B. B. Also skip it when an account is out with no reset time
C. C. Also skip it when its report lists no account at all

## What I had to decide

Confirm that only a clear, fresh report of every account out until a time to come holds work back from a machine, or name another odd report that should hold it back too.

## What I did meanwhile

The claim skips only the clear case; supabase/checks/runner_resume.sql proves each odd report still gets a job and raises no error.

## What it costs to change later

Low: one condition in the claim and a line of the check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether an account out with no reset time should hold work back too (author)

```

<!-- /omni-outbox-settled: s3-02-claim-all-out-edges -->

<!-- omni-outbox-settled: s3-03-claim-order-outside-territory -->

## s3-03-claim-order-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s3
- Wave: 2
- Stays here: A local scoping choice to leave two helpers outside the slice as they are; nothing lasting to record, and low cost to change later.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-claim-order-outside-territory
prd: 2949
slice: s3
rank: medium
bears-on: none
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The database now hands out recovered jobs first and follows a job's whole history, but two helpers outside this slice still work the old way: the in-memory stand-in the tests use still hands out jobs oldest first, and the server reads only the two latest earlier tries when it tells a machine what to restore. Should a follow-up bring them in line?

## The decision, in plain words

We left both as they are, since they sit outside this slice. The server already hands over the limited job and its saved work, which is the newest, so nothing is lost today; only the older tries of a long history are left out of what the machine is told.

## The intro, for fun

The database learned a new queue order; its stand-in did not get the memo.

## The punchline, for fun

Two copies of one rule, one of them a little behind.

## The options, in plain words

A. A. Leave both as they are: the newest save already reaches the machine
B. B. A follow-up brings the test stand-in's order in line with the database
C. C. A follow-up does B, and makes the server follow the whole history too

## What I had to decide

Pick whether a follow-up makes the test stand-in (apps/galaxy/src/runners/fixtures/store.fake.ts) hand out resumes first and the server's chain reading (CHAIN_MAX in apps/galaxy/src/runners/runners.service.ts) follow the whole history.
Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

Both are unchanged; a test in runners.resume-claim.test.ts proves a limit's resume four jobs on still carries the limited job and its save.

## What it costs to change later

Low: a small change to each, with its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the older tries' saves are worth telling the machine about once a newer save exists (author)

```

<!-- /omni-outbox-settled: s3-03-claim-order-outside-territory -->

<!-- omni-outbox-settled: s5-01-room-says-waits-from-existing-reads -->

## s5-01-room-says-waits-from-existing-reads — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-16
- Slice: s5
- Wave: 3
- Became: ADR-0164

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-room-says-waits-from-existing-reads
prd: 2949
slice: s5
rank: medium
bears-on: none
raised: 2026-11-16
wave: 3
---

## The question, in plain words

Where does the room get the wait it says, since the screen reads no runner state of its own?

## The decision, in plain words

The room and the Missions tab read the mission's queued jobs, the job a resume follows (its limit time and account) and the supervisor's own words about what the mission waits on. A limit is read from the jobs; "all runners are busy" is read from the supervisor's words, because the room has no runner state to judge it from.

## The intro, for fun

The room learned to say why nobody is moving.

## The punchline, for fun

It asks the supervisor and does not guess.

## The options, in plain words

A. Read the supervisor's words for the room wait (done)
B. Have the room read the runners and their slots and judge room itself
C. Have the supervisor store the wait as its own field the room reads

## What I had to decide

How the room learns that a PRD waits for room, and which job it links. The line links the job that ran out for a limit, and the queued job for room.

## What I did meanwhile

Built A. The words are cut at 300 characters by the supervisor, so a very long list of waiting PRDs could drop a room wait from the line; the supervisor's own words still say it.

## What it costs to change later

Low: C replaces one parsing function (`waitsOf` in `limit-wait.ts`) and the read.

## What I could not know

(author) Whether a stored wait field is wanted to avoid reading the words.

The `fleet-room` screen's two waiting states match what is built. The screen is a draft and its mockup was not redrawn.

```

<!-- /omni-outbox-settled: s5-01-room-says-waits-from-existing-reads -->

<!-- omni-outbox-settled: s1-01-limit-wait-extends-cancel-proof -->

## s1-01-limit-wait-extends-cancel-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T20:26:33Z
- Channel: feature pull request #2950
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2950#issuecomment-6928316627
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-134
- Raised: 2026-11-16
- Slice: s1
- Wave: 1
- Stays here: agrees the extended proof still proves the same rule; the rule did not change

### The answer, as it was given

```text
A. A. Keep the limit cases in the same proof files: they prove the same rule for one more ending
```

### The item, as it was raised

```text
---
id: s1-01-limit-wait-extends-cancel-proof
prd: 2949
slice: s1
rank: high
bears-on: BR-PRODUCT-134
raised: 2026-11-16
wave: 1
---

## The question, in plain words

The check that proves a cancelled job is never picked up again now also covers jobs that wait out a provider limit. Does that wider check still prove the same rule?

## The decision, in plain words

We added the waiting jobs to the same check: a job whose cancel was asked before it hit the limit queues nothing, and a waiting copy that someone cancels is never picked up by any machine. The earlier cases are kept as they were.

## The intro, for fun

A rule's proof grew a new chapter while nobody was watching.

## The punchline, for fun

Same promise, longer receipt: a cancel still means stop.

## The options, in plain words

A. A. Keep the limit cases in the same proof files: they prove the same rule for one more ending
B. B. Move the limit cases into a check of their own, leaving the rule's proof as it was
C. C. Keep them, and amend the rule's words to name a limit's wait

## What I had to decide

Confirm that supabase/checks/runner_resume.sql and apps/galaxy/src/runners/runners.resume.migration.test.ts still prove BR-PRODUCT-134 once they also cover a limit's wait (PRD 2949 s1), or say which case the rule should name.

## What I did meanwhile

The extended check runs in the supabase workflow; the rule's text is unchanged.

## What it costs to change later

Low: answering B only moves the limit cases into a check of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether BR-PRODUCT-134 should say in words that it covers a limit's wait too, not only a lost runner (author)

```

<!-- /omni-outbox-settled: s1-01-limit-wait-extends-cancel-proof -->

<!-- omni-outbox-settled: s1-03-limit-report-extends-access-proof -->

## s1-03-limit-report-extends-access-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T20:26:33Z
- Channel: feature pull request #2950
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2950#issuecomment-6928316627
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-ACCESS-7
- Raised: 2026-11-16
- Slice: s1
- Wave: 1
- Stays here: agrees the extended proof still proves the same rule; the rule did not change

### The answer, as it was given

```text
A. A. Keep the limit tests in the same file, as their own group: the rule's proof is untouched
```

### The item, as it was raised

```text
---
id: s1-03-limit-report-extends-access-proof
prd: 2949
slice: s1
rank: high
bears-on: BR-ACCESS-7
raised: 2026-11-16
wave: 1
---

## The question, in plain words

The test file that proves how a machine's request for a fresh access pass is refused now also holds the tests for how a job reports a provider limit. Does that file still prove the same rule?

## The decision, in plain words

We added the limit tests beside the others in the same file, as their own group; none of the refusal tests changed.

## The intro, for fun

A test file that guards the door also learned to read the clock.

## The punchline, for fun

The door rule did not move, it just got a neighbour.

## The options, in plain words

A. A. Keep the limit tests in the same file, as their own group: the rule's proof is untouched
B. B. Move the limit tests to a file of their own

## What I had to decide

Confirm that apps/galaxy/src/runners/runners.service.test.ts still proves BR-ACCESS-7 with its new group 'a job that meets a provider limit (PRD 2949)', or ask for the group to move to a file of its own.

## What I did meanwhile

The new group runs with the file's other tests; nothing in the refusal tests changed.

## What it costs to change later

Low: answering B moves one test group to a new file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether BR-ACCESS-7 should list the limit group among what proves it, or the file should be split (author)

```

<!-- /omni-outbox-settled: s1-03-limit-report-extends-access-proof -->

<!-- omni-outbox-settled: s2-01-limit-report-extends-runner-proof -->

## s2-01-limit-report-extends-runner-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T20:26:33Z
- Channel: feature pull request #2950
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2950#issuecomment-6928316627
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-19
- Raised: 2026-11-16
- Slice: s2
- Wave: 2
- Stays here: agrees the extended proof still proves the same rule; the rule did not change

### The answer, as it was given

```text
A. Keep the limit tests in the same files, as their own cases: the rule's proof is untouched
```

### The item, as it was raised

```text
---
id: s2-01-limit-report-extends-runner-proof
prd: 2949
slice: s2
rank: high
bears-on: N-PRODUCT-19
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The test files that prove how a runner ends and reports a job now also hold the tests for how a job that ran out of every provider account reports its limit. Do they still prove the same rule?

## The decision, in plain words

We added the limit tests beside the others, in the same files, as their own cases; no existing test changed except that some failed-report cases now also say a limit is absent where none is due.

## The intro, for fun

A runner that knows when it will be allowed back.

## The punchline, for fun

The old tests still guard the door; the new ones read the clock.

## The options, in plain words

A. Keep the limit tests in the same files, as their own cases: the rule's proof is untouched
B. Move the limit tests to a file of their own

## What I had to decide

Confirm that kit/lib/runner/runner.test.ts and kit/lib/runner/turnover.test.ts still prove their rules with the new limit cases, or ask for the cases to move to a file of their own.

## What I did meanwhile

The new cases run with the files' other tests; the existing cases I touched only gained an assertion.

## What it costs to change later

Low: answering B moves a few test cases to a new file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The PRD, the registers and the glossary do not settle whether these files should list the limit cases among what proves the rule.

```

<!-- /omni-outbox-settled: s2-01-limit-report-extends-runner-proof -->

<!-- omni-outbox-settled: s3-01-claim-extends-keeper-proof -->

## s3-01-claim-extends-keeper-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T20:26:33Z
- Channel: feature pull request #2950
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2950#issuecomment-6928316627
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-135
- Raised: 2026-11-16
- Slice: s3
- Wave: 2
- Stays here: agrees the extended proof still proves the same rule; the rule did not change

### The answer, as it was given

```text
A. A. Keep the new cases in the same proof files: they prove the same rule over longer chains
```

### The item, as it was raised

```text
---
id: s3-01-claim-extends-keeper-proof
prd: 2949
slice: s3
rank: high
bears-on: BR-PRODUCT-135
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The proofs that a resumed job waits for the machine holding its saved work now also cover long chains of waits, and the new order that hands recovery out first. Do the wider proofs still prove the same rule?

## The decision, in plain words

We extended the same proofs: the saved work is now looked for along the whole history of the job, not only its two latest tries, and the queue hands out every resumed job before any new one. The earlier cases are kept as they were.

## The intro, for fun

The rule about waiting for the right machine just learned to count past two.

## The punchline, for fun

Same promise, longer memory: the saved work still goes home first.

## The options, in plain words

A. A. Keep the new cases in the same proof files: they prove the same rule over longer chains
B. B. Move the new cases into a check and a test of their own, leaving the rule's proof as it was
C. C. Keep them, and amend the rule's words to name the whole chain and the recovery-first order

## What I had to decide

Confirm that supabase/checks/runner_resume.sql, apps/galaxy/src/runners/runners.claim-resume.migration.test.ts and apps/galaxy/src/runners/runners.resume-claim.test.ts still prove BR-PRODUCT-135 once they also cover a whole chain of waits and the recovery-first order (PRD 2949 s3), or say what the rule should name.

## What I did meanwhile

The extended check and tests pass; the rule's text is unchanged. Each new case was seen failing against the previous claim before the new one made it pass.

## What it costs to change later

Low: answering B only moves the new cases into a check and a test of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether BR-PRODUCT-135 should say in words that it reads the job's whole history, now that waits make it longer than three tries (author)

```

<!-- /omni-outbox-settled: s3-01-claim-extends-keeper-proof -->

<!-- omni-outbox-settled: s4-01-limit-wait-extends-mission-proof -->

## s4-01-limit-wait-extends-mission-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-16T20:26:33Z
- Channel: feature pull request #2950
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2950#issuecomment-6928316627
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-139
- Raised: 2026-11-16
- Slice: s4
- Wave: 2
- Stays here: agrees the extended proof still proves the same rule; the rule did not change

### The answer, as it was given

```text
A. Keep the limit cases in the same tests: they prove the same rule for one more ending
```

### The item, as it was raised

```text
---
id: s4-01-limit-wait-extends-mission-proof
prd: 2949
slice: s4
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The tests that prove a mission carries on after a lost runner now also cover a PRD that waits out a provider limit. Do the extended tests still prove the same rule?

## The decision, in plain words

We kept the old cases and added new ones beside them: a limited job with a resume reads as waiting and keeps its run and its place, a job no runner can take reads as waiting for room, and the 6th wait's failure stops the PRD with its reason.

## The intro, for fun

The mission learned to sleep through a storm instead of calling it a day.

## The punchline, for fun

Same promise, more weather: the mission keeps going.

## The options, in plain words

A. Keep the limit cases in the same tests: they prove the same rule for one more ending
B. Move the limit cases into tests of their own, leaving the rule's proof as it was
C. Keep them, and amend the rule's words to name a provider limit's wait

## What I had to decide

Confirm that supervisor.test.ts and mission.e2e.test.ts still prove BR-PRODUCT-139 once they also cover a provider limit's wait and a wait for room (PRD 2949 s4), or say which case the rule should name.

## What I did meanwhile

The extended tests run in the workspace test run; the rule's text is unchanged.

## What it costs to change later

Low: answering B only moves the limit cases into tests of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether BR-PRODUCT-139 should say in words that it covers a provider limit's wait too.

```

<!-- /omni-outbox-settled: s4-01-limit-wait-extends-mission-proof -->
