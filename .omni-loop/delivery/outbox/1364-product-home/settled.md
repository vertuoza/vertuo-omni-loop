# Settled outbox items — PRD 1364

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-old-product-picker-moves-the-link -->

## s1-01-old-product-picker-moves-the-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-old-product-picker-moves-the-link
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Until the old one-product setting is removed, what should happen when someone changes a repository's product the old way?

## The decision, in plain words

Changing it the old way moves the repository's link to the new product and keeps its other links, so the app in use today keeps working and the two never disagree.

## The intro, for fun

Two maps of the same town, and only one of them gets redrawn.

## The punchline, for fun

So every time the old map changes, the new one quietly follows.

## The options, in plain words

A. Mirror every old-style change into the links, and keep the old setting open to every member until landing 3, the option built.
B. Mirror the changes, but make the old setting owner-only now, like the new links.
C. Do not mirror: the old setting changes only the old column, and the links drift until landing 3.

## What I had to decide

How the old single-product setting and the new links stay in step during the expand landing.

## What I did meanwhile

A database trigger copies every change of the old setting into the links: the link to the product it left goes, the one to the new product is added by a person, and a link already there keeps its fields. Any workspace member can still use the old setting, as today, until landing 3 removes it.

## What it costs to change later

One trigger, dropped with the old column in landing 3.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a member, not only an owner, should keep changing a repository's product through the old screen until landing 3 (author)

```

<!-- /omni-outbox-settled: s1-01-old-product-picker-moves-the-link -->

<!-- omni-outbox-settled: s1-02-unlink-refused-while-consumed -->

## s1-02-unlink-refused-while-consumed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-unlink-refused-while-consumed
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

What happens when an owner removes a repository from a product while another repository of that product still depends on it?

## The decision, in plain words

The removal is refused, naming the repository that depends on it, so a product never lists a dependency on a repository it no longer holds.

## The intro, for fun

Pulling the bottom block out of the tower is a bold move.

## The punchline, for fun

The tower now asks you to move the blocks above it first.

## The options, in plain words

A. Refuse the removal and name the repository that depends on it, the option built.
B. Remove it, and silently take it out of every other link's dependencies in that product.

## What I had to decide

Whether taking a repository out of a product is refused, or also removes it from what the other repositories consume.

## What I did meanwhile

Refused, with the dependent repository named; the owner edits that link first.

## What it costs to change later

One check in the remove function; switching to the silent clean-up is a small change of that function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- what the Repositories and approvers tab should offer when the removal is refused (author)

```

<!-- /omni-outbox-settled: s1-02-unlink-refused-while-consumed -->

<!-- omni-outbox-settled: s1-03-business-check-keeps-the-old-default -->

## s1-03-business-check-keeps-the-old-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-business-check-keeps-the-old-default
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

An older database check still expects a repository added later to land in the first product, which this slice stops on purpose. Who updates that check?

## The decision, in plain words

This slice leaves that check alone because it belongs to the third slice's territory, so the database checks of the expand landing stay red on that one line until the third slice rewrites it.

## The intro, for fun

The old rule left, but its farewell card is still pinned to the fridge.

## The punchline, for fun

Someone in the third slice gets to take it down.

## The options, in plain words

A. Leave the business check to the third slice, which owns it, the option built.
B. Edit the business check in this slice, outside its territory, so the landing is green at once.

## What I had to decide

Whether this slice edits the business check outside its territory, or leaves it to the slice the plan gives it to.

## What I did meanwhile

Left to the third slice, which owns the business check: it must drop the assertion that a repository added later points at the first product, or turn it into the opposite.

## What it costs to change later

One assertion in one check; until it changes, the expand landing's database checks are red on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan should have given the business check to this slice (author)

```

<!-- /omni-outbox-settled: s1-03-business-check-keeps-the-old-default -->

<!-- omni-outbox-settled: s1-04-new-check-not-yet-in-ci -->

## s1-04-new-check-not-yet-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-new-check-not-yet-in-ci
prd: 1364
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new check that proves product links is not yet run by the automated checks on pull requests. Who adds it?

## The decision, in plain words

This slice did not touch the workflow file that lists the checks, because it is outside its territory; the check is written and passes locally, and one step in that workflow makes it run on every pull request.

## The intro, for fun

The smoke alarm is unboxed, tested and sitting on the shelf.

## The punchline, for fun

It works best once somebody screws it to the ceiling.

## The options, in plain words

A. Leave the workflow to the wave or a follow-up change, the option built.
B. Widen this slice's territory to the workflow file and add the step here.

## What I had to decide

Where the workflow step that runs the new product-links check gets added.

## What I did meanwhile

Not added: the wave, or a follow-up change, adds one named step to the database workflow for the new check.

## What it costs to change later

One step in one workflow file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- which slice or step of the wave owns workflow changes for new database checks (author)

```

<!-- /omni-outbox-settled: s1-04-new-check-not-yet-in-ci -->

<!-- omni-outbox-settled: s2-01-existing-prds-take-their-product -->

## s2-01-existing-prds-take-their-product — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-existing-prds-take-their-product
prd: 1364
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

The PRDs, fixes and ideas that exist before this change have no product yet. Should they get one?

## The decision, in plain words

Each existing PRD, fix and idea takes its repository's product when the repository is in exactly one, the same rule a new one follows, so a product's home lists its past work from day one.

## The intro, for fun

The new house is ready, but all the old furniture is still in the moving van.

## The punchline, for fun

So every chair goes to the only room it ever fitted.

## The options, in plain words

A. A. Existing PRDs, fixes and ideas take their repository's only product, the option built.
B. B. Leave them with no product; a person files each one on its page.
C. C. Fill in only the PRDs, and leave fixes and ideas with none.

## What I had to decide

Whether the work already on the server takes a product when the change lands, or stays with none until a person sets one.

## What I did meanwhile

The change gives every existing PRD, fix and idea its repository's product when the repository is in exactly one product; today every repository is in one product or none, so each one lands in the product its repository had.

## What it costs to change later

One statement in the change; a later change can set them back to none.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether existing work should be filed under a product automatically, or only by a person (author)

