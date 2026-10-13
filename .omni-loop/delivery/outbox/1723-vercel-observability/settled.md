# Settled outbox items — PRD 1723

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-log-fields-message-repos -->

## s1-01-log-fields-message-repos — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-log-fields-message-repos
prd: 1723
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The spec lists which fields a log line may carry, but two later steps need a free sentence and a count of repositories read, which that list does not name. Should those two fields be allowed?

## The decision, in plain words

The logger also allows a short sentence for a person and a count of repositories read. The sentence is masked for credentials and cut to 500 characters, like an error's message.

## The intro, for fun

Two later steps wanted to say a little more than the list of fields allowed.

## The punchline, for fun

So the list grew by two, and both still wear the same mask.

## The options, in plain words

A. Allow a short sentence, masked and cut like an error message, and a count of repositories read, beside the fields the spec names.
B. Keep the spec list exactly: the old sentences go into the error field, and the cron does not log its count.

## What I had to decide

Keep the two extra fields (A), or drop them and have the later steps fit what they say into the fields the spec named (B).

## What I did meanwhile

Lines carry `message` (masked, cut to 500) and `repos` (a number); the App's old sentences and the stages cron's count use them in wave 2.

## What it costs to change later

Dropping a field later is a one-line change to the allow-list and the two callers; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The name `repos` for the count is mine: the plan says only "how many repositories it read" (author).

```

<!-- /omni-outbox-settled: s1-01-log-fields-message-repos -->

<!-- omni-outbox-settled: s4-01-health-check-red-when-issue-not-written -->

## s4-01-health-check-red-when-issue-not-written — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-health-check-red-when-issue-not-written
prd: 1723
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The hourly health check never fails because an app is down: the issue it opens is the alert. But when it cannot open or update that issue at all, should the run still pass quietly, or turn red?

## The decision, in plain words

It turns red only when it could not write the issue, so the alert is not lost in silence. A down app alone still leaves the run green.

## The intro, for fun

The smoke alarm works fine. It just cannot reach the phone.

## The punchline, for fun

So it beeps in the hallway instead, where someone may hear it.

## The options, in plain words

A. A. Red only when the issue could not be written; green whatever the apps' state (built).
B. B. Green in every case, the failure to write the issue only printed in the run's log.
C. C. Green in every case, with a warning annotation on the run's summary.

## What I had to decide

Keep the run red when the issue could not be written (A), or make it green in every case (B).

## What I did meanwhile

A run that could not open, comment on or close its issue fails; every other run passes, a down app included.

## What it costs to change later

Changing it is one line in the health-check script and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the run exits 0 whatever it found; it does not say what happens when writing the issue fails (author).

```

<!-- /omni-outbox-settled: s4-01-health-check-red-when-issue-not-written -->

<!-- omni-outbox-settled: s5-01-guide-tests-list-the-new-page -->

## s5-01-guide-tests-list-the-new-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-guide-tests-list-the-new-page
prd: 1723
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Adding the observability page to the guide's menu changes the list of pages two existing guide checks expect, and those checks sat outside this piece of work. Should the page go last in the menu, after the troubleshooting page, as built?

## The decision, in plain words

The page goes last in the guide's menu and points back to the start; the two guide checks were extended to expect it there, with no other page's order or links changed.

## The intro, for fun

A new page walked into the guide and the guide's own checks counted the chairs again.

## The punchline, for fun

Nineteen chairs now, and nobody had to change seats.

## The options, in plain words

A. A. The page last in the menu, after troubleshooting, pointing back to the start; the two guide checks extended to expect it (as built).
B. B. The page before troubleshooting, so the troubleshooting page stays last; the use-cases page's next link and the checks' expected links change with it.

## What I had to decide

Answer A to keep the page last, or B to move it beside the troubleshooting page's neighbours.

## What I did meanwhile

The page sits last in the menu; every other page keeps its place and its next link.

## What it costs to change later

Moving it later is one line of the menu file and the matching lines of two checks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory named the menu file but not the two checks that list the menu; extending them was the only way to keep them green, so it was done here rather than left red.

