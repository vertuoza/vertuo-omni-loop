# Settled outbox items — PRD 2583

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-db-types-and-ci-check-outside-territory -->

## s1-02-db-types-and-ci-check-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-02
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-db-types-and-ci-check-outside-territory
prd: 2583
slice: s1
rank: medium
bears-on: none
raised: 2026-11-02
wave: 1
---

## The question, in plain words

Two files outside this slice's ground still need the new domains: the database's generated types, and the database workflow, which must run the new domains check. Who should change them, and when?

## The decision, in plain words

This slice left both alone. The next slice extends the same database change, so the types are best regenerated once after it, and the workflow gains its one line for the domains check at the same time, on the feature branch.

## The intro, for fun

The new room is built, but the floor plan on the wall still shows the old house.

## The punchline, for fun

Someone has to redraw it, ideally once the second room is done too.

## The options, in plain words

A. Regenerate the database types and add the workflow step for the domains check on the feature branch once slice s2 has merged.
B. Add both to this slice now, outside its declared ground, and regenerate the types again after slice s2.

## What I had to decide

Answer A to have the wave regenerate the types and add the workflow line on the feature branch after slice s2 merges; answer B to have them added to this slice before it merges.

## What I did meanwhile

The feature branch's database types check will fail until the types are regenerated; the domains check is proven locally but does not yet run in CI.

## What it costs to change later

Either way it is one regenerated file and one workflow step; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Proven locally: supabase/checks/product_domains.sql and product_knowledge.sql pass on a database built from every migration; CI has not run the domains check (author).

```

<!-- /omni-outbox-settled: s1-02-db-types-and-ci-check-outside-territory -->
