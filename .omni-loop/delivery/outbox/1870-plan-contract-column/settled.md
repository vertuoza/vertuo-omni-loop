# Settled outbox items — PRD 1870

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-slice-fixture-outside-territory -->

## s1-01-slice-fixture-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-slice-fixture-outside-territory
prd: 1870
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

One older test builds plan slices by hand and had to learn the new field too, but it sits outside the files this step was given. Should it have been changed here?

## The decision, in plain words

I added the one missing line to that test, saying the slice declares nothing, so the whole kit still builds. Nothing it checks changed.

## The intro, for fun

A new column joined the plan, and one old test forgot to set a place for it.

## The punchline, for fun

One line later, everyone sits at the table again.

## The options, in plain words

A. A. Keep the field required and the one-line fixture fix outside the territory (built).
B. B. Make the new contract field optional so no other file needs touching, and have every reader handle a missing field as well as an empty one.

## What I had to decide

Whether a one-line fix to a test that builds slices by hand may land outside this slice's ground, or the new field should be optional instead.

## What I did meanwhile

Added `contract: null` to the hand-built slices of kit/lib/flow/plan-rules.test.ts, the only file outside the territory the new required field broke at typecheck.

## What it costs to change later

A constant: removing the line, or making the field optional, is a one-line change with no data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan named s1's territory before anyone counted the files that build slices by hand; whether the planner meant to leave them out is not written down (author).

```

<!-- /omni-outbox-settled: s1-01-slice-fixture-outside-territory -->

<!-- omni-outbox-settled: s4-01-own-target-moved-copy-wording -->

## s4-01-own-target-moved-copy-wording — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-own-target-moved-copy-wording
prd: 1870
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

When a repository that keeps its own knowledge has changed its planning settings since the copy was made, the targets report has no reading date to quote. What should the report say, and should a repository whose knowledge was imported but whose planning copy is missing also be reported as never copied?

## The decision, in plain words

The report says the settings moved since its copy was read, keeping the opening words the sync step looks for, and an imported repository with a missing planning copy keeps today's wording, that its copy lacks the settings.

## The intro, for fun

A copy with no date on it is like a photo with no caption.

## The punchline, for fun

We wrote 'since its copy' on the back and hoped nobody squints.

## The options, in plain words

A. Keep 'flow moved since read at its copy' for a target without a reading date, and today's wording for an imported target with no planning copy (as built).
B. Say 'flow moved since it was copied' for such a target, and update the sync step to match that opening too.
C. Also report an imported target with no planning copy as 'flow not copied', changing today's wording and its test.

## What I had to decide

Pick the wording of the stale line for a target without a reading date, and whether an imported target with no planning copy reads as never copied.

## What I did meanwhile

A target that keeps its own knowledge reads 'flow moved since read at its copy' when its copy differs, and 'flow not copied' when it has none; an imported target with no planning copy reads as today.

## What it costs to change later

A constant in one file and two test lines: changing the words costs minutes, and the sync step matches only their opening.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person running the sync step reads 'read at its copy' as natural English (author)

```

<!-- /omni-outbox-settled: s4-01-own-target-moved-copy-wording -->

<!-- omni-outbox-settled: s5-01-contracts-line-where -->

## s5-01-contracts-line-where — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-contracts-line-where
prd: 1870
slice: s5
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

The command that shows a repository's working rules now says whether its plans must name what each step changes for others. The spec left open on which of the command's views that line appears, and how the machine-readable answer carries it.

## The decision, in plain words

The line appears only on the overview, as its second line, right under the heading and before the areas and their hooks. The machine-readable overview, which used to be a plain list, is now a small record holding that list and the new answer side by side.

## The intro, for fun

One new line, three possible homes, and the spec only gave a street name.

## The punchline, for fun

We picked the house the planner actually knocks on.

## The options, in plain words

A. A. Overview only, second line, and the machine-readable overview becomes a record of the list and the answer
B. B. Also print the line on the single-point and single-path views
C. C. Keep the overview's machine-readable form a plain list and add the answer only to the text

## What I had to decide

Keep the line on the overview only, or also print it on the single-point and single-path views.

## What I did meanwhile

Planning reads the overview, so the plan skill sees the line today; the per-point and per-path views are unchanged.

## What it costs to change later

Printing it elsewhere too is a few lines and a test update; going back to a plain list for the overview is a one-line change, though anything that read the list must follow.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the repository reads the overview's machine-readable form today besides its own test, so the shape change breaks no known reader (author)

```

<!-- /omni-outbox-settled: s5-01-contracts-line-where -->

<!-- omni-outbox-settled: s5-02-snapshot-outside-territory -->

## s5-02-snapshot-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-14
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-snapshot-outside-territory
prd: 1870
slice: s5
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

The step was allowed to change the command and its test file only, but the test keeps a saved copy of the command's expected output in a separate file, which had to gain the new line.

## The decision, in plain words

The saved expected output was updated with the one new line, so the existing test stays green; nothing else outside the allowed files was touched.

## The intro, for fun

The test brought a friend to the party, and the guest list only had the test's name.

## The punchline, for fun

We let the friend in; it only wanted to say one line.

## The options, in plain words

A. A. Accept the one-line update to the test's saved expected output
B. B. Rewrite that test as an explicit expectation and leave the saved file alone, with its old entry left unused

## What I had to decide

Accept the one-line change to the saved expected output, or have plans list such saved-output files with their tests from now on.

## What I did meanwhile

The saved output holds exactly the new line and nothing more.

## What it costs to change later

Undoing it means turning that test into an explicit expectation, a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan should have named the saved-output file with its test was not checked against earlier plans (author)

```

<!-- /omni-outbox-settled: s5-02-snapshot-outside-territory -->
