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
