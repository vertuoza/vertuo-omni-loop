# Settled outbox items — PRD 714

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-no-base-counts-nowhere -->

## s1-01-no-base-counts-nowhere — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-no-base-counts-nowhere
prd: 714
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When the board has no record of which branch a pull request went into, should it count it as real work?

## The decision, in plain words

It does not count it on the board's totals, and it counts it as a loop sub-PR only when Omni-man signed it. Every stored pull request has its branch today, so nothing moves in practice.

## The intro, for fun

A pull request with no address walks into the board and asks where it belongs.

## The punchline, for fun

The board shows it to the side door, politely, until it finds its address.

## The options, in plain words

A. The board leaves a pull request with no recorded branch out of every count (what was built).
B. The board counts a pull request with no recorded branch as a merge into main, as it did before.

## What I had to decide

Whether a pull request with no recorded target branch should count on the Engineering board.

## What I did meanwhile

Such a pull request counts in no tile, table, chart or list; a signed one counts on the sub-PR line.

## What it costs to change later

One line in apps/galaxy/src/engineering/tally.ts (isMain) to change; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often GitHub leaves a pull request's base empty was not measured (author).

```

<!-- /omni-outbox-settled: s1-01-no-base-counts-nowhere -->

<!-- omni-outbox-settled: s3-01-first-hundred-comments -->

## s3-01-first-hundred-comments — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-first-hundred-comments
prd: 714
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When the board looks for the loop's status note on a pull request, how far down the conversation should it look?

## The decision, in plain words

It looks at the first hundred comments only. The loop writes its status note when it starts on a pull request, so it sits near the top.

## The intro, for fun

The board goes looking for one sticky note in a very long conversation.

## The punchline, for fun

It reads the first hundred and trusts the note was stuck on early.

## The options, in plain words

A. A. Read the first hundred comments and take the first status note (what was built).
B. B. Read the last hundred comments instead, which misses a note posted early on a very long conversation.
C. C. Page through every comment, which costs more of the shared GitHub budget on long conversations.

## What I had to decide

How many comments of a pull request the collector reads to find the loop's status comment, and from which end.

## What I did meanwhile

The collector reads the first 100 comments of each open signed pull request into a main branch and takes the first one carrying the status marker.

## What it costs to change later

One constant (COMMENTS_READ) and first/last in apps/omni-app/src/pr-stats/github.mjs; a changed pull request picks the new reading up at its next update.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many comments a feature pull request collects before its status comment is posted was not measured.

```

<!-- /omni-outbox-settled: s3-01-first-hundred-comments -->
