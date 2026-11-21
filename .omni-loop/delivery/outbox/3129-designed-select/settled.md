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

<!-- omni-outbox-settled: s2-01-s2-dom-test-dev-dependencies -->

## s2-01-s2-dom-test-dev-dependencies — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-21
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-s2-dom-test-dev-dependencies
prd: 3129
slice: s2
rank: medium
bears-on: none
raised: 2026-11-21
wave: 2
---

## The question, in plain words

To prove that picking an option in the Ask page's dropdowns still saves it, the tests need the same browser-test tools the shared dropdown's own tests use. Is it fine that the app now lists them as development tools?

## The decision, in plain words

The app's package list and the lockfile gained four test-only tools already used by another package, so the Ask page's pick tests can run in a simulated browser.

## The intro, for fun

Even a dropdown deserves a proper test drive before it leaves the garage.

## The punchline, for fun

Four test-only tools moved in, and none of them ships to anyone.

## The options, in plain words

A. A. Keep the four test-only tools as development dependencies of the app and test the picks in a simulated browser (as built).
B. B. Drop the browser test and check only the rendered markup, leaving the saving of a pick unproven.

## What I had to decide

Option A keeps one new test file in the Ask page. Option B drops the DOM test and keeps only static markup tests, which cannot prove a pick saves.

## What I did meanwhile

The tools are listed as development-only dependencies of the app, so nothing changes for people using it.

## What it costs to change later

Removing them later costs one edit of the package list and the lockfile.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the app should own these test tools or the tests live in the shared UI package (author).

```

<!-- /omni-outbox-settled: s2-01-s2-dom-test-dev-dependencies -->
