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

<!-- omni-outbox-settled: s3-01-roadmap-status-words -->

## s3-01-roadmap-status-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-roadmap-status-words
prd: 2011
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

The spec says a product roadmap reads building, held or drifted as a PRD does, but a PRD's page has no such three words. Which words does the roadmap's page show?

## The decision, in plain words

The roadmap page shows its approval as a PRD does (waiting for approval, approved, drifted, voided) and, beside it, one status word: held until it is approved, building once approved with a PRD under way, drifted once its approval no longer holds, approved otherwise.

## The intro, for fun

Three words were promised, and the dictionary had only the idea of them.

## The punchline, for fun

Held, building, drifted: now they mean something.

## The options, in plain words

A. A. Status word derived from the approval and the PRDs' states, shown beside the approval's words (as built)
B. B. Approval's own words only, with no status word
C. C. A status word kept on the roadmap by the loop's ticks

## What I had to decide

Read held as not approved, building as approved with a PRD of it under way, and drifted as a drifted or voided approval.

## What I did meanwhile

The status word is one small function with its own tests, shown beside the approval's own words, so changing it touches nothing else.

## What it costs to change later

One function and its tests, and a line of the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the three words but not their meaning.

```

<!-- /omni-outbox-settled: s3-01-roadmap-status-words -->

<!-- omni-outbox-settled: s3-02-roadmap-page-ground-beyond-territory -->

## s3-02-roadmap-page-ground-beyond-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-roadmap-page-ground-beyond-territory
prd: 2011
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

To show a roadmap born on the server, a few shared files outside the slice's listed ground had to change. Is that acceptable, or should they be a slice of their own?

## The decision, in plain words

The roadmap reads, the Gantt, the approval check, the seal drawing and the dossier page's redirect were adjusted so that a roadmap with no repository and no issue, and a product's PRD id, read and draw correctly. Each change is small and keeps every existing test.

## The intro, for fun

The page needed a new door, and the walls had a few extra hinges.

## The punchline, for fun

Same house, a handful of hinges moved.

## The options, in plain words

A. A. Make the small changes in place and test them (as built)
B. B. Move them into a separate preparatory slice
C. C. Copy the shared code into the slice's own folders

## What I had to decide

Change the roadmap reads and the approval check outside the listed folders, keeping each change minimal and covered by tests, rather than stop the slice.

## What I did meanwhile

Every existing test passes unchanged except where a signature gained a nullable field; the seal drawing and the approval judgement are now shared with the PRD page instead of copied.

## What it costs to change later

Moving the changes into a slice of their own is a rebase of a few files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists three folders for this slice and the roadmap reads sit in a fourth.

```

<!-- /omni-outbox-settled: s3-02-roadmap-page-ground-beyond-territory -->

<!-- omni-outbox-settled: s4-01-product-roadmap-read-command -->

## s4-01-product-roadmap-read-command — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-product-roadmap-read-command
prd: 2011
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

The drive skills now tell the agent to read a product roadmap's rows from the server, but the command that reads one does not exist yet. Who adds it, and in which slice?

## The decision, in plain words

The drive and mega-drive skills name a read of a product roadmap's file from the server, the same way a product PRD's plan is read. The command that does it is not built, because the commands are outside this slice, so the skills describe it ahead of the code.

## The intro, for fun

The skill learned to ask for the roadmap before anyone taught the shop to hand it over.

## The punchline, for fun

A recipe is ready, the pantry is still being stocked.

## The options, in plain words

A. A. Name the read in the skills now and add the command later (as built)
B. B. Add the read to the command in a follow-up slice of this landing
C. C. Have drive read the roadmap through its own new command instead

## What I had to decide

Add a roadmap read to omni dossier get (and the app route behind it) in a slice that owns the kit commands, or change the skills to name another read.

## What I did meanwhile

The skills are written and tested as text. A drive of a product roadmap cannot run end to end until the read exists; a roadmap born in git is unchanged.

