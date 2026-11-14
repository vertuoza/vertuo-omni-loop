# Settled outbox items — PRD 2873

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-ultra-refusal-words -->

## s1-02-ultra-refusal-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-ultra-refusal-words
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

What should the Runners page say when someone sends a multi-repository build from a repository that has no plan repository to point to?

## The decision, in plain words

It says the build runs from a product's plan repository and that this repository is no product's plan repository. When the repository's product has a plan repository, it names it instead, and names each one when several products hold the repository.

## The intro, for fun

Sometimes there is no plan repository to send the person to.

## The punchline, for fun

No map, so the sign just says you are not at the harbour.

## The options, in plain words

A. A. Say the repository is no product's plan repository, and name every plan repository of the products that hold it (built).
B. B. Also tell the person where to set a product's plan repository, in Products › Repositories.
C. C. Name only the first plan repository when several products hold the repository.

## What I had to decide

The spec gives the words when the product has a plan repository (send it from that repository) but not when it has none, or when the repository is in no product, or in several products with different plan repositories. I also had to pick how the refusal is classed: I classed it with the other refused lines (a 400), as a repository's own skill it does not allow is.

## What I did meanwhile

Built the three cases: one plan repository named, several named with 'or' in name order, or the line saying the repository is no product's plan repository. Nothing is queued in any of them, from the page or from an API key.

## What it costs to change later

A constant: the words are one function in the service, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec gives the words for a product with a plan repository; the other cases follow them.

```

<!-- /omni-outbox-settled: s1-02-ultra-refusal-words -->

<!-- omni-outbox-settled: s1-03-fixed-names-kept-rows -->

## s1-03-fixed-names-kept-rows — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-fixed-names-kept-rows
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

Should a repository's own runner skill that an owner allowed under a name the loop now uses for itself be removed?

## The decision, in plain words

No: such an allowance stays stored as it is. It can never run, since a line naming one of the loop's own skills without its prefix is refused on the server and on the runner.

## The intro, for fun

Seven names joined the loop's own list, and someone may have used one first.

## The punchline, for fun

The old key stays on the hook; it just opens nothing now.

## The options, in plain words

A. A. Keep the rows; they never run (built).
B. B. Delete them in the migration.

## What I had to decide

The database's list of the loop's own skills grew by seven names. A repository could have allowed a skill of its own under one of them before. The spec does not say whether those allowances are removed.

## What I did meanwhile

The migration changes the list and no row. Such a row can no longer be switched off from Settings, which refuses a name of the loop's own, so it stays until a migration removes it.

## What it costs to change later

A constant: a later migration could delete those rows in one statement.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any workspace holds such a row today (author): I could not read the production database from here.

```

<!-- /omni-outbox-settled: s1-03-fixed-names-kept-rows -->

<!-- omni-outbox-settled: s1-04-skills-proof-later-names -->

## s1-04-skills-proof-later-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: BR-PRODUCT-140
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-skills-proof-later-names
prd: 2873
slice: s1
rank: medium
bears-on: BR-PRODUCT-140
raised: 2026-11-14
wave: 1
---

## The question, in plain words

May the test that proves a repository's own runner skills never take one of the loop's own names leave out the three new names, as it already leaves out the four added after it?

## The decision, in plain words

Yes: that test reads the first version of the database's list, which never held the new names, so it now leaves them out the way it leaves out the four added later. A new test holds the database's newest list equal to the app's whole list, the new names included.

## The intro, for fun

An old test checks an old list, and the list just grew again.

## The punchline, for fun

The first page of the guest book stays as it was signed.

## The options, in plain words

A. A. Leave the three new names out of the old test too, and check the newest list in a new test (built).
B. B. Rewrite the old test to read the newest migration itself, replacing the new test.

## What I had to decide

The test of the first migration that made the database's list compares it with the app's list minus the skills added later. Runners now take three more skills, so without a change it fails, though nothing it guards changed. The file is one of the proofs of a proposed rule, so a change to it is a person's to answer.

Decided by: Jev (hardToRevert 0.64) · agent said true

## What I did meanwhile

Added the three ultra skills to the names that test leaves out, with a comment naming the migration that adds them. The new test in its own file checks the newest list whole, so the database's list cannot fall behind the app's again unseen.

## What it costs to change later

A constant: one list in a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the rule's text is unchanged, and so is every other check of that test.

```

<!-- /omni-outbox-settled: s1-04-skills-proof-later-names -->

<!-- omni-outbox-settled: s1-05-guide-runner-lines -->

## s1-05-guide-runner-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-guide-runner-lines
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

May this part of the work add the three new skills to the guide's list of what a runner takes, though the guide belongs to another part of the same feature?

## The decision, in plain words

Yes: the guide's one sentence listing what a runner takes now names the three new skills too. A test holds that sentence equal to the runner's own list, so without it this part could not go green.

## The intro, for fun

The guide keeps a list, and a test checks it word for word.

## The punchline, for fun

Three new names on the door, before the sign painter arrives.

## The options, in plain words

A. A. Add the three skills to the guide's sentence here, so this part is green on its own (built).
B. B. Leave the guide to slice s2 and let this part stay red until both are merged.

## What I had to decide

The plan gives the guide to slice s2, which says runners take the ultra skills. A test of the arcade's docs holds the guide's sentence on the Runners page equal to the runner's list of skills, so adding the skills to that list here turned the preflight red. Both slices run in the same wave.

## What I did meanwhile

Added the three skills at the end of that one sentence in docs/guide/runners.md, and changed nothing else of the guide. Slice s2 may write the same sentence: the wave meets the two when it merges them.

## What it costs to change later

A constant: one sentence of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether slice s2 rewrites that sentence its own way (author): the two slices run at the same time.

```

<!-- /omni-outbox-settled: s1-05-guide-runner-lines -->