```

<!-- /omni-outbox-settled: s2-01-existing-prds-take-their-product -->

<!-- omni-outbox-settled: s2-02-fixes-and-concepts-take-a-product-too -->

## s2-02-fixes-and-concepts-take-a-product-too — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-fixes-and-concepts-take-a-product-too
prd: 1364
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

The rule that gives a new PRD its product: does it also apply to bug fixes, visual fixes and concepts?

## The decision, in plain words

Yes: a new bug fix, visual fix or concept takes its repository's product by the same rule, without the question, so the product's Bug fixes and Visual fixes tabs can list them.

## The intro, for fun

The guest list was written for the wedding, then the whole family showed up.

## The punchline, for fun

So everyone gets a seat by the same rule, cousins included.

## The options, in plain words

A. A. Every kind takes its repository's only product, the option built.
B. B. PRDs and fixes only; concepts never have a product.
C. C. PRDs only; fixes are filed by a person.

## What I had to decide

Which kinds of work the birth rule gives a product to.

## What I did meanwhile

Every kind takes its repository's only product on its first push; only a PRD can name one among several. Any member can change it on the page, and only an approved PRD is ever locked.

## What it costs to change later

One condition in the change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a concept belongs to a product at all (author)

```

<!-- /omni-outbox-settled: s2-02-fixes-and-concepts-take-a-product-too -->

<!-- omni-outbox-settled: s2-03-prd-product-check-not-yet-in-ci -->

## s2-03-prd-product-check-not-yet-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-prd-product-check-not-yet-in-ci
prd: 1364
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

The new check that proves a PRD's and an idea's product is not yet run by the automated checks on pull requests. Who adds it?

## The decision, in plain words

This slice did not touch the workflow file that lists the checks, because it is outside its territory; the check is written and passes locally, and one step in that workflow makes it run on every pull request.

## The intro, for fun

The second smoke alarm is unboxed, tested and sitting next to the first one.

## The punchline, for fun

It also works best once somebody screws it to the ceiling.

## The options, in plain words

A. A. Leave the workflow to the wave or a follow-up change, the option built.
B. B. Widen this slice's territory to the workflow file and add the step here.

## What I had to decide

Where the workflow step that runs the new PRD product check gets added.

## What I did meanwhile

Not added: the wave, or a follow-up change, adds one named step to the database workflow for the new check, as it did for the product links check.

## What it costs to change later

One step in one workflow file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- which slice or step of the wave owns workflow changes for new database checks (author)

```

<!-- /omni-outbox-settled: s2-03-prd-product-check-not-yet-in-ci -->

<!-- omni-outbox-settled: s3-01-prd-with-no-product-stays-none -->

## s3-01-prd-with-no-product-stays-none — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-prd-with-no-product-stays-none
prd: 1364
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When a PRD has been set to no product, but its repository belongs to exactly one product, whose approvers, claims and personas does it read?

## The decision, in plain words

The PRD's own choice wins: a PRD with no product reads none, so any member approves it, even when its repository belongs to one product. Only a call that names no PRD, or one the server does not hold, falls back to the repository's only product.

## The intro, for fun

The form has a box marked No product, and somebody ticked it on purpose.

## The punchline, for fun

So the server believes the box instead of guessing from the address.

## The options, in plain words

A. A PRD with no product reads none, and any member approves it, the option built.
B. A PRD with no product falls back to its repository's only product, so that product's approvers decide.
C. Fall back only for a PRD born before its repository joined a product, and keep none when a person picked No product.

## What I had to decide

Whether a PRD whose product is none falls back to its repository's only product in the lookups, or stays with none.

## What I did meanwhile

Every lookup that knows its PRD reads that PRD's product, none included; a call without a PRD, or for a PRD the server does not hold, reads the repository's only product, else none.

## What it costs to change later

One line in the shared lookup function; switching to the fall-back changes no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists PRD, then repository, then none, but does not say whether a PRD with no product counts as having answered
- (author) A PRD only has no product in a one-product repository when a person picked No product on its page, or when the repository joined the product after the PRD was born

```

<!-- /omni-outbox-settled: s3-01-prd-with-no-product-stays-none -->

<!-- omni-outbox-settled: s3-02-answer-with-no-product-goes-to-the-first -->

## s3-02-answer-with-no-product-goes-to-the-first — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-answer-with-no-product-goes-to-the-first
prd: 1364
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

When a customer fact answered during a brainstorm finds no product, for a PRD with none or a repository in several products, where is it kept?

## The decision, in plain words

It is kept on the workspace's first product, as an answer in a repository with no product was kept before, because every fact other than a region must belong to a product.

## The intro, for fun

Every letter needs an address, even the ones nobody wrote one on.

## The punchline, for fun

Those go to the first house on the street, like they always did.

## The options, in plain words

A. Keep the answer on the workspace's first product, the option built.
B. Refuse the answer and ask the agent to name the product.
C. Let such facts belong to no product, which changes how facts are stored.

## What I had to decide

Where an answered customer fact that needs a product goes when the lookup finds none.

## What I did meanwhile

The answer takes the PRD's product, else the repository's only product, else the workspace's first product, the fall-back it had before for a repository with no product.

## What it costs to change later

One line in the answer function; facts already kept can be moved by a person on the business page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a lookup with no product behaves as it does today without one; today that is the first product for an answer, so the fall-back was kept, not chosen anew

```

<!-- /omni-outbox-settled: s3-02-answer-with-no-product-goes-to-the-first -->

<!-- omni-outbox-settled: s3-03-lookups-check-not-yet-in-ci -->

## s3-03-lookups-check-not-yet-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-lookups-check-not-yet-in-ci
prd: 1364
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The new check that proves how every lookup finds a product is not yet run by the automated checks on pull requests. Who adds it?

## The decision, in plain words

This slice did not touch the workflow file that lists the checks, because it is outside its territory; the check is written and passes locally, and one step in that workflow makes it run on every pull request.

## The intro, for fun

The third smoke alarm is unboxed, tested and lined up beside the other two.

## The punchline, for fun

The ladder is still in the wave's cupboard.

## The options, in plain words

A. Leave the workflow to the wave or a follow-up change, the option built.
B. Widen this slice's territory to the workflow file and add the step here.

## What I had to decide

Where the workflow step that runs the new lookups check gets added.

## What I did meanwhile

Not added: the wave, or a follow-up change, adds one named step to the database workflow for the new check, as it did for the two checks before it.

## What it costs to change later

One step in one workflow file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) which slice or step of the wave owns workflow changes for new database checks

```

<!-- /omni-outbox-settled: s3-03-lookups-check-not-yet-in-ci -->

<!-- omni-outbox-settled: s3-04-nobody-sends-the-prd-yet -->