```

<!-- /omni-outbox-settled: s5-01-guide-tests-list-the-new-page -->

<!-- omni-outbox-settled: s6-01-note-lines -->

## s6-01-note-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-note-lines
prd: 1723
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The App's other sentences, like a forward to the arcade that failed, are now structured lines too and needed a name to search them by, apart from each run's own line. Is the name we picked the one you want?

## The decision, in plain words

Those sentences are written as warnings named 'note', with the part of the App that said them beside it and the sentence itself as the message, so a search for a run's line never also finds them.

## The intro, for fun

Every log line needs a name tag, and the small talk got one too.

## The punchline, for fun

Now even the grumbling is searchable.

## The options, in plain words

A. Keep 'note' as the name, with the part of the App that said it beside it (as built).
B. Name each sentence after the part of the App that said it, as the run lines are named after what ran.

## What I had to decide

Answer A to keep the name 'note' with the part of the App beside it, or B to name each sentence after the part of the App that said it.

## What I did meanwhile

Every such sentence is written as a 'note' warning, the part of the App that said it beside it, the sentence as the message.

## What it costs to change later

Renaming it later is a one-word change in one place; only searches someone saved would need the new name.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says these sentences become warnings with the sentence as the message, and names the four run names, but not what these other lines are called.
- The GitHub budget's own sentences, from the shared GitHub client, are written the same way, named after GitHub.

```

<!-- /omni-outbox-settled: s6-01-note-lines -->

<!-- omni-outbox-settled: s6-02-run-duration-and-outcome -->

## s6-02-run-duration-and-outcome — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-run-duration-and-outcome
prd: 1723
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Each call to the App and each background job now writes one line saying how it ended and how long it took, but the spec did not say which answers count as refused or failed, nor what a job of several steps is timed by. Are the readings we picked the ones you want?

## The decision, in plain words

A call the App turns away (a wrong signature, a wrong method, a body it cannot read) is refused; an answer of the server-error kind, like a missing secret or a job that could not be sent on, is failed. A background job's duration is the time of the last step, the one that ended it, not the whole job from start to end, because each step runs separately.

## The intro, for fun

Every run now gets a stopwatch and a verdict at the finish line.

## The punchline, for fun

The stopwatch only sees the last lap, but it never lies about it.

## The options, in plain words

A. Turned-away calls are refused, server-error answers failed, a background job timed by the step that ended it (as built).
B. The same readings, but a background job timed from its first step to its end, carried from step to step.

## What I had to decide

Answer A to keep these readings, or B to time a background job from its very first step to its end.

## What I did meanwhile

Turned-away calls are written refused, server-error answers failed, and a background job's duration is that of the step that ended it.

## What it costs to change later

Changing what refused and failed mean is one small rule in one place. Timing a whole job would need its start time carried through every step, a bigger but still contained change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for each run's duration in milliseconds, but a background job made of several steps runs as separate calls, so a single clock cannot see it whole.
- A job that fails and is retried writes one failed line per try, each try being a run of its own.

```

<!-- /omni-outbox-settled: s6-02-run-duration-and-outcome -->

<!-- omni-outbox-settled: s7-01-stages-sync-line-counts -->

## s7-01-stages-sync-line-counts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s7
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-stages-sync-line-counts
prd: 1723
slice: s7
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When the quarter-hour sync writes its one summary line, which repositories count as read, and how is a run that cannot even list the workspaces marked?

## The decision, in plain words

Only the repositories the sync read and recorded count; the ones it skipped do not. A run that cannot list the workspaces, and so answers with a server error, is marked failed, like a run that crashes.

## The intro, for fun

Counting sheep is easy until one of them refuses to be read.

## The punchline, for fun

We counted the ones that answered and called the silent night a failure.

## The options, in plain words

A. Count the repositories read and recorded; a server error without a crash is failed (built).
B. Count every repository the sync tried, skipped ones included.
C. Keep the count, but mark a server error without a crash as refused instead of failed.

## What I had to decide

Keep A unless the team wants the summary to count every repository the sync tried, or wants a server error without a crash marked differently.

## What I did meanwhile

The summary line counts the repositories that landed and marks a server error as failed.

## What it costs to change later

Changing either is a one-line edit in the sync and its test; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the line carries how many repositories the run read, without saying whether a skipped one counts (author)
- The spec names a thrown run as failed, not a server error answered without a crash (author)

```

<!-- /omni-outbox-settled: s7-01-stages-sync-line-counts -->
