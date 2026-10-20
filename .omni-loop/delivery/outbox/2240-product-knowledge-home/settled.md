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

<!-- omni-outbox-settled: s3-01-knowledge-opens-on-unbuilt-constituents -->

## s3-01-knowledge-opens-on-unbuilt-constituents — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-knowledge-opens-on-unbuilt-constituents
prd: 2240
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The Knowledge tab now opens on Constituents, but Constituents, Personas, Pitch and Settings are built by later slices, so should their sub-menu entries exist and show no count until then?

## The decision, in plain words

The sub-menu lists all six sections in order and the Knowledge address sends a reader to Constituents. Only Legal and Glossary show a count and open a page for now; the other four answer not found until the slices that own them land.

## The intro, for fun

The menu has six doors, and only two have rooms behind them so far.

## The punchline, for fun

The other four are being furnished in the next waves.

## The options, in plain words

A. A. All six entries now, opening on Constituents as the spec says (built).
B. B. Show only the sections that exist, opening on Legal, and let each later slice add its entry.

## What I had to decide

Follow the spec as written: all six entries, opens on Constituents. The feature branch is only whole once s4, s5 and s6 have merged.

## What I did meanwhile

Legal and Glossary work fully; the four later sections are links that answer the not found page.

## What it costs to change later

Changing it later is a constant in one file (the first section and the counted sections in knowledge-sections.ts).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the Knowledge address should open on Legal until s4 lands was not specified.

```

<!-- /omni-outbox-settled: s3-01-knowledge-opens-on-unbuilt-constituents -->

<!-- omni-outbox-settled: s3-02-glossary-address-and-history -->

## s3-02-glossary-address-and-history — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-glossary-address-and-history
prd: 2240
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

A term's page is addressed by its stable id rather than its words, and its history lists only when it was added and last changed, because the database keeps no event feed for Legal and Glossary: is that enough?

## The decision, in plain words

A glossary entry opens at an address made from its id, so renaming a term never breaks a link. An entry's history shows who added it and when, and when it last changed; there is no list of past edits because none is stored.

## The intro, for fun

A term can change its words, but its address keeps the name it was born with.

## The punchline, for fun

Its history is short: born, maybe edited, and that is all the diary holds.

## The options, in plain words

A. A. Entry id in the address, history limited to added and last changed dates (built).
B. B. The term's words in the address, which breaks a link when a term is renamed.
C. C. Add stored edit events for Legal and Glossary in a later migration and list them.

## What I had to decide

Use the entry id in the address and show the created and updated dates as the history. A fuller history needs the database to store edit events, which is a migration outside this slice.

## What I did meanwhile

Both pages read and sort correctly, and the history section shows the dates the database already returns.

## What it costs to change later

Switching the address to the term's words is one function; adding event history needs a migration and a read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a history is shown where one is kept, and the read holds none for Legal or Glossary.

```

<!-- /omni-outbox-settled: s3-02-glossary-address-and-history -->
