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
