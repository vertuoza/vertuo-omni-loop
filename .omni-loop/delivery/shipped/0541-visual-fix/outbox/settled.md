# Settled outbox items — PRD 541

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-init-tests-outside-territory -->

## s1-01-init-tests-outside-territory — adopted

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
id: s1-01-init-tests-outside-territory
prd: 541
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Adding the new visual label changed what the install and update commands print, and the tests that pin that output sit outside this slice's agreed area. Should this slice update them?

## The decision, in plain words

Yes: the tests now expect the new label in their lists, and one new test checks the install command creates it. Nothing else in those files changed.

## The intro, for fun

One new label walked in, and two old tests counted the guests again.

## The punchline, for fun

The headcount now includes the visitor in pink.

## The options, in plain words

A. Update the two test files in this slice, as built.
B. Move those edits to their own slice with the test files in its area.

## What I had to decide

Whether a slice that adds a label may update the install and update tests that list every label, though the plan left them out of its area.

## What I did meanwhile

Those two test files carry the new label in their expected lists, plus one test that the install creates it.

## What it costs to change later

Undoing it means dropping the label from those lists again, only if the label itself is dropped.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not name the install and update test files in this slice's area; the spec does ask that install creates the label, which forces these edits. (author)

```

<!-- /omni-outbox-settled: s1-01-init-tests-outside-territory -->