## What it costs to change later

Small: one more kind accepted by the existing get command and one route that returns the latest roadmap file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which slice or landing owns the read command (author)

```

<!-- /omni-outbox-settled: s4-01-product-roadmap-read-command -->

<!-- omni-outbox-settled: s4-02-product-roadmap-drive-unread -->

## s4-02-product-roadmap-drive-unread — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-product-roadmap-drive-unread
prd: 2011
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

Driving a product roadmap needs one command that reads its rows from the server, and no slice of this plan builds it. Should it be built now, before landing 1 goes ready, or later?

## The decision, in plain words

Landing 1 ships the product roadmap's page, its push and the skills that name the read, but a drive of a product roadmap cannot run end to end until the read exists; nothing else is held.

## The intro, for fun

The map is drawn and the driver is ready, but nobody built the glovebox it lives in.

## The punchline, for fun

One small read stands between the roadmap and the road.

## The options, in plain words

A. A. Leave it to a follow-up PRD or bug fix; landing 1 ships without a working product roadmap drive (as built)
B. B. Add a slice to landing 1 for the read, and approve the changed plan again on the PRD page
C. C. Build it in landing 3's finish, as part of this PRD, without changing the plan

## What I had to decide

Whether to build the missing read (the kit's dossier get and the server's get route taking a roadmap id) inside this PRD, which needs a slice the approved plan does not have, or leave it to a follow-up.

## What I did meanwhile

Nothing was built for it. The drive skills say a product roadmap's rows are read with omni dossier get <key>-R<n> roadmap, which today refuses that kind.

## What it costs to change later

A small kit and server change: the product-PRD id parser, the dossier get command and the get route learning the roadmap kind and the R ids.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether acceptance criterion 1's drive line counts as met without the read (author).

```

<!-- /omni-outbox-settled: s4-02-product-roadmap-drive-unread -->

<!-- omni-outbox-settled: s1-04-push-rule-keeps-versions -->

## s1-04-push-rule-keeps-versions — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-10-16T05:29:23Z
- Channel: feature pull request #2012
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2012#issuecomment-6208790553
- Basis: stated — the answer is settled as "drifted" because a human said so, not because a comparison read it
- Closed: yes — reworked by #2071, the sub-pull request that brought the build back in line
- Stays here: the answer decides when the rule is reworded, not what is true; its rework rewords BR-PRODUCT-81 in the rules register itself
- Rank: high
- Bears on: BR-PRODUCT-81
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
B. Reword the rule now, in a change of its own
```

### The item, as it was raised

```text
---
id: s1-04-push-rule-keeps-versions
prd: 2011
slice: s1
rank: high
bears-on: BR-PRODUCT-81
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The rule that any member may push a roadmap, replacing its document and rows, now also covers roadmaps born on the server, which keep every push as a version: who rewords the rule, and does its proof stay sound?

## The decision, in plain words

A roadmap born on the server is pushed by any member of its workspace, its document and rows replaced and the last pusher recorded, exactly as the rule says, and on top of that each push keeps a version of what changed. The rule's proof gained checks for this, and its old checks are untouched; the rule's words were not changed here.

## The intro, for fun

The rule said replace; the new roadmaps also remember.

## The punchline, for fun

Same rule, longer memory, and the words still to catch up.

## The options, in plain words

A. Keep the rule's words for now and add the versions line when the kit's push lands (as built)
B. Reword the rule now, in a change of its own
C. Leave the rule as it is: replacing the document stays true, and the versions need no rule

## What I had to decide

Whether to reword BR-PRODUCT-81 to say a roadmap born on the server also keeps every push as a version, as the spec asks of the slice that changes it, and who does it: the rules register is outside this slice's territory, so it was left as it is.

## What I did meanwhile

