# Settled outbox items — PRD 1359

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-kart-registry-edits-outside-territory -->

## s1-01-kart-registry-edits-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-kart-registry-edits-outside-territory
prd: 1359
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Putting OMNI KART in the arcade meant touching the game list, the score lists and the tests that counted two games, which sit outside this slice's own files. Is that the right place for them?

## The decision, in plain words

The kart cabinet was added to the shared game list and the old tests that expected two games and a coming-soon cabinet were updated, so the third cabinet is now the kart and no cabinet says soon.

## The intro, for fun

A third cabinet rolled into the arcade and the old furniture had to shuffle over.

## The punchline, for fun

Nobody minded, except the sign that said soon.

## The options, in plain words

A. A. Keep the shared edits in this slice, as built.
B. B. Move the shared edits to a separate slice and keep this one to the kart's own files.

## What I had to decide

Confirm the shared game list and the updated tests may stay in this slice, or move them to a slice of their own.

## What I did meanwhile

The arcade shows OMNI KART as the third cabinet, locked until level 3.

## What it costs to change later

Small: the edits are a few lines in the game list, the grid and the tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a registry edit may ride in a slice whose territory is the kart's own files (author)

```

<!-- /omni-outbox-settled: s1-01-kart-registry-edits-outside-territory -->
