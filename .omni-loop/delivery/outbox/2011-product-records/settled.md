# Settled outbox items — PRD 2011

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-roadmap-approval-pins-document -->

## s1-01-roadmap-approval-pins-document — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-roadmap-approval-pins-document
prd: 2011
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

When a person approves a roadmap on its page, what does the approval cover, and which slice teaches the database to accept it?

## The decision, in plain words

The database now accepts an approval of a roadmap born on the server, and the approval covers the roadmap document alone: a change to the document cancels it, while the rows moving forward as work progresses do not.

## The intro, for fun

A roadmap wants a seal before anyone builds from it.

## The punchline, for fun

The seal sticks to the plan, not to every tick of progress.

## The options, in plain words

A. The approval covers the roadmap document alone, and this slice lets the database accept it (as built)
B. The approval also covers the rows, so any change of a row's progress cancels it
C. Leave approval out of this slice and let the page's slice add it to the database

## What I had to decide

Whether a roadmap approval covers only roadmap.md, as built, or also its PRD rows, human work and prerequisites; and whether s1, the only slice of landing 1 that may touch the database, was the right place to let dossier_approve() take a roadmap.

## What I did meanwhile

dossier_approve() approves a product roadmap pinning its latest roadmap.md; roadmap_product_push() voids that approval when roadmap.md changes, and only then. approvals.files now holds at least one file (a PRD's approval still pins three or four), and approval_voids.kind takes roadmap. dossier_approval() and approval_request(), which find a PRD by repository or product key, do not find a roadmap yet.

## What it costs to change later

A constant: pinning more kinds is a few lines in dossier_approve() and roadmap_product_push(), in a follow-up migration, before any roadmap is approved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a roadmap is approved on its page with the seal of #1299/#1612, but not what the seal pins; s3, which builds the page, has no migration in its territory (author)
- dossier_approval() and approval_request() still look up PRDs only: a roadmap's approval is read from the approvals table by its dossier until a slice needs more (author)

```

<!-- /omni-outbox-settled: s1-01-roadmap-approval-pins-document -->

<!-- omni-outbox-settled: s1-02-ladder-step-set-by-owner -->

## s1-02-ladder-step-set-by-owner — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-ladder-step-set-by-owner
prd: 2011
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Who moves a repository up or down the rollout ladder of its product, and how?

## The decision, in plain words

Every repository of a product starts at step one, and a workspace owner moves it to any step from one to five, up or down, the way they already edit the repository's other settings in the product.

## The intro, for fun

Five rungs, and somebody has to do the climbing.

## The punchline, for fun

For now the owner carries each repository up by hand.

## The options, in plain words

A. An owner sets any step from one to five, up or down (as built)
B. The step follows from what the repository has switched on, with no setter
C. An owner moves it one step at a time

## What I had to decide

Whether a workspace owner sets the ladder step by hand (built), or the step should follow from what the repository already has switched on, or only climb one step at a time.

## What I did meanwhile

product_repositories.ladder_step (1 to 5, default 1) is new, since no earlier PRD stored the ladder; product_repository_set_step(product, repository, step) lets an owner set it, refusing anyone else (42501), a step outside 1 to 5 (22023) and a repository the product does not link (P0002). Nothing reads the step yet: s2 and s6 read it to choose where a record is born, s17 shows it.

## What it costs to change later

A constant: the setter can be narrowed or replaced by a derived step in a follow-up migration; the column stays either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says when the archive is offered (every repository at step 5) but not who moves a repository between steps (author)

```

<!-- /omni-outbox-settled: s1-02-ladder-step-set-by-owner -->

<!-- omni-outbox-settled: s1-03-roadmap-storage-shape -->

## s1-03-roadmap-storage-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-roadmap-storage-shape
prd: 2011
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

How is a roadmap born on the server stored, so its number, its rows and its history fit beside what already exists?

## The decision, in plain words

A roadmap born on the server shares the numbering slot a product's PRDs use, counted apart per kind, keeps the old roadmap record beside it for the pages, names each row's PRD in a new text column beside the old number, and keeps each push of its rows, human work and prerequisites as a version.

## The intro, for fun

Two filing cabinets, one new drawer, and nothing thrown out.

## The punchline, for fun

The old drawer keeps working while the new one fills.

## The options, in plain words

A. Keep the shapes as built: one numbering slot counted per kind, the new text column beside the old number, versions as sent
B. Give roadmaps a numbering column of their own, leaving the shared slot to PRDs
C. Replace the old number with the text column later, once every reader has moved

## What I had to decide

Whether these storage choices hold: the roadmap's number in dossiers.product_seq, unique per product and kind; the text column named prd_id, because the integer already holds the name prd; the integer kept in step by a trigger so git-born pushes stay unchanged; and the rows, human work and prerequisites versioned as the JSON the push sent.

## What I did meanwhile

dossiers_product_seq_key is now unique per product, kind and number, so mobile-3 and mobile-R3 coexist; roadmaps keeps one row per roadmap, keyed by its issue or, for a server-born one, by dossier_id, with repo and number null; roadmap_prds.prd_id holds 912 or mobile-12, and prd holds 912 or null; a product roadmap's human work keeps a product PRD's id in its key, its integer prd null.

## What it costs to change later

A constant before s2 writes the first server-born roadmap: renaming a column or moving the number is one follow-up migration while no row uses it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names the text column roadmap_prds.prd, which the integer already holds (author)
- roadmap_human_work.prd stays an integer, so a product PRD's work is found by its key, not its number (author)

```

<!-- /omni-outbox-settled: s1-03-roadmap-storage-shape -->

<!-- omni-outbox-settled: s2-01-product-roadmap-rows-wait -->

## s2-01-product-roadmap-rows-wait — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-product-roadmap-rows-wait
prd: 2011
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When a roadmap is written on the server, what does each of its PRDs say about where it stands, and is its people-work sent too?

## The decision, in plain words

A product roadmap sends every row as waiting, with no start or end date, and sends no human work, so a push closes none of it. The page and the drive loop that come later read the real standing of each PRD from the server.

## The intro, for fun

The roadmap is written before anyone has started building.

## The punchline, for fun

Every bar starts grey, and the later slices colour it in.

## The options, in plain words

A. A. Send every row as waiting and no human work, leaving standing to the pages that read the server (as built)
B. B. Read each PRD's standing from the server at push time and send it with the rows
C. C. Send the person questions as human work now, and leave the standing for later

## What I had to decide

Whether a product roadmap's push should already carry each PRD's standing and the unanswered person questions, as a git-born roadmap's does.

## What I did meanwhile

The kit sends state waiting, no waits-on line and no dates for each row, answers null for each question and leaves humanWork out, so the database keeps any human work it already has. A product PRD has no feature branch in this checkout to read, and the pages that show standing are the next slices.

## What it costs to change later

A constant in the body builder in the kit's roadmap push file, plus a read of each PRD's standing from the server; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a server-born roadmap's rows carry a standing at push time or are read when the page opens.

```

<!-- /omni-outbox-settled: s2-01-product-roadmap-rows-wait -->

<!-- omni-outbox-settled: s2-02-product-check-by-dry-run-push -->

## s2-02-product-check-by-dry-run-push — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-product-check-by-dry-run-push
prd: 2011
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

How does the terminal learn which repositories belong to a product when it checks a roadmap, and who refuses a row outside the product?

## The decision, in plain words

The terminal asks the same roadmap route that takes a push, with a flag that writes nothing, and gets back the product's repositories. The route also refuses a row naming a repository outside the product, by name, so the rule holds even from a kit that skips the check.

## The intro, for fun

To ask who is in the product, knock on the door that already exists.

## The punchline, for fun

One door, two doors' worth of answers, and nothing written.

## The options, in plain words

A. A. Reuse the roadmap route with a check flag that writes nothing (as built)
B. B. Add a read of a product's repositories by key to the shared client and the products routes
C. C. Let the targets read take a key as well as a name, and use it

## What I had to decide

Whether to add a dedicated read for a product's repositories, which also needs a call added to the kit's shared client outside this slice, or to reuse the roadmap route with a check flag.

## What I did meanwhile

The roadmap route takes check: true and answers the product's repositories in short names without writing; the same route refuses a row outside the product with a 400 naming it. The existing targets read answers by product name, not key, so it was not used.

## What it costs to change later

A follow-up that moves the check onto its own read is one route and one client method; the body field is read by this route only.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the check reads the product's repositories but not through which call.

```

<!-- /omni-outbox-settled: s2-02-product-check-by-dry-run-push -->