The roadmaps check that proves BR-PRODUCT-81 keeps every check it had and gains a section for product roadmaps: any member pushes one, the roadmap records who pushed last, its rows are replaced, and each push adds a version only of what changed. The rule's text in the product rules register still reads as before, and is still true of every roadmap.

## What it costs to change later

A constant: one line added to the rule's text in the register, in any later change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks that BR-PRODUCT-81 be reworded in the slice that changes its behaviour, but no slice's territory lists the rules register (author)

```

<!-- /omni-outbox-settled: s1-04-push-rule-keeps-versions -->

<!-- omni-outbox-settled: s2-03-rules-84-85-reword-left -->

## s2-03-rules-84-85-reword-left — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-10-16T05:29:23Z
- Channel: feature pull request #2012
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2012#issuecomment-6208790553
- Basis: stated — the answer is settled as "drifted" because a human said so, not because a comparison read it
- Closed: yes — reworked by #2072, the sub-pull request that brought the build back in line
- Stays here: the answer decides when the rules are reworded, not what is true; its rework rewords BR-PRODUCT-84 and BR-PRODUCT-85 in the rules register itself
- Rank: high
- Bears on: BR-PRODUCT-84
- Raised: 2026-10-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
B. B. Reword both rules now, adding the register to a later slice's territory
```

### The item, as it was raised

```text
---
id: s2-03-rules-84-85-reword-left
prd: 2011
slice: s2
rank: high
bears-on: BR-PRODUCT-84
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Two rules about roadmaps now have an exception: a row may name a product's PRD, and a repositories column may sit in a product roadmap. Who rewords them?

## The decision, in plain words

The code now lets a roadmap born on the server name a product's PRD in a row and requires a repositories column naming the product's own repositories. The wording of the two rules in the product rules register was not changed here, since the register is outside this slice.

## The intro, for fun

The code learned the new exception before the rulebook did.

## The punchline, for fun

Same rules, two footnotes still to write.

## The options, in plain words

A. A. Leave the register as it is for now and reword both rules in a change of their own (as built)
B. B. Reword both rules now, adding the register to a later slice's territory
C. C. Leave the rules as they are: they stay true of a roadmap born in git

## What I had to decide

Whether to reword the rule that a row's PRD is in the inbox or shipped folder, and the rule that a repositories column belongs to a plan repository, to name the product roadmap, and who does it.

## What I did meanwhile

Both rules still hold for a roadmap born in git, whose tests pass unchanged. The new behaviour is proved by the product roadmap tests of the kit and of the app.

## What it costs to change later

Two sentences in the rules register, in a change of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each rule is reworded in the slice that changes its behaviour, but the register is outside this slice's territory.

```

<!-- /omni-outbox-settled: s2-03-rules-84-85-reword-left -->

<!-- omni-outbox-settled: s5-01-checks-outside-territory -->

## s5-01-checks-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-checks-outside-territory
prd: 2011
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The new database check for bug records only protects us if the automatic checks run it, and one older check said a product could never have a bug of its own. Who changes those two files, which sit outside this slice's ground?

## The decision, in plain words

This slice made both small changes itself: the automatic checks now run the new bug-records check, and the older check now proves a product still cannot hold a visual fix, instead of a bug, since product bugs are now allowed.

## The intro, for fun

A brand new safety check is useless if nobody ever runs it.

## The punchline, for fun

So it joined the line-up, and an old check stopped arguing with it.

## The options, in plain words

A. Keep both changes as made: the new check runs on every pull request, and the old refusal tries a visual fix (as built)
B. Keep the old check's change but drop the workflow step, so the new check runs only when someone runs it by hand
C. Undo both and let a person add them on the feature branch before it is marked ready

## What I had to decide

Whether s5 may add a step to the supabase workflow and adjust one refusal in product_prd_ids.sql, both outside its territory, or leave them to a person or another slice.

## What I did meanwhile

