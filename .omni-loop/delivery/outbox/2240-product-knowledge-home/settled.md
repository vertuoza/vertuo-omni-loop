# Settled outbox items — PRD 2240

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-render-test-fixture-outside-territory -->

## s1-01-render-test-fixture-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-render-test-fixture-outside-territory
prd: 2240
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Adding who wrote each term broke one hand-built term in a screen test that belongs to a later slice, so should this slice fix that test or leave it to its owner?

## The decision, in plain words

This slice changed that one line of the test so the hand-built term copies the demo term's author and dates. Nothing the test checks changed.

## The intro, for fun

One test drew a glossary term by hand, and the new fields left it a few strokes short.

## The punchline, for fun

We lent it the demo term's pen and dates, and it compiles again.

## The options, in plain words

A. A. Change the one fixture line here, so the slice's own change leaves every test green (built).
B. B. Leave the test to s3, which owns the folder, and accept a failing type check on the feature branch until it merges.

## What I had to decide

Whether a slice may fix a test fixture outside its territory when its own contract change breaks it. A: one line changed in the screen test (product-knowledge.render.test.ts, line 79), the removed term spreading the demo term. B: leave it to s3, which owns the folder, with the feature branch failing its type check until then.

## What I did meanwhile

The screen test compiles and passes unchanged in what it asserts.

## What it costs to change later

Undoing it is reverting one line; s3 may reshape the test as it likes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- s3 rewrites the Legal and Glossary pages and may replace this test wholesale; whether it keeps the fixture is its call (author)

```

<!-- /omni-outbox-settled: s1-01-render-test-fixture-outside-territory -->
