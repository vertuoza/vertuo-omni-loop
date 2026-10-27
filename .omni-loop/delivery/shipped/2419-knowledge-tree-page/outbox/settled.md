# Settled outbox items — PRD 2419

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-owners-of-records-and-defaults -->

## s1-01-owners-of-records-and-defaults — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1
- Became: BR-PRODUCTKNOWLEDGE-1, P-PRODUCTKNOWLEDGE-1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-owners-of-records-and-defaults
prd: 2419
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

The spec says a page's owner is its owner line, else the repository's law owners. Who owns a page read from the plan repository, a page that still reads the kit default, and a decision record, which has no owner line?

## The decision, in plain words

Each page and decision record is owned by the law owners of the repository it is read from, and a page still on the kit default by the repository's own law owners, since writing it is theirs. Only the law owners are named, not their delegates.

## The intro, for fun

Every page has a parent, even the ones the kit left on the doorstep.

## The punchline, for fun

The kit's pages go to the house that would have to write them.

## The options, in plain words

A. Each page and record is owned by the law owners of the level it is read from; a kit default page by the repository's; owners only, the option built.
B. Every page and record shown for a repository is owned by that repository's law owners, whatever level it is read from.
C. As the first option, and each law owner's delegate is named beside them.

## What I had to decide

Who the Repositories section names as the owner of a plan repository page, a kit default page and a decision record.

## What I did meanwhile

Owners come from the level a page or record is read from, the kit default from the repository, law owners only: a rule in one function of the tree's page reader, no stored data.

## What it costs to change later

A few lines in the page reader and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a law owner's delegate should be named beside them (author)

```

<!-- /omni-outbox-settled: s1-01-owners-of-records-and-defaults -->

<!-- omni-outbox-settled: s1-02-which-repositories-get-a-card -->

## s1-02-which-repositories-get-a-card — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1
- Became: BR-PRODUCTKNOWLEDGE-2, P-PRODUCTKNOWLEDGE-2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-which-repositories-get-a-card
prd: 2419
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Which repositories does the Repositories section list, and where does it sit in the Knowledge sub-menu?

## The decision, in plain words

The section lists the repositories linked to the product, by name, and shows the plan repository only as the level its pages come from, unless it is linked too. It sits after Pitch and before Settings.

## The intro, for fun

The plan repository is the quiet neighbour who lends every house its tools.

## The punchline, for fun

It gets a mention on every porch, and a porch of its own only if it moves in.

## The options, in plain words

A. Linked repositories only, the plan repository as a level; the section between Pitch and Settings, the option built.
B. The plan repository gets a card of its own too, first, even when it is not linked to the product.
C. Linked repositories only, and the section last in the sub-menu, after Settings.

## What I had to decide

Whether the plan repository gets a card of its own in the Repositories section when it is not linked to the product, and where the section sits in the sub-menu.

## What I did meanwhile

Only linked repositories get a card; Repositories sits between Pitch and Settings: a list and an order in two constants, no stored data.

## What it costs to change later

One list and one position in the section model and the sub-menu's keys.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether people look for the plan repository's own playbook on this page rather than on its own product (author)

```

<!-- /omni-outbox-settled: s1-02-which-repositories-get-a-card -->

<!-- omni-outbox-settled: s3-01-write-for-repository-link -->

## s3-01-write-for-repository-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-27
- Slice: s3
- Wave: 2
- Stays here: A local, interim implementation choice for one link with a cheap follow-up; it sets no lasting guarantee or architectural decision worth keeping in the knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-write-for-repository-link
prd: 2419
slice: s3
rank: medium
bears-on: none
raised: 2026-10-27
wave: 2
---

## The question, in plain words

The Write it for this repository link opens a blank new page in the repository, not one that starts from the text the page reads today. Is that enough for now?

## The decision, in plain words

The link opens GitHub's new-file page on the repository's own path for that page, so the person proposes it as a pull request. It does not carry the text the page reads today, because the section's model does not hold page text.

## The intro, for fun

A blank page is a fine start, but a head start is better.

## The punchline, for fun

Copying the text over would save one paste.

## The options, in plain words

A. A. A link to an empty new file at the repository's own path, as built.
B. B. A follow-up slice that adds each page's text to the model and starts the file from it.

## What I had to decide

Carrying the text needs the section's model (repositories-section) to hand each page's text to the view, which is outside this slice. Take the link as built, or ask for a follow-up slice that adds the text to the model and to the link.

## What I did meanwhile

The link opens an empty file at the right path in the repository; the person pastes the text from the page they read.

## What it costs to change later

One small follow-up slice: the model gains each page's text, the link gains a value parameter.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The pull request does not start from the text the page reads today (author)
- GitHub's new/HEAD address is assumed to open the repository's default branch (author)

```

<!-- /omni-outbox-settled: s3-01-write-for-repository-link -->