Added one step to .github/workflows/supabase.yml that runs supabase/checks/fix_rows.sql, as every other check is run. In supabase/checks/product_prd_ids.sql, the refusal 'a product dossier of another kind was written' tried a `bug` dossier on a product, which this migration now allows on purpose; it now tries a `visual` one, which is still refused. Nothing else in either file changed.

## What it costs to change later

A constant: removing the workflow step, or putting the old example back, is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists supabase/checks/fix_rows.sql in s5's territory but not the workflow that runs it, and no slice of landing 2 owns .github/ (author)
- No slice owns supabase/checks/product_prd_ids.sql in this PRD; leaving it unchanged would leave the supabase check red (author)

```

<!-- /omni-outbox-settled: s5-01-checks-outside-territory -->

<!-- omni-outbox-settled: s5-02-fix-row-texts-optional -->

## s5-02-fix-row-texts-optional — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-fix-row-texts-optional
prd: 2011
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

When a bug record is first sent, its fixes may not have a pull request, a reproduction or a guard yet. Must every row carry all three from the start?

## The decision, in plain words

Only the repository and what the fix changes are required. The pull request, the reproduction and the guard can be filled in by a later send, once they exist; a fix that has merged can no longer be moved, dropped or pointed at another pull request.

## The intro, for fun

Bugs rarely arrive with their paperwork done.

## The punchline, for fun

The record waits for the details, but never forgets a merge.

## The options, in plain words

A. Only the repository and the change are required at first; the rest is filled in later, and a merged row is frozen (as built)
B. Every row must carry its pull request, reproduction and guard from the first send
C. Nothing is frozen: a later send may rewrite or drop even a merged row

## What I had to decide

Which of a Fixes row's fields fix_bug_push() requires at the first push, and what a later push may change once a row merged.

## What I did meanwhile

fix_rows requires repository (one of the product's) and changes; pull, reproduction and guard may be null until a later push fills them. A later push rewrites the rows by position: a row whose repository or pull request changes starts open again, and a merged row's place, repository and pull request are refused to change (its words may still change). One pull request sits on one row of a bug at most.

## What it costs to change later

A constant: requiring the reproduction and the guard later is one check in fix_bug_push() and a constraint, in a follow-up migration, before rows exist without them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists a row's fields but not when each must be known; /omni:mega-bug-fix proves the reproduction red before it fixes, so the record may be pushed before either exists (author)

```

<!-- /omni-outbox-settled: s5-02-fix-row-texts-optional -->

<!-- omni-outbox-settled: s5-03-merge-matching-in-database -->

## s5-03-merge-matching-in-database — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-merge-matching-in-database
prd: 2011
slice: s5
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

When a fix's pull request merges, something has to find its row, mark it merged, ship the bug once every fix is in, and remember a merge that matches no row. Does the database do that, or the GitHub App?

## The decision, in plain words

The database does it, through one action only the server may call: it marks the matching rows merged, closed or reopened, says which bug records that merge completed, and keeps a merge that names a bug but matches none of its rows. The App only has to pass on what GitHub told it.

## The intro, for fun

Every fix that merges has to find its own name on the list.

## The punchline, for fun

The database keeps the list, so the App only has to read the news.

## The options, in plain words

A. The database matches, stamps and ships, and keeps unmatched merges; the App passes on GitHub's events (as built)
B. The App matches and decides shipping itself, writing rows through a plainer database action
C. The database stores only the merge time; shipping and unmatched merges are worked out when a page is read

## What I had to decide

Where the matching rule of s7 lives, given that s5 is the only slice of landing 2 that may change the database.

## What I did meanwhile

Built fix_row_stamp(repo, pull, merged|closed|reopened, at, bug?) for the service role alone: a merge stamps merged_at once (a replay keeps the first and ships nothing twice), a close marks an unmerged row closed, a reopen clears it; its answer names each record this merge shipped. A merge matching no row, whose body names a record of a product holding the repository, is kept once in fix_unmatched_merges. Being shipped is read from the rows, never stored: fix_facts carries it in its rows summary, and a product bug's facts show its pull request from the rows.

