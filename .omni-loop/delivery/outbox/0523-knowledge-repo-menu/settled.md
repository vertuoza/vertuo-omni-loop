# Settled outbox items — PRD 523

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-failed-read-kept-a-minute -->

## s3-01-failed-read-kept-a-minute — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-failed-read-kept-a-minute
prd: 523
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When GitHub fails to hand over a picked repository's knowledge, should the page try again on the very next reload, or wait up to a minute before asking GitHub again?

## The decision, in plain words

It waits: a failed read is remembered for one minute, like a good one, so for that minute the page keeps saying the knowledge is out of reach and GitHub is asked about that repository at most once a minute.

## The intro, for fun

GitHub hiccups, you reload at once, and the page still shrugs.

## The punchline, for fun

Give it a minute: the map remembers the bad news as long as the good.

## The options, in plain words

A. Keep a failed read one minute, like a graph, so GitHub is asked at most once a minute per repository (built).
B. Keep only a graph that was read, and ask GitHub again on every request after a failure.

## What I had to decide

Whether a failed read of a picked repository is kept for the minute a graph is kept, or retried on every request.

## What I did meanwhile

A failed read is kept one minute per repository, exactly as a graph is, and logged once; the notice says to reload in a moment.

## What it costs to change later

One line in the knowledge reader: keep only a graph that was read, and let a failure be retried on the next request.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec keeps a graph one minute per repository and budgets one call per picked repository a minute; it does not say whether a failure counts as an answer to keep.

```

<!-- /omni-outbox-settled: s3-01-failed-read-kept-a-minute -->
