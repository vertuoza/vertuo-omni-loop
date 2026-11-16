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