## s3-04-nobody-sends-the-prd-yet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-nobody-sends-the-prd-yet
prd: 1364
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The server can now read a PRD's own product when a call names the PRD, but the app and the kit do not send the PRD number yet. Which slice teaches them to?

## The decision, in plain words

The server takes the PRD as an optional extra, so everything deployed keeps working and reads the repository's only product as before; no slice of the plan sends the number yet, so a follow-up change in the app and the kit does.

## The intro, for fun

The new door opens for anyone who says the password.

## The punchline, for fun

Nobody has been told the password yet.

## The options, in plain words

A. Land the server side now with the PRD optional, and send it from the app and the kit in a follow-up, the option built.
B. Add a slice to landing 2 that sends the PRD from the app's routes and the kit.

## What I had to decide

Whether the server change waits for the calls that send the PRD, or lands first with the PRD optional.

## What I did meanwhile

Landed first: the customer voice, the pitch, the constituents and an agent's link accept the PRD number, and without it read the repository's only product. Approvals already know their PRD and read its product now.

## What it costs to change later

One optional parameter per call in the app's routes and the kit's requests, in a later change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives the kit's calls that know their PRD to no slice of landing 2
- (author) until they send it, a PRD in a repository of two products reads no product's claims, personas and pitch from a terminal

```

<!-- /omni-outbox-settled: s3-04-nobody-sends-the-prd-yet -->

<!-- omni-outbox-settled: s4-01-other-readers-see-no-targets -->

## s4-01-other-readers-see-no-targets — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-other-readers-see-no-targets
prd: 1364
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

When a plan repository names a product instead of listing its targets, should every command that reads the targets ask the server, or only the targets command for now?

## The decision, in plain words

Only the targets command asks the server for now. The other commands that read the targets see an empty list when a product is named, until they are taught to ask the server too.

## The intro, for fun

A plan repository that points at a product has a new phone book, but only one person has the number.

## The punchline, for fun

Everyone else is still flipping through an empty page.

## The options, in plain words

A. Only omni targets reads the server; the other readers see no targets with plan.product until a later slice or PRD teaches them.
B. Add a slice to this PRD that makes every reader take the product's targets through the same read and its last copy.
C. Have the other readers refuse plan.product with one line naming omni targets, until they read the server.

## What I had to decide

Whether the board, the next step, PR care, the flow, roadmaps, bug fixes and knowledge copies read a product's targets from the server in this PRD, or later.

## What I did meanwhile

With plan.product, omni targets prints the product's links; the config parses plan.targets as an empty list, so the other readers (kit/bin/commands/board.ts, next.ts, care.ts, flow.ts, kit/lib/roadmap, kit/lib/bug/fixes.ts, kit/lib/knowledge/copies.ts, kit/lib/plan-repo/copy-flow.ts, apps/omni-app/src/retro/targets.ts) behave as with no targets. A config that keeps plan.targets is untouched.

## What it costs to change later

Teaching each reader is one async read through kit/lib/product/targets.ts per command; none of those files is in s4's territory, and most are synchronous today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no slice for the other readers; the spec says 'every reader of the targets (lib/plan-repo/targets.ts and its callers)', whose only caller is omni targets. (author)

```

<!-- /omni-outbox-settled: s4-01-other-readers-see-no-targets -->

<!-- omni-outbox-settled: s4-02-last-read-on-server-errors -->

## s4-02-last-read-on-server-errors — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-last-read-on-server-errors
prd: 1364
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

When should the targets command fall back on the last copy it read: only when the Omni page does not answer at all, or also when it answers with an error of its own?

## The decision, in plain words

The last copy is used when the Omni page does not answer in time or fails on its side. When it refuses (no sign-in, not a member, no such product), the command stops with its reason instead of hiding it behind an old copy.

## The intro, for fun

The page is down, the page is grumpy, or the page says no: only two of those deserve yesterday's list.

## The punchline, for fun

A firm no is still an answer.

## The options, in plain words

A. The copy on a timeout, a network failure or a 5xx; a refusal and a missing sign-in stop with their reason.
B. The copy only on a timeout or a network failure, as the spec words it; a 5xx stops too.
C. The copy on any failure, a refusal and a missing sign-in included, always saying why.

## What I had to decide

Whether a 5xx from the Omni page reads the last copy like a timeout does, and whether a missing sign-in should read it too.

## What I did meanwhile

kit/lib/product/targets.ts reads the copy on a timeout, a network failure or a 5xx; a 4xx stops with the server's reason; no ask.url or no sign-in stops with one line naming what to set.

## What it costs to change later

One condition in kit/lib/product/targets.ts (unanswered) and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names only the 5-second case. (author)

```

<!-- /omni-outbox-settled: s4-02-last-read-on-server-errors -->

<!-- omni-outbox-settled: s4-03-product-targets-call-in-ask-client -->

## s4-03-product-targets-call-in-ask-client — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-product-targets-call-in-ask-client
prd: 1364
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Where should the kit's call that reads a product's targets from the Omni page live?

## The decision, in plain words

It is one more call on the kit's existing Omni page client, beside the other calls, so it shares the sign-in and its renewal. That file is outside this slice's agreed area.

## The intro, for fun

The new call needed a phone, and the only phone in the house sits in the hallway.

## The punchline, for fun

So it borrowed the hallway, one line long.

## The options, in plain words

A. Keep the call on the shared Omni page client, as every other Omni page call is.
B. Move it into the kit's new product module with its own signed-in request, leaving the shared client untouched.
C. Give the shared client one general signed-in read, and build the product calls on it in the product module.

## What I had to decide

Whether readProductTargets stays on the shared ask client (kit/lib/ask/client.ts) or moves into kit/lib/product/ with its own authorized request.

## What I did meanwhile

kit/lib/ask/client.ts gains readProductTargets({ repo, product }), a GET of /api/products/targets; kit/lib/product/targets.ts takes it as a plain function, so moving it later changes one import.

## What it costs to change later

Moving it is a few lines; a copy in kit/lib/product/ would duplicate the token refresh the client already does.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- s5 (omni product import) will need a write call too, and its territory does not name the client either. (author)

```

<!-- /omni-outbox-settled: s4-03-product-targets-call-in-ask-client -->

<!-- omni-outbox-settled: s7-01-picker-reads-after-load -->

## s7-01-picker-reads-after-load — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s7
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-picker-reads-after-load
prd: 1364
slice: s7
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Should the Product choice on a PRD's page be there the moment the page opens, or may it appear a moment later?

