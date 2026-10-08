# Settled outbox items — PRD 1272

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-page-kinds-stay-narrow -->

## s1-01-page-kinds-stay-narrow — adopted

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
id: s1-01-page-kinds-stay-narrow
prd: 1272
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

Which part of the work teaches the existing pages that a concept is a kind of dossier?

## The decision, in plain words

The database and the upload now accept concepts, but the existing pages still know only PRDs and fixes. The slices that build the Concepts pages widen them, before any concept is uploaded.

## The intro, for fun

A new guest is on the list at the door, but the seating plan has not heard of them yet.

## The punchline, for fun

Someone has to add a chair before the guest actually shows up.

## The options, in plain words

A. Keep the pages' kinds as they are here, and have the next slice that adds concepts to the menu widen them before any concept is uploaded.
B. Widen the pages' kinds now, editing five page files outside this slice's ground with placeholder entries.
C. Have the database's history list leave concepts out, and give the Concepts list a read of its own.

## What I had to decide

Whether the pages' own list of dossier kinds (and of version kinds) grows in this first slice, or with the Concepts pages that read them.

## What I did meanwhile

The galaxy store keeps WORK_KINDS and ARTIFACT_KINDS (what the pages read) as they were, and adds PUSH_KINDS and PUSHED_ARTIFACT_KINDS for the push and the lookup. Widening WORK_KINDS here would have broken the type of five files outside this slice's territory (dossier/page/work.ts, view.ts, DossierPage.tsx, fixes/FixList.tsx, fixes/FixListRoute.tsx). The catch: data/dossiers.ts parses dossier_list() rows strictly (kind in WORK_KINDS, latest keyed by ARTIFACT_KINDS), and the database's dossier_list() does return concept rows, so workspaceDossiers() (the dashboard) throws once one concept is pushed, until WORK_KINDS and ARTIFACT_KINDS take the concept's kinds. /prd, /visual and /bugs read unparsed rows filtered by kind, and are unaffected.

## What it costs to change later

One edit in s2 or s3: fold PUSH_KINDS into WORK_KINDS and PUSHED_ARTIFACT_KINDS into ARTIFACT_KINDS, with the kind maps that then need a concept entry. No migration either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- data/dossiers.ts and dossier/page/DossierPage.tsx are in no slice's territory, so the plan names nobody to widen them (author)

```

<!-- /omni-outbox-settled: s1-01-page-kinds-stay-narrow -->
