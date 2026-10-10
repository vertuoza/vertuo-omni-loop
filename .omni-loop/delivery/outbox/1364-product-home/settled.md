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
