# Settled outbox items — PRD 3129

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-field-test-follows-the-select -->

## s1-01-field-test-follows-the-select — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-21
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-field-test-follows-the-select
prd: 3129
slice: s1
rank: medium
bears-on: none
raised: 2026-11-21
wave: 1
---

## The question, in plain words

The old test of the form field checked the browser's own dropdown, which the new list replaces. Is it right that this slice updated that one test file, which sits just outside its listed folders?

## The decision, in plain words

The test now checks the new list through the same label, hint and keyboard path, so the form field keeps its proof.

## The intro, for fun

A dropdown changed its coat, and an old test still asked for the old one.

## The punchline, for fun

The test got the new coat too, and nothing else moved.

## The options, in plain words

A. A. Update the form field's test in this slice, as built.
B. B. Leave the test red and let a later slice fix it.

## What I had to decide

Only the two lines of Field.dom.test.ts that read the native select changed; nothing else outside the slice's folders was touched.

## What I did meanwhile

The test file is updated on the slice branch and the checks are green.

## What it costs to change later

Reverting it is one file; a different answer would only mean moving those two lines to another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 lists packages/ui/src/Select but not Field.dom.test.ts (author)

```

<!-- /omni-outbox-settled: s1-01-field-test-follows-the-select -->
