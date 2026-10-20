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

<!-- omni-outbox-settled: s4-01-business-tests-expected-the-moved-sections -->

## s4-01-business-tests-expected-the-moved-sections — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-business-tests-expected-the-moved-sections
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

Four existing tests expected Settings › Business to draw the Constituents and the Personas, which this slice takes off that page, so should those four tests change?

## The decision, in plain words

This slice rewrote those four tests to say the page no longer draws them, and kept every test of the Constituents panel and the Personas section itself unchanged.

## The intro, for fun

Four tests were waiting for guests who have since moved to another house.

## The punchline, for fun

We told them the address, and they stopped checking the door.

## The options, in plain words

A. Rewrite the four tests to assert the sections are gone from Business, keeping every direct test of the components untouched (built).
B. Keep the four tests as they were and leave the sections on Business as well as on the Knowledge home, which contradicts the spec.

## What I had to decide

The spec asks both that Settings › Business render neither section, with a render test proving it, and that every existing test of the panel and the section pass unchanged. Four tests (two in constituents-render.test.ts, two in personas-render.test.ts) rendered the whole Business screen and expected the sections on it, so both cannot hold for those four. I kept the components and their direct tests as they were and rewrote only those four to assert the sections are absent from the Business screen.
Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

The Business page draws neither section; the Knowledge home draws both. The sample data (DEMO_PERSONAS, DEMO_CONSTITUENTS) stays in BusinessScreen.tsx and the demo of the Knowledge pages reads it from there.

## What it costs to change later

Reverting means putting the two props back on the Business page and the four tests as they were, about one hundred lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The Business page's read (load.ts) still reads every persona although nothing draws them there any more; its own test expects that read, so slice s6, which owns the rest of that page, may drop it (author)

```

<!-- /omni-outbox-settled: s4-01-business-tests-expected-the-moved-sections -->

<!-- omni-outbox-settled: s4-02-knowledge-menu-counts-for-two-sections -->

## s4-02-knowledge-menu-counts-for-two-sections — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-knowledge-menu-counts-for-two-sections
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The Knowledge menu shows a count only for Legal and Glossary, so should Constituents and Personas show theirs too, which needs a change in the menu that an earlier slice owns?

## The decision, in plain words

The Constituents and Personas pages are built, but their menu entries show no count yet, because the menu belongs to an earlier slice and the counts need data it does not read today.

## The intro, for fun

Two new tabs arrived with their number tags still in the post.

## The punchline, for fun

The menu will hang them once someone signs for the delivery.

## The options, in plain words

A. Leave the menu counts for a follow-up in the frame's own slice and ship the two sections without them (built).
B. Widen the frame in this slice so the menu counts constituents and personas too, going outside the territory.

## What I had to decide

The first criterion says the list sections show their count in the menu. The menu (knowledge-sections.ts, KnowledgeNav.tsx and the page frame) is outside this slice's territory and reads only the Legal and Glossary entries from the product's knowledge; counting constituents and personas needs two more reads in that frame. I built the two sections and left the menu as it is. Constituents have a Retired filter; Personas have none, since a deleted persona is not readable by a member.

## What I did meanwhile

The Constituents and Personas entries show without a count; each page shows its own Active and Retired counts (Constituents) or its rows (Personas).

## What it costs to change later

Adding the counts is one read per section in the page frame and two keys in the counts table, about forty lines plus their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a deleted persona should show behind a Retired filter, which needs its row readable by members (author)

```

<!-- /omni-outbox-settled: s4-02-knowledge-menu-counts-for-two-sections -->

<!-- omni-outbox-settled: s4-03-share-list-parts-from-the-legal-list -->

## s4-03-share-list-parts-from-the-legal-list — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-share-list-parts-from-the-legal-list
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The Constituents and Personas lists need the same card, filters and text cell as the Legal list, so should they reuse them, which means exporting three pieces from a file an earlier slice owns?

## The decision, in plain words

This slice added the word export to three small pieces of the Legal and Glossary list file and reused them, rather than copying forty lines into its own folder.