## The decision, in plain words

The Product choice appears a moment after the page opens, once it has asked who may change it. Everything else on the page shows as before.

## The intro, for fun

Some guests arrive with the party already started.

## The punchline, for fun

The Product choice walks in half a second late, but it brings the right list.

## The options, in plain words

A. Appear once read: the browser draws the cell after it asks the server, and the first paint is unchanged.
B. Part of the first paint: the server reads the product with the rest of the page, so the cell is there from the start.

## What I had to decide

Whether the Product choice may appear just after the page opens, or must be part of the first paint.

## What I did meanwhile

The page opens as it did before; the Product cell joins the facts row as soon as it has read the PRD's product and the workspace's products. A person who may not change it never sees the cell.

## What it costs to change later

Option B moves the read into the page's server render: it changes the page's route and its view, outside this slice, and the cell's own code stays as is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The select uses the browser's default look: the page's stylesheet was outside this slice, so it has no style of its own yet (author).

```

<!-- /omni-outbox-settled: s7-01-picker-reads-after-load -->

<!-- omni-outbox-settled: s8-01-waiting-on-you-counts-approvals -->

## s8-01-waiting-on-you-counts-approvals — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s8
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-waiting-on-you-counts-approvals
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

On the Products page, what counts as an item waiting on the person reading it?

## The decision, in plain words

Each card counts the product's PRDs that wait on the reader's approval. Open outbox questions are not counted, because the page does not know yet whom each one waits on.

## The intro, for fun

Every card wears a little number, and someone has to decide what it counts.

## The punchline, for fun

For now it counts only the doors that need your key.

## The options, in plain words

A. Count the approval requests waiting on the reader, the option built.
B. Also count the open outbox questions of the PRDs the reader authored.
C. Count everything the Ledger's 'on you' lane shows, once s9 defines it.

## What I had to decide

Which items the per-product 'waiting on you' count adds up.

## What I did meanwhile

Approval requests whose latest request asks the reader with no approval since, of the product's dossiers, read through approval_requests_waiting(); outbox questions and GitHub reviews are left out.

## What it costs to change later

One line in products.service.ts and one more read in products.repository.ts to add another source.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether open outbox questions of the product's PRDs should count as waiting on their author
- (author) whether the Ledger's 'on you' lane (s9) and this count must stay identical

```

<!-- /omni-outbox-settled: s8-01-waiting-on-you-counts-approvals -->

<!-- omni-outbox-settled: s8-02-add-to-a-product-opens-repositories-settings -->

## s8-02-add-to-a-product-opens-repositories-settings — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s8
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-add-to-a-product-opens-repositories-settings
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Where does 'Add to a product' take a person, beside a repository that is in no product?

## The decision, in plain words

It opens the repositories settings page, where a repository is given a product today. Once the product page can add repositories, it can point there instead.

## The intro, for fun

A lonely repository raises its hand, and the button has to know where to send it.

## The punchline, for fun

So it goes to the one door already open, until a nicer one is built.

## The options, in plain words

A. Open Settings › Repositories, the option built.
B. Open a picker of the workspace's products right on the card list.
C. Open the first product's Repositories & approvers tab with the repository filled in.

## What I had to decide

The target of the 'Add to a product' link on /app/products.

## What I did meanwhile

A plain link to /app/settings/repositories (ADD_TO_PRODUCT_HREF in ProductsHome.tsx), the same for every repository.

## What it costs to change later

One constant; s11 owns src/products/ and can repoint it to the product home's Repositories tab.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether s11 should turn it into a picker of the workspace's products in place

```

<!-- /omni-outbox-settled: s8-02-add-to-a-product-opens-repositories-settings -->

<!-- omni-outbox-settled: s8-03-products-first-under-work -->

## s8-03-products-first-under-work — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s8
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-03-products-first-under-work
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

Where does Products sit in the sidebar, and which picture does it carry?

## The decision, in plain words

Products comes first under Work, above Roadmaps, since a product holds the rest of the work. It reuses the existing coin picture until one is drawn for it.

## The intro, for fun

A new tenant moves into the sidebar and asks for the top floor.

## The punchline, for fun

It got the top floor, and a borrowed doorplate for now.

## The options, in plain words

A. First under Work with the coin sprite, the option built.
B. Under Dashboard, beside Workspace.
C. Last under Work, after Knowledge.

## What I had to decide

The Products entry's group, position and sprite.

## What I did meanwhile

First entry of the Work group, path /app/products, sprite 'coin' from @omni/design (a 16 px sprite that already exists).

## What it costs to change later

One line in src/nav/sidebar.ts and its tests; a new sprite is a change in packages/design.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a dedicated 'menu-products' sprite is wanted

```

<!-- /omni-outbox-settled: s8-03-products-first-under-work -->

<!-- omni-outbox-settled: s8-04-two-files-outside-the-territory -->

## s8-04-two-files-outside-the-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s8
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-04-two-files-outside-the-territory
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

The slice had to touch three files its plan row does not list. Is that all right?

## The decision, in plain words

Yes: the list of known layering breaches lives at the repository's root, not under the app, and two tests of the app switcher list every sidebar entry, so they had to change for the checks to stay green.

## The intro, for fun

The map said the treasure was under the app, but it was buried at the root.

## The punchline, for fun

So the shovel went where the treasure actually was.

## The options, in plain words

A. Edit them in this slice, the option built.
B. Leave the settings page's product read as it was so the list of breaches does not change, and leave the two switcher tests to another slice.

## What I had to decide

Whether to change layering/baseline.json, apps/galaxy/src/switch/headers.test.ts and apps/galaxy/src/switch/switch.test.ts, outside the row's territory.

## What I did meanwhile

Removed the load.ts database-call line from layering/baseline.json (the plan names apps/galaxy/layering/baseline.json, which does not exist) and added Products to the sidebar lists in apps/galaxy/src/switch/headers.test.ts and apps/galaxy/src/switch/switch.test.ts.

## What it costs to change later

Nothing to undo: these edits only follow the code this slice changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the plan's territory path for the baseline should be corrected for s11

