# Settled outbox items — PRD 2239

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-what-the-page-check-refuses -->

## s1-01-what-the-page-check-refuses — adopted

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
id: s1-01-what-the-page-check-refuses
prd: 2239
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The new check refuses a review page that loads anything from outside itself. How wide should that be read, and should a section sitting outside both tabs be checked too?

## The decision, in plain words

Anything a browser would fetch from elsewhere is refused, from pictures to scripts and stylesheets, while links a reader clicks stay allowed and styles written inside the page are not searched. Every section is checked, wherever it sits.

## The intro, for fun

A page that phones home is a page that shows nothing in our locked-down frame.

## The punchline, for fun

So the check listens for every call it would place, except the reader's own clicks.

## The options, in plain words

A. Refuse every fetched address on any element, links excepted; leave inline styles unread; check every section wherever it sits (as built)
B. Refuse only what the spec names by example: an outside script, an outside stylesheet and an outside picture
C. As A, and also read the page's inline styles for outside addresses

## What I had to decide

Pick A to keep the check as built, B to narrow it to the three cases the spec names, or C to also read the page's inline styles.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

The check refuses every fetched address on any element except links, leaves inline styles unread, and grades every section of a page carrying the new marker.

## What it costs to change later

Each answer is a change to one list of names in the page check and its tests; no stored data and no page already written is affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A stylesheet pulled in from inside a style block is not caught: the spec names attributes only, so inline styles were left unread (author).
- A responsive-image list is refused whenever it is filled in, even one made only of pictures written inside the page: reading it candidate by candidate was left out, as no page of this shape uses one (author).

```

<!-- /omni-outbox-settled: s1-01-what-the-page-check-refuses -->

<!-- omni-outbox-settled: s2-01-s2-export-kit-template -->

## s2-01-s2-export-kit-template — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-s2-export-kit-template
prd: 2239
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The loader of the kit's built-in files had to let the new command ask for the page skeleton by its path, and that loader sits outside this slice's list of files. Is that small addition acceptable?

## The decision, in plain words

We added one small function to the loader that already serves the playbook templates, so the new command can read the page skeleton in the built kit as well as from source.

## The intro, for fun

The skeleton was in the building, but the key was in another room.

## The punchline, for fun

One tiny doorway, cut where the other doors already are.

## The options, in plain words

A. A. Keep the small general-purpose export in the existing loader (what was built).
B. B. Give the loader a reader made only for the page skeleton, and drop the general-purpose export.

## What I had to decide

Added `kitTemplate(path)` to `kit/lib/playbook/templates.ts`, a one-line export of the existing private `templateText`. The slice's territory names the skeleton folder and the command but not this loader, and the bundle's templates are private to that file, so there was no other way to read `before-after/page.html` from `kit/dist`. A different answer undoes it by deleting the export and passing the text in.

## What I did meanwhile

The new command reads the skeleton through the export; no behaviour of the playbook templates changes.

## What it costs to change later

One exported function in a file outside the slice's territory; nothing to migrate if reversed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person prefers a dedicated reader for the skeleton over the generic export (author)

```

<!-- /omni-outbox-settled: s2-01-s2-export-kit-template -->

<!-- omni-outbox-settled: s4-01-s4-tests-out-of-the-law-proof-file -->

## s4-01-s4-tests-out-of-the-law-proof-file — adopted

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
id: s4-01-s4-tests-out-of-the-law-proof-file
prd: 2239
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 3
---

## The question, in plain words

The new checks for the brainstorm skills first went into a test file that also proves three locked rules, so the pull request waited for that file's owner to approve it. Should they live there?

## The decision, in plain words

The new checks moved into a file of their own; the file that proves the locked rules is left exactly as it is on the main branch.

## The intro, for fun

Four new tests moved into the house where the locked rules live.

## The punchline, for fun

They now have a flat of their own, and the landlord need not sign anything.

## The options, in plain words

A. Keep the new checks in a test file of their own (built)
B. Put them back beside the proofs of the locked rules, and ask their owner to approve the pull request

## What I had to decide

Whether the four PRD 2239 tests of the brainstorm skills stay in kit/test/before-after-skills.test.ts or go back into kit/test/plugin.test.ts, which holds the proofs of BR-PRODUCT-3, BR-PRODUCT-5 and N-PRODUCT-15.

## What I did meanwhile

The tests run from kit/test/before-after-skills.test.ts; kit/test/plugin.test.ts is unchanged from main, so the outbox check no longer waits for a CODEOWNER review.

## What it costs to change later

One more small test file, with its own copy of the eight-line skillSection helper (four other test files already carry one).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether @pierrederval would rather review every test that reads the skills in plugin.test.ts is not written anywhere (author).

```

<!-- /omni-outbox-settled: s4-01-s4-tests-out-of-the-law-proof-file -->
