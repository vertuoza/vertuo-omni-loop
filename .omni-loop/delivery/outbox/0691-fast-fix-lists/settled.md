# Settled outbox items — PRD 691

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-fix-facts-check-in-ci -->

## s1-01-fix-facts-check-in-ci — adopted

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
id: s1-01-fix-facts-check-in-ci
prd: 691
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new access check for the stored fix facts is written, but nothing runs it on a pull request yet. Should it join the other database checks that run automatically?

## The decision, in plain words

The check is written and committed, but the automatic run was not switched on, because that file belongs to no slice of this plan.

## The intro, for fun

A brand new safety check sits on the shelf, fully charged and waiting for its turn.

## The punchline, for fun

It only needs one line in the right place to start earning its keep.

## The options, in plain words

A. Leave the workflow as it is in this slice, and add the step on the feature branch before ready
B. Add the step now, in this slice, widening its territory by one workflow file
C. Do not run it in CI: the check stays a manual proof only

## What I had to decide

Whether supabase/checks/fix_facts.sql gets its own step in .github/workflows/supabase.yml, beside prd_outbox.sql.

## What I did meanwhile

The check exists and can be run by hand with psql; CI does not run it, so a broken policy on fix_facts would not be caught on the pull request.

## What it costs to change later

One step of four lines in the workflow file, added in a later slice or the feature branch; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The check was not run locally: this machine has no psql and no Supabase CLI (author).

```

<!-- /omni-outbox-settled: s1-01-fix-facts-check-in-ci -->