## What it costs to change later

A constant: the App can match rows itself later and stop calling the function; the table and the function stay, unused, until a follow-up migration drops them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- s7 owns the webhook but has no database ground, so its rule had to be settled here before s7 is built (author)
- Whether a merge whose body names no record at all should be kept anywhere is left out: it is dropped (author)

```

<!-- /omni-outbox-settled: s5-03-merge-matching-in-database -->

<!-- omni-outbox-settled: s6-01-bug-push-touches-two-shared-files -->

## s6-01-bug-push-touches-two-shared-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s6
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-bug-push-touches-two-shared-files
prd: 2011
slice: s6
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

To send a bug record to the Omni page, the command needs a call that the shared sign-in client does not have yet, and a shared helper that was private. Is it fine that this slice touched those two shared files?

## The decision, in plain words

The sign-in client gained one call for bug records, and the private line that words a failed call in the roadmap code was made shareable, so the bug command words its failures the same way. Nothing else in those files changed.

## The intro, for fun

A new road needs a sign, and the sign shop was next door.

## The punchline, for fun

Two borrowed tools, returned unchanged.

## The options, in plain words

A. A. Add the one call and share the helper, leave the help text for a later slice (as built)
B. B. Keep a private copy of the helper in the bug folder, and still add the one call
C. C. Give the bug command its own plain fetch and touch no shared file

## What I had to decide

Whether a slice may add one call to the shared client and share one private helper when its territory lists neither file.

## What I did meanwhile

Added pushBug to kit/lib/ask/client.ts, beside pushRoadmap, and exported callLine from kit/lib/roadmap/product.ts so kit/lib/bug/product.ts reuses it instead of copying it. The help text of omni bug (kit/lib/help/entries.ts) was left as it is, so omni help bug does not yet list check and push.

## What it costs to change later

A constant: moving the call or the helper into the bug folder is a few lines, with a copy of the helper there.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s6 lists neither kit/lib/ask/client.ts nor kit/lib/roadmap/product.ts nor kit/lib/help/entries.ts, yet the push needs the first, the duplication check asks for the second, and omni help would want the third.

```

<!-- /omni-outbox-settled: s6-01-bug-push-touches-two-shared-files -->

<!-- omni-outbox-settled: s7-01-stamp-runs-as-an-app-job -->

## s7-01-stamp-runs-as-an-app-job — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-stamp-runs-as-an-app-job
prd: 2011
slice: s7
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

When a fix is merged, closed or reopened, should the GitHub App record it on the bug through a background job of its own that retries on failure, rather than through the arcade?

## The decision, in plain words

The App records the change through a background job of its own, which writes to the database directly and tries again when the database fails. The arcade's stamp page was not built, and two tests that list the App's jobs now list this one too.

## The intro, for fun

A merge happened, and someone has to write it in the logbook.

## The punchline, for fun

The App holds the pen itself, and tries again if the ink runs out.

## The options, in plain words

A. The App's own background job writes to the database, with retries (as built)
B. The App forwards each change to an arcade route that writes to the database, signed as the stage events are
C. The App writes to the database while it answers GitHub, with no job and no retry

## What I had to decide

Keep the App's own job, or move the write behind an arcade route.

## What I did meanwhile

Built `apps/omni-app/src/fix-rows/` (the event, the service-role call of fix_row_stamp(), the `fix-row-stamp` Inngest function, retried 3 times) and registered it in `functions.ts`. The webhook hands its events to a new `sendStamps`. `apps/galaxy/app/api/fixes/stamp/` was not created. Outside the territory, `apps/omni-app/src/functions.test.ts` and `apps/omni-app/src/outbox-check/inngest-route.test.ts` each gained the new function id and count (eleven functions, sixteen with failure handlers); `apps/omni-app/entries/inngest.ts` still says ten in its header comment.

