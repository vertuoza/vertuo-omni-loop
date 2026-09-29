# Settled outbox items — PRD 587

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-tests-outside-territory -->

## s1-01-tests-outside-territory — adopted

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
id: s1-01-tests-outside-territory
prd: 587
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Building this part meant also changing two older page tests and the list of database checks, which the plan gave to nobody. Is that fine?

## The decision, in plain words

We changed them, because the tests still expected the old stage unknown message and the new database check would otherwise never run.

## The intro, for fun

The plan drew a fence, and two old tests were standing just outside it.

## The punchline, for fun

We invited them in rather than leave them shouting about a message that no longer exists.

## The options, in plain words

A. Keep the changes in this slice, the option built.
B. Move the test and workflow changes to their own slice before the feature PR is ready.

## What I had to decide

Whether a slice may change tests and the database-check workflow outside its declared territory when its own done-when requires it.

## What I did meanwhile

render.test.ts and page.test.ts under apps/galaxy/src/dossier/page now pass stored stages, and .github/workflows/supabase.yml runs supabase/checks/prd_stages.sql.

## What it costs to change later

Reverting the three files: the old tests would fail and the new check would stop running.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a later slice planned to own these files (author)

```

<!-- /omni-outbox-settled: s1-01-tests-outside-territory -->

<!-- omni-outbox-settled: s1-02-unreadable-stages-read-syncing -->

## s1-02-unreadable-stages-read-syncing — adopted

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
id: s1-02-unreadable-stages-read-syncing
prd: 587
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When the page cannot read a PRD's stored stages, what should it say?

## The decision, in plain words

It says Syncing, the same words as a PRD not synced yet, and logs the error for us.

## The intro, for fun

The database hiccupped, and the page had to say something polite.

## The punchline, for fun

It chose Syncing, which is technically hopeful and never rude.

## The options, in plain words

A. Show Syncing, the option built.
B. Show a separate line saying the stage could not be read, with a hint to reload.

## What I had to decide

What a PRD page shows when the read of its stored stages fails.

## What I did meanwhile

A failed read is logged and treated as no stored stage: the header reads Syncing… with nothing lit.

## What it costs to change later

One line in the route: a different word or state for a failed read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often the read fails in production (author)

```

<!-- /omni-outbox-settled: s1-02-unreadable-stages-read-syncing -->