```

<!-- /omni-outbox-settled: s8-04-two-files-outside-the-territory -->

<!-- omni-outbox-settled: s12-01-fix-lists-take-a-scope -->

## s12-01-fix-lists-take-a-scope — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s12
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-01-fix-lists-take-a-scope
prd: 1364
slice: s12
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

The bug fix and visual fix lists read their own fixes, outside the files this slice may change. How do they get a product filter?

## The decision, in plain words

The shared code behind both lists now accepts an optional narrowing step from the page; the two pages hand it the product filter. Nothing else about those lists changes.

## The intro, for fun

Two lists shared one kitchen, and the new recipe needed one extra door into it.

## The punchline, for fun

So the door was added, small and optional, and only the product filter walks through it.

## The options, in plain words

A. A. An optional narrowing step in the shared list code, handed by each page (built).
B. B. Copy the list's reads into each page so the change stays inside the pages.
C. C. Move the product filter into the fixes module itself, owned by a later slice.

## What I had to decide

Whether the bug fix and visual fix lists may be narrowed through a small optional step added to their shared list code, outside this slice's territory.

## What I did meanwhile

Added an optional third parameter, a FixListScope, to fixListRoute in apps/galaxy/src/fixes/FixListRoute.tsx: it narrows the fixes read and draws what it returns above the list. /bugs and /visual pass productListScope; with no scope the lists behave exactly as before.

## What it costs to change later

A few lines: drop the parameter and the two pages' third argument, or move the filter into the fixes module itself.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory names only the two page files, which only delegate to the shared list code; it does not say whether that code may change.

```

<!-- /omni-outbox-settled: s12-01-fix-lists-take-a-scope -->

<!-- omni-outbox-settled: s12-02-other-filters-drop-the-product -->

## s12-02-other-filters-drop-the-product — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s12
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-02-other-filters-drop-the-product
prd: 1364
slice: s12
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When a person picks a product and then changes another filter on a list (search, mine or all, repository, state), should the product choice stay?

## The decision, in plain words

The product links keep every other filter, but the existing filters, whose forms live outside this slice, do not yet carry the product: changing one of them shows all products again.

## The intro, for fun

The new filter remembers its friends, but its friends have not learned its name yet.

## The punchline, for fun

So picking a repository forgets the product, until the old forms are taught one hidden field.

## The options, in plain words

A. A. The product links keep the other filters; the other filters reset the product (built).
B. B. Teach the history and fix list forms to keep the product too, a follow-up change outside this slice.
C. C. Remember the product choice in a cookie for every list.

## What I had to decide

Whether the existing list filters must carry the product choice, which means changing the history and fix list forms outside this slice.

## What I did meanwhile

The product filter is a row of links above each list, each one the list's address with its other filters kept. The search, Mine or All, repository and state forms in DossierHistory.tsx and FixList.tsx are untouched, so they drop the product parameter.

## What it costs to change later

One hidden product field in each of the two forms and the product kept in their Mine, All and Clear links.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks only for a product filter on each list; it does not say how it combines with the others.

```

<!-- /omni-outbox-settled: s12-02-other-filters-drop-the-product -->

<!-- omni-outbox-settled: s12-03-ideas-filter-lives-on-each-board -->

## s12-03-ideas-filter-lives-on-each-board — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s12
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-03-ideas-filter-lives-on-each-board
prd: 1364
slice: s12
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

There is no single list of all ideas, only one board per repository. Where does the ideas product filter go, and who sees it?

## The decision, in plain words

Each repository's ideas board gets the product filter, shown only to members of its workspace; a visitor of a public board sees the whole board and no product names.

## The intro, for fun

The ideas had no lobby, only a room per repository.

## The punchline, for fun

So every room got its own product switch, hidden from passers-by.

## The options, in plain words

A. A. The filter on each repository's board, for members only (built).
B. B. A new /ideas page listing every idea of the workspace, with the filter.
C. C. Both: the board's filter and a new workspace-wide page.

## What I had to decide

Whether the ideas product filter belongs on each repository's board, members only, or on a new page listing every idea of the workspace.

## What I did meanwhile

On /ideas/<owner>/<repo>, a member reads the products of the board's workspace and which ideas carry one, and the board's lanes are narrowed to all, one product or no product. No /ideas index page was created; the public board reads nothing more for a visitor.

## What it costs to change later

A new page later (app/ideas/page.tsx) can reuse the same filter rules; the board's filter stays or goes with one line in its page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says /ideas stays and gains a product filter, but no /ideas page exists today, only the per-repository boards.

```

<!-- /omni-outbox-settled: s12-03-ideas-filter-lives-on-each-board -->

<!-- omni-outbox-settled: s5-01-two-files-outside-the-territory -->

## s5-01-two-files-outside-the-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-two-files-outside-the-territory
prd: 1364
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

The two new product commands needed two small changes in files outside the area agreed for this piece of work. Is that all right?

## The decision, in plain words

The two new calls to the Omni page sit beside the other calls in the kit's shared page client, as the targets call already does, and the help table's own test now counts one more command.

## The intro, for fun

Two new commands moved in, and both needed a key to the shared front door.

## The punchline, for fun

One key cut, one name added to the doorbell list.

## The options, in plain words

A. A. Keep both calls on the shared Omni page client and count the new command in the help test.
B. B. Move the product calls into the kit's product module with their own signed-in request.
C. C. Give the shared client one general signed-in call and build the product calls on it.

## What I had to decide

Whether importProductTargets and readProductsOf stay on the shared ask client (kit/lib/ask/client.ts), and whether the command count in kit/lib/help/entries.test.ts moves from 51 to 52 in this slice.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

kit/lib/ask/client.ts gains importProductTargets (POST /api/products/import) and readProductsOf (GET /api/products/which), beside readProductTargets from s4 (item s4-03, adopted). kit/lib/help/entries.test.ts counts 52 commands: the help guard fails on any new command without it.

## What it costs to change later

A few lines: the calls move with one import change in kit/bin/commands/product.ts; the count is a constant.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names neither file in s5's territory; s4-03 settled the client for the read, and its gap already foresaw the write.