## What it costs to change later

A constant: the function's step could POST to a galaxy route instead of calling the database; the event and the webhook stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists both `apps/omni-app/src/functions.ts` (register the stamp) and `apps/galaxy/app/api/fixes/stamp/`, and the spec does not say which side writes; s5's note says to call fix_row_stamp() as the service role, which the App already holds.
- (author) Every registered function is listed in two tests outside the territory, so registering one cannot be done inside it.

```

<!-- /omni-outbox-settled: s7-01-stamp-runs-as-an-app-job -->

<!-- omni-outbox-settled: s7-02-which-pull-requests-ask-for-a-stamp -->

## s7-02-which-pull-requests-ask-for-a-stamp — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-which-pull-requests-ask-for-a-stamp
prd: 2011
slice: s7
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

Which closed or reopened pull requests should ask the server to update a bug's fixes: only those into the main branch, those naming a bug, or all of them?

## The decision, in plain words

A pull request asks only when it goes into its repository's main branch, or when its description names a bug record. A fix merged into another branch whose description names no bug is never recorded, and its bug stays open.

## The intro, for fun

Every door that closes could be a fix walking out.

## The punchline, for fun

We only check the front door, and any door with a name tag.

## The options, in plain words

A. Main branch, or a description naming a bug record (as built)
B. Every pull request closed or reopened, whatever its branch, one job each
C. Only a pull request whose description names a bug record

## What I had to decide

Keep the filter, widen it to every pull request, or narrow it to those naming a bug.

## What I did meanwhile

`toFixStampRequests` in `apps/omni-app/src/webhook/webhook.ts` sends one fix stamp event for `pull_request.closed` (merged or not) and `pull_request.reopened` into the default branch, or on any branch when the body has a `Fixes <key>-B<n>` line; a delivery naming no default branch is sent. Each event is one Inngest run, so a sub-PR into its feature branch sends none (#1409). A redelivery of the same change carries the same event id.

## What it costs to change later

A constant: one condition in `toFixStampRequests`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the merge webhook stamps the row whose repository and pull request match, and says nothing of the branch; #1409 stopped sub-PR merges from spending a run each.
- (author) Events of one pull request run as separate jobs, so a close and a reopen seconds apart could land out of order and leave the row shown closed until it merges.

```

<!-- /omni-outbox-settled: s7-02-which-pull-requests-ask-for-a-stamp -->

<!-- omni-outbox-settled: s10-01-ci-runs-pack-checks -->

## s10-01-ci-runs-pack-checks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s10
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-ci-runs-pack-checks
prd: 2011
slice: s10
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The two new database checks for knowledge packs and the plan repository only protect us if the automatic checks run them, and the file that lists them sits outside this slice's ground. Who adds them?

## The decision, in plain words

This slice added both checks to the automatic database checks itself, the same way the bug records slice did, so they run on every pull request.

## The intro, for fun

A safety check nobody runs is just a very tidy wish.

## The punchline, for fun

So both new checks joined the line-up on day one.

## The options, in plain words

A. A. Keep both steps: the new checks run on every pull request (as built)
B. B. Drop the steps and let a person add them on the feature branch before it is marked ready
C. C. Drop the steps and run the checks by hand only

## What I had to decide

Whether s10 may add two steps to the supabase workflow, outside its territory, so the new checks run in CI as the conventions form asks.

## What I did meanwhile

Added two steps to .github/workflows/supabase.yml, after the fix rows step, running supabase/checks/knowledge_packs.sql and supabase/checks/products.sql the way every other check runs. Nothing else in the file changed.

## What it costs to change later

A constant: removing either step is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists both check files in s10's territory but not the workflow that runs them, and no slice of landing 3 owns .github/; the conventions form says a new check runs in CI in the pull request that adds it

