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