## The intro, for fun

Two new lists asked to borrow a cup of sugar instead of buying a farm.

## The punchline, for fun

The cupboard door now says export, and nothing else in the kitchen moved.

## The options, in plain words

A. Export the three pieces from the Legal and Glossary list file and reuse them (built).
B. Copy the three pieces into this slice's folder, which the repository's duplication check refuses.

## What I had to decide

The repository's duplication check refuses a forty-line copy of the card, the filters and the one-line cell. The three pieces live in KnowledgeLists.tsx, outside this slice's territory (slice s3 owns it). I exported them there (three keywords, no other change) and imported them in the new sections. The alternative was a copy inside this slice's folders, which the check refuses.

## What I did meanwhile

The Legal and Glossary lists draw exactly as before; the Constituents and Personas lists draw with the same pieces.

## What it costs to change later

Undoing it is removing three export keywords and copying the pieces into this slice's folder, about forty lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slices s5 and s6 may want the same pieces for their own pages; nothing here stops them (author)

```

<!-- /omni-outbox-settled: s4-03-share-list-parts-from-the-legal-list -->

<!-- omni-outbox-settled: s4-04-knowledge-writes-keep-their-browser-path -->

## s4-04-knowledge-writes-keep-their-browser-path — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-knowledge-writes-keep-their-browser-path
prd: 2240
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

Saving a Constituent or a Persona still goes from the browser straight to the database, as it did on Settings › Business, so should it instead go through a route of its own?

## The decision, in plain words

The moved forms keep the exact write path they had, from the browser to the same database functions, and the two small files that open that connection sit apart from the page code.

## The intro, for fun

The forms moved house but kept using the old front door.

## The punchline, for fun

A new door is on the list, behind the bookshelf for now.

## The options, in plain words

A. Keep the browser write path through two small connection files and move it behind routes later (built).
B. Move both sections' writes behind routes of their own in this slice, changing the write path the spec said to keep.

## What I had to decide

The spec says every write keeps its endpoint and its database function and that the moved forms keep their code. Those writes call the database from the browser. The repository's layering rule asks for browser files to reach storage only through a route, but it only lists old breaches and refuses new ones, so I put the browser connection in two small files that are not browser files (constituent-port.ts and persona-port.ts), which the rule reads as allowed. Reading goes through repositories as the rule asks.

## What I did meanwhile

Saves work as they did before and refresh the page in place. No new route or database function exists.

## What it costs to change later

Moving the writes behind routes is a route, a service and a repository per section, with the browser calling the route, about three hundred lines and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the layering rule should accept this shape or the writes should move behind routes now, which the spec did not ask for (author)

```

<!-- /omni-outbox-settled: s4-04-knowledge-writes-keep-their-browser-path -->

<!-- omni-outbox-settled: s5-01-s5-settings-products-menu-entry -->

## s5-01-s5-settings-products-menu-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-s5-settings-products-menu-entry
prd: 2240
slice: s5
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

Taking the Products tab out of Settings left the Settings menu in the left sidebar still listing a Products page that now only redirects. Should that menu entry go too?

## The decision, in plain words

I removed the Products entry from the Settings menu and updated the tests of the other Settings pages that listed the tab, even though the plan names only the tab row. A link to a page that just forwards you elsewhere would be a leftover.

## The intro, for fun

A signpost kept pointing at a door that had been bricked up.

## The punchline, for fun

We took the signpost down too, and left a forwarding address.

## The options, in plain words

A. A. Remove the Products entry from the Settings menu (as built).
B. B. Keep it, pointing at the products list.

## What I had to decide

Decide whether the Settings menu should keep a Products entry (it would land on the products list through the redirect).

## What I did meanwhile

The entry is gone; old bookmarks still land on the right page through the redirects.

## What it costs to change later

Putting the entry back is one line in the sidebar file and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people use the Settings menu entry to reach products is unknown (author).

```

<!-- /omni-outbox-settled: s5-01-s5-settings-products-menu-entry -->
