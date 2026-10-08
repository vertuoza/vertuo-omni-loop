# Settled outbox items — PRD 1218

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-base-catalog-names-in-the-grade -->

## s1-01-base-catalog-names-in-the-grade — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-base-catalog-names-in-the-grade
prd: 1218
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The check that reads a roadmap must know which ready-made checks and fixes exist, before the code that runs them is written. Where should that list of names live?

## The decision, in plain words

The list of ready-made check and fix names lives with the roadmap check for now, and the code that runs them, built next, reads its names from there, so the two can never disagree.

## The intro, for fun

Two lists of the same names is how a checklist starts lying to you.

## The punchline, for fun

So there is one list, and everyone reads it.

## The options, in plain words

A. A. Keep the names in the grade module; the catalog imports them (built).
B. B. Move them into the catalog folder in s2 and have the grade import them from there.
C. C. Let the grade take the names as an input from its caller, so it knows nothing of the catalog.

## What I had to decide

Whether the names of the base checks and base fixes stay in the grade module, or move into the catalog folder once it exists.

## What I did meanwhile

The grade exports PREREQUISITE_BASE_CHECKS and PREREQUISITE_BASE_FIXES; slice s2 keys its catalog by them. Prerequisite ids also count against PRD row and question ids for the duplicate-id rule, so a blocks cell is never ambiguous.

## What it costs to change later

Moving the names later is a constant moved from one module to another and one import changed: no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the catalog's folder (prereqs/) but not where the grade reads the names from; s1 had to know them before that folder exists. (author)

```

<!-- /omni-outbox-settled: s1-01-base-catalog-names-in-the-grade -->
