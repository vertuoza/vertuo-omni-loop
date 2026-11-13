# Settled outbox items — PRD 2741

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-s2-outside-territory-edits -->

## s2-01-s2-outside-territory-edits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-13
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-s2-outside-territory-edits
prd: 2741
slice: s2
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

To check a proof against the pull requests of a multi-repository fix, this slice also touched two files that the plan does not list for it. Is that all right?

## The decision, in plain words

Yes: one word was added to a helper in the proof-checking code so the new check can reuse it, and the help text and its test for the bug command were reworded to name the new flag and the new rule.

## The intro, for fun

A slice asked for a ladder and borrowed a screwdriver from the next room.

## The punchline, for fun

It put the screwdriver back where it found it, only a little shinier.

## The options, in plain words

A. A. Keep the two small edits outside the territory, as built.
B. B. Move them to a later slice and duplicate the cited-commit reading inside the territory meanwhile.

## What I had to decide

Whether to edit files outside the slice territory: kit/lib/bug/proof-body.ts (export of citedCommit, so the Fixes check reads the same cited commit as the single-pull-request check) and kit/lib/help/entries.ts with its test (omni help bug must name --pr, a done-when of this slice, and its old sentence that a Fixes record is not checked for a proof is no longer true).

## What I did meanwhile

Exported citedCommit unchanged and reworded the help entry; all other changes stay inside the territory.

## What it costs to change later

Reverting is a one-line change in proof-body.ts and a small edit of the help entry and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person prefers a duplicated reader inside the territory over a one-word export (author)

```

<!-- /omni-outbox-settled: s2-01-s2-outside-territory-edits -->