```

<!-- /omni-outbox-settled: s10-01-ci-runs-pack-checks -->

<!-- omni-outbox-settled: s10-02-packs-kept-per-workspace -->

## s10-02-packs-kept-per-workspace — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s10
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-02-packs-kept-per-workspace
prd: 2011
slice: s10
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

When a repository's knowledge changes, which teams keep a copy of it, which copy counts as the latest, and how may an agent link read one?

## The decision, in plain words

Each team that has put the repository in one of its products keeps its own copy; the copy of the most recent change counts as the latest, even when an older change arrives later; an agent link reads only its own team's copies, of a repository its team lists or owns.

## The intro, for fun

Two teams, one repository, and a pile of notes that must never wander next door.

## The punchline, for fun

Everyone gets their own copy, and nobody gets the neighbour's.

## The options, in plain words

A. A. One pack per workspace holding the repository in a product, newest by commit date, agent links read their own workspace only (as built)
B. B. Also keep a pack in every workspace that merely tracks the repository
C. C. No agent-link read: packs are read only by signed-in members and kit tokens

## What I had to decide

Where a knowledge pack is kept (every workspace tracking the repository, only those holding it in a product, or one shared row), how the newest pack is chosen (by arrival or by the commit's date), and whether an agent link (a business link) gets a read of its own besides a member's signed-in read.

## What I did meanwhile

knowledge_pack_put() keeps one pack per workspace that links the repository to a product, and none where no product holds it; the newest per workspace and repository is the pack of the latest commit date, so a late webhook for an older commit never takes its place. Members read through row-level security; knowledge_pack_for_token() lets an agent link read only its own workspace's packs, refusing a repository the workspace neither lists nor owns, the same scope business_for_token() checks. supabase/checks/knowledge_packs.sql proves a link of another workspace reads none, and goes red when the workspace filter is removed.

## What it costs to change later

Small while nothing reads packs yet: a follow-up migration that changes knowledge_pack_put() or drops knowledge_pack_for_token(). Once the harvest (s11) and the kit (s12) use them, the readers change with it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a pack is the newest 'for each product link' but not whether a workspace tracking the repository outside any product should get one
- (author) The spec names tokens without saying whether agent links read packs at all; the kit reads as its signed-in member, so the agent-link read is used by nothing yet
- (author) Packs are kept for every commit that touches knowledge, with no pruning; how many to keep is not settled

```

<!-- /omni-outbox-settled: s10-02-packs-kept-per-workspace -->

<!-- omni-outbox-settled: s10-03-archive-holds-split -->

## s10-03-archive-holds-split — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s10
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-03-archive-holds-split
prd: 2011
slice: s10
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Archiving a product's plan repository must be refused while anything still holds it. Which of those holds does the database itself refuse, and which are left to the page that offers the button?

## The decision, in plain words

The database refuses the archive while any repository of the product is below the last step of the rollout ladder, naming each, and lets only an owner archive or undo; the open roadmaps, bug records and PRDs still born in the plan repository are left for the page's server code to check, since only it can see their state.

## The intro, for fun

Locking the old filing cabinet is easy; knowing nobody still keeps papers in it is the hard part.

## The punchline, for fun

The database checks the ladder, and the page checks the drawers.

## The options, in plain words

A. A. The database checks the ladder and the owner; s17's server code checks the open records and that a person pressed it (as built)
B. B. The database checks every hold, after a migration that stores each record's open state
C. C. The database checks nothing but the owner, and s17 checks every hold

## What I had to decide

Whether product_plan_archive() checks every hold the spec names, or only the ones the database can see (the ladder steps), leaving the open records born in the plan repository, and the rule that a person and not an agent presses the button, to s17's server code.

## What I did meanwhile

