# Settled outbox items — PRD 3233

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-queue-reason-words -->

## s2-01-queue-reason-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-24
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-24
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-queue-reason-words
prd: 3233
slice: s2
rank: medium
bears-on: none
raised: 2026-11-24
wave: 2
---

## The question, in plain words

When a fleet's queued job waits because several of its runners are offline, or because one runner is paused, what should the Runners tab say?

## The decision, in plain words

It says "Every runner offline" when all the runners that could take the job are offline, and "<runner> is paused" when the one runner that could take it is paused.

## The intro, for fun

A job is waiting and every runner is out for lunch.

## The punchline, for fun

Three words tell you why; the menu stays the same.

## The options, in plain words

A. A. Every runner offline / <runner> is paused (built)
B. B. Waits for <runner 1>, <runner 2> / Waits for <runner>: paused
C. C. Reuse the Runners page's longer Waiting: lines

## What I had to decide

Pick the words, or keep these.

## What I did meanwhile

The tab shows these words; they are one string each, changed in a minute.

## What it costs to change later

A wording change only: one constant and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the one-runner offline and both-paused cases, not these two (author)

```

<!-- /omni-outbox-settled: s2-01-queue-reason-words -->
