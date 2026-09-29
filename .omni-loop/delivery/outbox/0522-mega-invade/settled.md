# Settled outbox items — PRD 522

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-uncomparable-read-point-is-stale -->

## s1-01-uncomparable-read-point-is-stale — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-uncomparable-read-point-is-stale
prd: 522
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When the point a copied knowledge base was read at no longer exists in the other repository, for example after its history was rewritten, what should the targets list say?

## The decision, in plain words

It says the copy is stale and explains that the read point cannot be compared, so a person refreshes the copy with the sync run.

## The intro, for fun

A bookmark in a book that has since been reprinted.

## The punchline, for fun

When the page is gone, we call the copy stale and read it again.

## The options, in plain words

A. Stale, with a detail saying the read point cannot be compared: The sync run is the fix, and stale is what sends a person there.
B. Drifted: Treats it as the config no longer matching the repository.
C. Unreachable: Treats any failed reading as the repository being unreadable.

## What I had to decide

Whether a copy whose read point GitHub cannot find is reported as stale, drifted or unreachable.

## What I did meanwhile

It reads stale, with the detail 'readAt <short commit> cannot be compared with the default branch', and the command exits 1.

## What it costs to change later

One constant in the targets reader and one test; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names stale only for a moved head that changed an evidence file; this case is not in it (author).

```

<!-- /omni-outbox-settled: s1-01-uncomparable-read-point-is-stale -->

<!-- omni-outbox-settled: s1-02-failed-reading-is-unreachable -->

## s1-02-failed-reading-is-unreachable — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-failed-reading-is-unreachable
prd: 522
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When GitHub answers for a repository at first but then fails partway through reading it, for example because of a rate limit, what should the targets list say?

## The decision, in plain words

The whole row reads unreachable, with the error GitHub gave, and it stays in the list. A missing file is never a failure: it only means the file is not there.

## The intro, for fun

The librarian let us in, then turned the lights off halfway down the aisle.

## The punchline, for fun

We do not guess what was on the dark shelves: the row says unreachable.

## The options, in plain words

A. Unreachable, with the error line: the row is kept and nothing is guessed.
B. Keep what was read and mark the rest unknown: a new word the next PRDs would have to learn.
C. Stop the whole command with an error: one bad repository hides every other row.

## What I had to decide

Whether a reading that fails after the repository itself answered makes the row unreachable, or is reported some other way.

## What I did meanwhile

Any failure other than a missing file makes that row unreachable, with the error line as its detail; the command exits 1.

## What it costs to change later

One branch in the targets reader; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec defines unreachable as a repository gh cannot read, not a reading that fails partway (author).

```

<!-- /omni-outbox-settled: s1-02-failed-reading-is-unreachable -->