product_plan_archive() is owner-only, refuses with no plan repository, refuses naming each repository below step 5 (plan-web at step 3, joined by a middle dot), keeps the first stamp when archived twice, and clears it on undo; product_plan_repository_set() is owner-only, takes a repository the workspace lists, and refuses a change while archived. Neither checks open roadmaps, bug records or PRDs, whose open state lives on GitHub, and neither can tell a person's browser session from a kit token acting as that person.

## What it costs to change later

A follow-up migration if the database should check more holds; s17 can add its checks in its own server code at no database cost.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Dossiers and roadmaps carry no open or shipped state in the database, so which records are open in the plan repository is not readable there
- (author) A kit token signs in as its maker, so the database alone cannot refuse an agent pressing the archive

```

<!-- /omni-outbox-settled: s10-03-archive-holds-split -->

<!-- omni-outbox-settled: s14-01-questions-tabs-and-outbox-route -->

## s14-01-questions-tabs-and-outbox-route — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s14
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s14-01-questions-tabs-and-outbox-route
prd: 2011
slice: s14
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Should Work > Questions keep its Shared with me tab beside Inbox, and should Outbox live at its own address?

## The decision, in plain words

The tabs read Inbox, Shared with me, Outbox, History. Outbox has its own page on its own page, and only that page shows how many decisions are open.

## The intro, for fun

Two inboxes walk into a workspace, and one of them is for robots.

## The punchline, for fun

The screen drew three tabs, so one of them had to be moved in with another.

## The options, in plain words

A. A. Four tabs, Outbox on its own page (built).
B. B. Three tabs: Shared with me folded into Inbox, Outbox on its own page.
C. C. Outbox as a query on /ask, no new page.

## What I had to decide

Answer A to keep four tabs and the own-page Outbox; B folds Shared with me into Inbox later, as the drawn screen shows three tabs; C puts Outbox behind a query on the Inbox page instead of a page of its own.

## What I did meanwhile

Built four tabs and an own page for Outbox, so nothing that works today was removed.

## What it costs to change later

A constant and one route: changing the tab list or the address touches a few lines and a redirect.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The count on Outbox shows only on the Outbox page itself (author)
- The demo has no outbox to show, so it reads as not open (author)

```

<!-- /omni-outbox-settled: s14-01-questions-tabs-and-outbox-route -->

<!-- omni-outbox-settled: s14-02-outbox-tab-misses-repository-prds -->

## s14-02-outbox-tab-misses-repository-prds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s14
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s14-02-outbox-tab-misses-repository-prds
prd: 2011
slice: s14
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The new Outbox tab lists the open questions of PRDs that live on a product, but not those of PRDs that live in a repository, whose questions are kept in the repository. Should the tab also list those, so every question sits in one place as asked?

## The decision, in plain words

The Outbox tab shows only product PRDs' open questions; a repository PRD's questions still show on its own pull request and page, not in the shared list.

## The intro, for fun

Everyone was invited to the one big room, but half the guests are still waiting in their own houses.

## The punchline, for fun

One place for every question, minus the ones that live at home.

## The options, in plain words

A. A. List only product PRDs' questions in the Outbox tab for now (as built)
B. B. Also list every repository PRD's open questions in the Outbox tab, in this PRD
C. C. Also list them, in a follow-up PRD

## What I had to decide

Whether Work › Questions › Outbox must also list repository PRDs' open outbox items (read from each repository's outbox folder or its pull request comment) to meet the person's ask to see every question across products in one place, or whether product PRDs alone are enough for now.

## What I did meanwhile

The tab reads only the server's outbox rows. A repository PRD's open items are not listed there; they stay on its feature pull request's outbox comment and its PRD page's Outbox tab.

## What it costs to change later

A read of each tracked repository's open outbox items into the same list, through the App or a synced table; no stored shape changes for product PRDs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether reading repository outbox items needs a new sync table or can reuse what the PRD page's Outbox tab already reads from GitHub (author).

```

<!-- /omni-outbox-settled: s14-02-outbox-tab-misses-repository-prds -->