```

<!-- /omni-outbox-settled: s5-01-two-files-outside-the-territory -->

<!-- omni-outbox-settled: s5-02-import-stops-where-it-is-refused -->

## s5-02-import-stops-where-it-is-refused — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-import-stops-where-it-is-refused
prd: 1364
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When the import is refused halfway, for example because one repository is not known to the workspace, should the links already written stay?

## The decision, in plain words

They stay. The import writes one link at a time and stops at the first refusal, naming it; running it again once the cause is fixed finishes the job and changes nothing it already did.

## The intro, for fun

Halfway through moving house, a box would not fit through the door.

## The punchline, for fun

The boxes already inside stay inside, and the move resumes once the door is wider.

## The options, in plain words

A. A. Write link by link and keep what was written before a refusal; a rerun finishes.
B. B. Write every link in one transaction through a new database function, all or nothing.

## What I had to decide

Whether POST /api/products/import writes all links in one database transaction (a new SQL function) or link by link through product_repository_link(), keeping what was written before a refusal.

## What I did meanwhile

productRepositoriesService.importTargets writes the new links first with nothing consumed, then every link that still differs, through product_repository_link(); the first refusal ends the call with the database's words (403 not an owner, 422 a field or a repository). The kit says 'the import into product <name> stopped' with that reason. A rerun is idempotent.

## What it costs to change later

An all-or-nothing import is one new SQL function and a migration in a later slice; nothing the person sees changes but the half-done state.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the import runs once and a second run changes nothing; it does not say what a refusal halfway leaves.

```

<!-- /omni-outbox-settled: s5-02-import-stops-where-it-is-refused -->

<!-- omni-outbox-settled: s5-03-unknown-repository-is-in-no-product -->

## s5-03-unknown-repository-is-in-no-product — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-unknown-repository-is-in-no-product
prd: 1364
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When a repository is not known to any workspace on the Omni page, should the command that lists its products say none, or say it is unknown?

## The decision, in plain words

It says none, as for a known repository in no product: a repository the page does not know is in no product, and the brainstorm then asks no product question.

## The intro, for fun

A stranger knocks and asks which clubs they belong to.

## The punchline, for fun

None yet, says the doorman, which is true and polite.

## The options, in plain words

A. A. Answer none for a repository no workspace lists, as for one in no product.
B. B. Refuse it with 404 'No workspace of yours lists <repo>', and print that line.

## What I had to decide

Whether GET /api/products/which answers {products: []} or a 404 for a repository no workspace of the caller lists, and so whether omni product which prints none or an error.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

productRepositoriesService.productsOf answers {products: []} when no workspace lists the repository; omni product which prints none and exits 0. The import, by contrast, refuses an unlisted plan repository with 404.

## What it costs to change later

A constant: the service returns the unlisted case as a 404 and the kit prints its reason instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says which prints the products 'or none'; it does not name a repository the page does not know.

```

<!-- /omni-outbox-settled: s5-03-unknown-repository-is-in-no-product -->

<!-- omni-outbox-settled: s9-01-ledger-pr-chips-from-feature-branches -->

## s9-01-ledger-pr-chips-from-feature-branches — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-ledger-pr-chips-from-feature-branches
prd: 1364
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

On a product's Ledger, which pull requests show as the little chips beside each PRD?

## The decision, in plain words

Each PRD shows the open pull requests of its feature branch and of its landings, in any of the workspace's repositories, found by the branch name the loop uses by default.

## The intro, for fun

Every PRD row on the Ledger wants a few badges, and somebody has to pick which ones.

## The punchline, for fun

For now the badges follow the branch name, like ducklings follow the first thing they see.

## The options, in plain words

A. A. Match open pull requests by the default feature branch name and its landings, the option built.
B. B. Read each repository's committed config and match its own feature branch shape.
C. C. Show no PR chips until the stages sync stores each PRD's feature pull request.

## What I had to decide

Where the Ledger's PR chips come from, since the tables the spec names for the Ledger hold no pull request numbers.

## What I did meanwhile

The chips read the stored pull requests (pull_requests) that are open and whose head is feat/<topic> or a landing feat/<topic>-<k>of<n>-<name>, the topic being the one the stages sync learnt for the PRD (prd_topics). Slice pull requests are left out. A repository whose config changes the feature branch shape shows no chips.

## What it costs to change later

One pattern and one read in the product home's service and repository; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's Ledger row asks for PR chips but names only approval_requests, approvals, prd_stages and prd_outbox.waiting, none of which holds a pull request number
- (author) The server does not read each repository's branch shapes for this page, so a repository with a custom feature branch shape shows no chips

```

<!-- /omni-outbox-settled: s9-01-ledger-pr-chips-from-feature-branches -->

<!-- omni-outbox-settled: s9-02-ledger-lanes-and-who-a-prd-waits-on -->

## s9-02-ledger-lanes-and-who-a-prd-waits-on — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s9
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-02-ledger-lanes-and-who-a-prd-waits-on
prd: 1364
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

On a product's Ledger, which lane does each PRD go in, and where does a PRD go that waits on someone other than the reader?

## The decision, in plain words

A PRD waiting for approval or with a question for a person goes in 'on you' only when it waits on the reader; otherwise it sits in no lane and is only counted as waiting on a person. A PRD under review goes in 'on GitHub review', and one being built or ready to build goes in 'on the agent'.

## The intro, for fun

Three lanes, a pile of PRDs, and each one needs to know where to stand.

## The punchline, for fun

If it is waiting on somebody else, it waits quietly in the summary.

## The options, in plain words

A. A. Show only what waits on the reader in 'on you', and count the rest in the summary, the option built.
B. B. Put every PRD waiting on any person in 'on you', naming who it waits on.
C. C. Add a fourth lane, 'on someone else', for PRDs waiting on another person.

## What I had to decide

The rule that places each PRD on the Ledger's three lanes and fills the summary, which the spec names but does not define.

## What I did meanwhile

A server-born PRD with no approval in force waits on its approvers (on you when its request asks you; 'drifted' when a push voided the approval). A PRD whose outbox holds questions for a person waits on its author (on you when you opened it). Else a PRD whose feature PR is ready, or a repository-born PRD whose phase-0 PR is open, is on GitHub review; the rest are on the agent. Shipped PRDs are on no lane. The Ledger tab's count is the 'on you' lane, so it can be higher than the Products card's count, which counts approvals only.

## What it costs to change later

A few lines in the product home's service and its tests; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say where a PRD that waits on another person goes; the three lanes leave no room for it
- (author) Whom an outbox question waits on is not stored; the author is taken, as the waiting list already reads it
- (author) Whether the Products card's waiting count (s8, approvals only) and the Ledger's 'on you' lane must stay identical

