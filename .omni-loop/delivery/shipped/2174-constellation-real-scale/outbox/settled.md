# Settled outbox items — PRD 2174

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-backfill-kept-as-a-function -->

## s1-01-backfill-kept-as-a-function — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-backfill-kept-as-a-function
prd: 2174
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Should the one-time fill of every past PRD's targets stay in the database as a named step that can be run again, or run once and leave nothing behind?

## The decision, in plain words

The one-time fill is kept as a named step only the database itself may run. The migration runs it once, and the database check runs the very same step to prove it fills a PRD planned before the table existed.

## The intro, for fun

A one-time job that sticks around afterwards, just in case.

## The punchline, for fun

It runs once on release day and then waits quietly in the cupboard.

## The options, in plain words

A. A. Keep the fill as a named step only the database runs, called once by the migration and again by its check (built).
B. B. Inline the fill in the migration and drop the named step; the check repeats the same statement to prove it.

## What I had to decide

Keep A, or choose B and the next migration drops prd_targets_backfill() and inlines its loop.

## What I did meanwhile

Nothing waits on it: no client may run the step, and it only rewrites rows the plan push would write anyway.

## What it costs to change later

B is one small follow-up migration; the check would then copy the loop instead of calling the migration's own step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the migration backfills once; it does not say whether the step may stay afterwards (author).

```

<!-- /omni-outbox-settled: s1-01-backfill-kept-as-a-function -->

<!-- omni-outbox-settled: s2-01-label-box-measures-the-role -->

## s2-01-label-box-measures-the-role — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-label-box-measures-the-role
prd: 2174
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

The spec sizes each star's label by its name only, but a repository's role prints under its name and can be longer. Should the label's space also cover a long role?

## The decision, in plain words

Each label takes the width of its longer line, the name or the role, still capped at 28 characters, so a long role never prints over a neighbour.

## The intro, for fun

A star's name was short, but its job description ran on for a whole sentence.

## The punchline, for fun

So we measured the longer line, and the neighbours kept their personal space.

## The options, in plain words

A. A. Measure the longer of the name and the role (built).
B. B. Measure the name alone, as the spec says; a long role may print over a neighbour's label.

## What I had to decide

Keep A: the layout measures the longer of the name and the role. Choose B to measure the name alone, as the spec wrote it; the change is one line in the layout and its test.

## What I did meanwhile

Labels with a role longer than the name take a little more room, so a product with many long roles spreads its stars slightly wider.

## What it costs to change later

Reversing it is a one-line change to how a label's width is measured, plus one test; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The role's real type size is set by the drawing slice (s4); it is measured here at the name's 7.8 px a character, which errs on the wide side (author).

```

<!-- /omni-outbox-settled: s2-01-label-box-measures-the-role -->

<!-- omni-outbox-settled: s3-01-product-prds-no-plan-lines -->

## s3-01-product-prds-no-plan-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-19
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-19
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-product-prds-no-plan-lines
prd: 2174
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

Product PRDs written on the server (such as mobile-12) are not read for plan lines, only the numbered PRDs of the product are. Should they draw lines too?

## The decision, in plain words

The map reads the targets of the product's numbered PRDs only, because only those carry a stage and a place on the Ledger that says whether they are in flight.

## The intro, for fun

Some PRDs have a number, others a key, and the map only counts the first kind.

## The punchline, for fun

Giving the others a seat at the table is one more read away.

## The options, in plain words

A. A. Read only the numbered PRDs (built).
B. B. Read the product PRDs' targets too, marking them in flight while they are not shipped.

## What I had to decide

Option A is built: the map's lines come from the numbered PRDs. Choose B to add the product PRDs, which needs a way to tell whether each is in flight.

## What I did meanwhile

A product with only server-born PRDs draws its stars and no plan line.

## What it costs to change later

B adds one read and an in-flight rule for product PRDs; it undoes nothing built here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether product PRDs should draw lines was not in the spec (author).

```

<!-- /omni-outbox-settled: s3-01-product-prds-no-plan-lines -->
