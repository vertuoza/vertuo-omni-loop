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