```

<!-- /omni-outbox-settled: s9-02-ledger-lanes-and-who-a-prd-waits-on -->

<!-- omni-outbox-settled: s10-01-tab-pages-share-one-address -->

## s10-01-tab-pages-share-one-address — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s10
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-tab-pages-share-one-address
prd: 1364
slice: s10
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The new product tabs need their own web addresses, but the plan gave this piece of work only the screens, not the pages that serve them. Is it fine that one shared page serves all five new tabs?

## The decision, in plain words

One page now serves the Ideas, Roadmap, Bug fixes, Visual fixes and Questions tabs, each at its own address under the product. An unknown tab name shows the not-found page.

## The intro, for fun

Five tabs walked into one doorway and asked who holds the key.

## The punchline, for fun

One doorway, five name tags, and a bouncer for any name not on the list.

## The options, in plain words

A. A. One shared page serves the five tabs, each at its own address, and an unknown name is not found.
B. B. Five pages, one per tab, as the PRDs tab has.
C. C. The tabs open through a query on the product's main page instead of their own addresses.

## What I had to decide

Whether the five new tabs of the product home may share one page outside this slice's planned ground, or each needs a page of its own.

## What I did meanwhile

The five tabs work at their own addresses through the one shared page, and the PRDs tab keeps its own page as before.

## What it costs to change later

Splitting it later into five pages is five small files and deleting one; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives this slice only the product home's code folder, so the page that serves the tabs sits outside its planned ground (author).

```

<!-- /omni-outbox-settled: s10-01-tab-pages-share-one-address -->

<!-- omni-outbox-settled: s11-01-tab-joins-the-product-home-tabs -->

## s11-01-tab-joins-the-product-home-tabs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s11
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-01-tab-joins-the-product-home-tabs
prd: 1364
slice: s11
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The new Repositories & approvers tab has to show in the product page's row of tabs, which another slice of this wave owns. Who adds it there?

## The decision, in plain words

This slice adds the one tab to that row itself, so the tab can be reached from the product page; the other slice adding its own tabs at the same time may have to line the two up when they are merged.

## The intro, for fun

Two crews are hanging signs on the same corridor on the same day.

## The punchline, for fun

One of them will have to slide a sign over a little.

## The options, in plain words

A. A. Add the tab to the product home's tab row in this slice, the option built.
B. B. Leave the tab row to s10, and reach the tab only by its address until then.
C. C. Draw a separate tab row on the new page only, and let the wave join the two later.

## What I had to decide

Whether this slice adds its tab to the product home's tab row (src/product-home/ProductHome.tsx and its render test), outside its territory, or leaves it to s10 or the wave.

## What I did meanwhile

Exported productHomeTabs() from apps/galaxy/src/product-home/ProductHome.tsx and appended { href: /app/products/<id>/repositories, label: 'Repositories & approvers' } to it; apps/galaxy/src/product-home/product-home.render.test.ts expects the third tab. The tab's page draws the same row from productHomeTabs(). s10 (same wave) adds its own tabs to that function, so merging the two sub-PRs may need the array lined up by hand.

## What it costs to change later

One line in one array, plus one line in its test; moving it later is a cut and paste.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives src/product-home/ to s9 and s10 only, and does not say which slice wires the Repositories & approvers tab into the product home's tab row.

```

<!-- /omni-outbox-settled: s11-01-tab-joins-the-product-home-tabs -->

<!-- omni-outbox-settled: s11-02-add-to-a-product-opens-the-tab -->

## s11-02-add-to-a-product-opens-the-tab — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s11
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-02-add-to-a-product-opens-the-tab
prd: 1364
slice: s11
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

On the Products list, where should 'Add to a product' take a repository that is in no product, now that the old settings page no longer picks a product?

## The decision, in plain words

It opens the product's Repositories & approvers tab with that repository already picked: straight to it when the workspace has one product, from a short list of products when it has several, and to the products settings, to make one, when it has none.

## The intro, for fun

The old signpost pointed at a road that was just closed.

## The punchline, for fun

So it now points at the right door, with the key already in the lock.

## The options, in plain words

A. A. Open the product's tab with the repository picked, choosing the product from a list when there are several, the option built.
B. B. Always open a single page that asks which product, then adds the repository there.
C. C. Link to the first product's tab only.

## What I had to decide

Where the Products list's Add to a product link goes once Settings › Repositories drops its product select (settled item s8-02).

## What I did meanwhile

In apps/galaxy/src/products/ProductsHome.tsx, Add to a product links to /app/products/<id>/repositories?add=<repo> for the only product, opens a list of the products (a details element) when there are several, and links to /app/settings/products when there is none. The tab's Add a repository starts on the ?add= repository. A member who follows it lands on the tab read only.

## What it costs to change later

One small component and one query parameter; another target is a change of its links.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says only that repositories in no product are listed 'each with Add to a product', not where it leads with several products or none.

```

<!-- /omni-outbox-settled: s11-02-add-to-a-product-opens-the-tab -->

<!-- omni-outbox-settled: s11-03-tab-writes-through-its-own-routes -->

## s11-03-tab-writes-through-its-own-routes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s11
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-03-tab-writes-through-its-own-routes
prd: 1364
slice: s11
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

How should the new tab save what an owner changes: repositories added, edited or removed, and approvers set?

## The decision, in plain words

Every change goes through the app's server, under the tab's own address, which checks the sign-in first and lets the database decide who may; the browser no longer writes to the database itself, and a new repository is added with no role yet, to be filled in on its row.

## The intro, for fun

The front desk used to hand out keys to the storeroom.

## The punchline, for fun

Now it fetches what you need and checks your badge on the way.

## The options, in plain words

A. A. Routes under the tab's own address, a new repository added with no role, the option built.
B. B. Routes beside the other product calls the command line makes.
C. C. Ask for the role before adding a repository, in the Add form.

## What I had to decide

Where the tab's writes go (ADR-0095's client, controller, service, repository, inside the slice's territory), and what a freshly added repository's link holds.

## What I did meanwhile

Four routes under apps/galaxy/app/app/products/[id]/repositories/: POST and DELETE links, POST and DELETE approvers (src/product-repositories/repositories-tab.controller.ts), rather than under app/api/products/, which is s4's and s5's ground. The Approvers list's writes moved there too, so src/products/approvers.ts and approvers-load.ts leave the layering baseline. Add a repository writes the link with no role, its own knowledge base, not read only and consuming nothing; the owner then sets its fields and saves the row whole.

## What it costs to change later

Moving the routes under /api is a rename of two folders and of two paths in the contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and ADR-0095 do not say where a page's own write routes live when the plan gives /api/products to other slices.

