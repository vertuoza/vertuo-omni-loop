# Settled outbox items — PRD 2375

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-stopped-follow-exits-1 -->

## s2-01-stopped-follow-exits-1 — adopted

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
id: s2-01-stopped-follow-exits-1
prd: 2375
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When the terminal follow ends on a job that stopped mid-way, should it report success or failure to the shell?

## The decision, in plain words

The follow exits with code 1 for a stopped job, as it does for failed and cancelled ones, since the person decided a stopped job is not done. A done job with any other ending still exits 0.

## The intro, for fun

A job that quit halfway still needs to tell the shell something.

## The punchline, for fun

We picked the answer that does not pretend it finished.

## The options, in plain words

A. A. Exit 1 for a stopped job, as built.
B. B. Exit 0 for a stopped job, like every other done job.

## What I had to decide

Keep exit 1 for a stopped job, or change the stopped case in the follow's exit code back to 0 so a script treats it like Held.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

The follow exits 1 on a stopped job and prints the line to send again.

## What it costs to change later

A script that waits on the follow and expects 0 for every done job now sees 1 for a stopped one; flipping it is one condition.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the words and the count but not the exit code (author)

```

<!-- /omni-outbox-settled: s2-01-stopped-follow-exits-1 -->

<!-- omni-outbox-settled: s3-01-resume-primary-over-send-again -->

## s3-01-resume-primary-over-send-again — adopted

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
id: s3-01-resume-primary-over-send-again
prd: 2375
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When the Runners page lists both a job stopped mid-way and a failed job, which of their buttons is the page's one primary?

## The decision, in plain words

Resume is the primary: the page marks it first, ahead of the first Send again, because a stopped job left work half built.

## The intro, for fun

Two buttons walk into a page, and only one gets to be loud.

## The punchline, for fun

The one that rescues half-built work wins the spotlight.

## The options, in plain words

A. A. Resume is primary, ahead of Send again (built)
B. B. The first of either, in board order, is primary

## What I had to decide

The spec says Resume is the page's primary when present but not how it ranks against Send again. Built as Resume first; a different answer is a one-line change to the primary choice in the jobs table.

## What I did meanwhile

Resume is primary whenever a stopped job is listed; Send again is primary only when none is.

## What it costs to change later

Changing it later is one line in the jobs table's primary choice and its render test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not rank Resume against Send again when both are listed (author)

```

<!-- /omni-outbox-settled: s3-01-resume-primary-over-send-again -->