```

<!-- /omni-outbox-settled: s11-03-tab-writes-through-its-own-routes -->

<!-- omni-outbox-settled: s6-01-push-product-through-shared-client -->

## s6-01-push-product-through-shared-client — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-push-product-through-shared-client
prd: 1364
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The product picked during a brainstorm needed one small change in a file outside the area agreed for this piece of work. Is that all right?

## The decision, in plain words

The product travels with the first upload through the kit's shared Omni page client, beside every other call to the page. The help text describes the new option in words and keeps its usage lines as they were.

## The intro, for fun

The product wanted a seat on the first upload, and the only bus leaves from the shared stop.

## The punchline, for fun

One more seat, same bus, same driver.

## The options, in plain words

A. Add the product to the shared client's upload call, and describe the option in the help text only
B. Give the dossier command its own signed-in upload call that carries the product
C. Add the option to the help usage lines too, changing the help table's own test

## What I had to decide

Whether pushDossier in kit/lib/ask/client.ts gains an optional product field (sent only when given), and whether --product joins the dossier usage lines in kit/lib/help/entries.ts, which kit/lib/help/entries.test.ts pins exactly.

## What I did meanwhile

kit/lib/ask/client.ts: pushDossier takes product and sends it only when set, as s4-03 and s5-01 did for the product calls. kit/lib/help/entries.ts: the dossier entry's detail describes --product <name>; its usage lines are unchanged, so entries.test.ts (outside this slice) still passes.

## What it costs to change later

A few lines: the field moves with the call; adding --product to the usage line is one string and the test's expected list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names neither kit/lib/ask/client.ts nor kit/lib/help/entries.test.ts in s6's territory; s4-03 and s5-01 settled the shared client for the other product calls.

```

<!-- /omni-outbox-settled: s6-01-push-product-through-shared-client -->

<!-- omni-outbox-settled: s6-02-prd-product-line-where-dossiers-are-on -->

## s6-02-prd-product-line-where-dossiers-are-on — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s6
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-prd-product-line-where-dossiers-are-on
prd: 1364
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The PRD lookup now shows a PRD's product. Should it show one in a repository that never sends its PRDs to the Omni page, and what should it say when the page cannot answer?

## The decision, in plain words

The product shows as the lookup's last line only where PRDs go to the Omni page, since that is where a product lives. When the page cannot answer, the line says the product is unknown and why, and the lookup still succeeds.

## The intro, for fun

Asking a PRD which product it belongs to is easy, unless it never met the page that knows.

## The punchline, for fun

So it only answers where the page can hear the question.

## The options, in plain words

A. Show the product line only where PRDs go to the Omni page, last, with unknown and the reason when the page cannot answer
B. Always show a product line, none where PRDs do not go to the Omni page
C. Show the product line right after the state line

## What I had to decide

Whether omni prd <n> prints product: none or nothing where dossier.enabled is false or ask.url is unset; where the line goes; and what it prints when the lookup fails (no sign-in, unreachable, refused).

## What I did meanwhile

kit/lib/dossier/product.ts: productLine() returns null where dossierSwitch() is off (no call is made), else product: <name> | none (404 reads none) | unknown (<why>). kit/bin/commands/prd.ts appends it after every other line; the exit is unchanged. kit/bin/prd.test.ts and every fixture without dossiers keep their exact output.

## What it costs to change later

A constant: printing product: none where dossiers are off, or moving the line, is one condition in kit/lib/dossier/product.ts and kit/bin/commands/prd.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says omni prd prints product: <name> or product: none, and says nothing of a repository with dossiers off, of an unreachable page, or of where the line goes.

```

<!-- /omni-outbox-settled: s6-02-prd-product-line-where-dossiers-are-on -->

<!-- omni-outbox-settled: s13-01-products-page-updates-the-docs-tests -->

## s13-01-products-page-updates-the-docs-tests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s13
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s13-01-products-page-updates-the-docs-tests
prd: 1364
slice: s13
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

The guide gets a new Products page, but the two tests that list every page of the guide live outside this slice's agreed area. Should the page be added anyway?

## The decision, in plain words

Yes: the Products page sits after Drive the loop and leads to Several repositories, and the two tests that list the guide's pages now count sixteen and name it, so the checks stay green.

## The intro, for fun

A new page walked into the guide's table of contents.

## The punchline, for fun

The table's guest list had to be reprinted to let it in.

## The options, in plain words

A. A. Add the page after Drive the loop and update the two docs tests, the option built.
B. B. Put the products text inside Several repositories and the index, with no new page and no test change.
C. C. Add the page elsewhere in the order, such as after Ideas board.

## What I had to decide

Whether a slice that adds a guide page may change the tests that pin the guide's list of pages, and where the page sits in the guide's order.

## What I did meanwhile

Added products.md to meta.json after drive, with its Next link to several-repositories; apps/galaxy/src/docs/guide.test.ts and docs.test.ts list it (order, titles, Next links, sidebar, page count sixteen) and guide.test.ts gains one test of what the page and several-repositories.md say.

## What it costs to change later

A constant: moving the page in the order is a one-line change to meta.json and the same lists in the two tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether readers would rather find Products after Several repositories or near Ideas board (author)

```

<!-- /omni-outbox-settled: s13-01-products-page-updates-the-docs-tests -->

<!-- omni-outbox-settled: s14-02-business-open-links-repositories -->

## s14-02-business-open-links-repositories — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-10
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-10
- Slice: s14
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s14-02-business-open-links-repositories
prd: 1364
slice: s14
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

When a workspace opens its business for the first time, should its repositories still be put in the first product, now that products are optional?

## The decision, in plain words

Yes: opening the business still puts every repository that is in no product into the first product, as it did before, now as a link.

## The intro, for fun

The first product opens its doors and every stray repository walks in.

## The punchline, for fun

Same welcome as before, just with a guest list now.

## The options, in plain words

A. Link every repository in no product to the first product, as before, the option built.
B. Link nothing: a workspace's repositories stay in no product until someone links them.

## What I had to decide

What business_open() does with the workspace's repositories once it can no longer write repositories.product_id.

## What I did meanwhile

It links each repository of the workspace that has no link to the first product (added_by person), which is what the column write did through the s1 trigger.

## What it costs to change later

One statement in business_open(); a later migration can remove it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the spec's rule that a new repository gets no product was meant to cover opening the business too (author)

```

<!-- /omni-outbox-settled: s14-02-business-open-links-repositories -->
