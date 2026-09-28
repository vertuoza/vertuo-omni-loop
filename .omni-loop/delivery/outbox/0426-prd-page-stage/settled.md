# Settled outbox items — PRD 426

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-prd-topic-before-phase-0-merges -->

## s1-01-prd-topic-before-phase-0-merges — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-prd-topic-before-phase-0-merges
prd: 426
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Before its spec is approved, a PRD has no folder on the main branch yet, so the page cannot tell which branch names belong to it. How should the page find them?

## The decision, in plain words

The page looks through the repository's recent pull requests for the spec pull request that names the PRD by its number, and takes the branch name from it. When none names it, the page says nothing is there yet.

## The intro, for fun

A PRD with no folder yet is a house with no street number.

## The punchline, for fun

So the page asks the neighbours: the pull request that mentions it by name.

## The options, in plain words

A. A: find the spec pull request by the PRD's link line in its description (built)
B. B: show no Approve spec button before the spec is approved, only Spec being written
C. C: store the topic in the dossier when the kit pushes the spec, which needs a migration

## What I had to decide

Whether finding the PRD's spec pull request by the number written in its description is good enough before the spec is approved.

## What I did meanwhile

The page scans the latest hundred pull requests once a minute at most, and shows the PRD stage with its Approve spec button when it finds one.

## What it costs to change later

A constant: the fallback is one function in the reader; removing it leaves the stage as PRD with Spec being written until the spec is approved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the feature branch's inbox as a third place, which needs the topic already known, so it was not used (author).

```

<!-- /omni-outbox-settled: s1-01-prd-topic-before-phase-0-merges -->

<!-- omni-outbox-settled: s1-02-one-failed-read-makes-stage-unknown -->

## s1-02-one-failed-read-makes-stage-unknown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-one-failed-read-makes-stage-unknown
prd: 426
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When GitHub answers most questions about a PRD but fails on the one that decides its stage, should the page still show a stage?

## The decision, in plain words

The page shows the stage as unknown whenever a read it needs to decide the stage failed, and still lists the links it could read. A stage already decided by a later read, like the retro, is shown.

## The intro, for fun

Half an answer from GitHub is still half a question.

## The punchline, for fun

The page would rather say it does not know than guess the wrong stage.

## The options, in plain words

A. A: unknown when a deciding read failed, links kept (built)
B. B: treat a failed read as none yet and show the stage it gives

## What I had to decide

Whether a partly read PRD shows unknown, or the stage worked out from what was read.

## What I did meanwhile

A PRD whose feature or retro read failed shows Stage unknown for up to a minute, until the next read.

## What it costs to change later

A constant: one rule in the stage function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No figure on how often a single GitHub read fails while the others answer (author).

```

<!-- /omni-outbox-settled: s1-02-one-failed-read-makes-stage-unknown -->

<!-- omni-outbox-settled: s2-01-unreadable-outbox-means-unknown -->

## s2-01-unreadable-outbox-means-unknown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-unreadable-outbox-means-unknown
prd: 426
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

While a PRD is being built, the page picks between Answer the outbox and Review and merge by looking at the open decisions. What should the header say when those decisions could not be read from GitHub?

## The decision, in plain words

The header says the stage is unknown, as it already does when any other part it needs could not be read, rather than offering Review and merge while a question might still be open.

## The intro, for fun

The page peeked into the outbox and found the lights off.

## The punchline, for fun

So it says it does not know, instead of waving everyone through.

## The options, in plain words

A. A. Unknown: the header names no stage until the outbox can be read again, within a minute.
B. B. Show the outbox stage with no button and the being-built caption, never Review and merge.
C. C. Ignore the failure and show the button as if nothing were open.

## What I had to decide

Whether an outbox read that failed should make the outbox stage unknown, or fall back to the button the page would show with nothing open.

## What I did meanwhile

Made the stage unknown when the outbox could not be read, consistent with the rule the stage already follows for the issue and pull requests. The Outbox tab says GitHub did not answer.

## What it costs to change later

One line in the stage function and one test; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often a single outbox read fails while the pull requests read fine, in practice (author).

```

<!-- /omni-outbox-settled: s2-01-unreadable-outbox-means-unknown -->

<!-- omni-outbox-settled: s2-02-how-outbox-items-read-on-the-page -->

## s2-02-how-outbox-items-read-on-the-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-how-outbox-items-read-on-the-page
prd: 426
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The Outbox tab shows a recommendation for each open decision and a title for each settled one, but the decision files carry nothing by those names. What should the page show there?

## The decision, in plain words

The recommendation is the decision the agent took meanwhile, in plain words, and a settled decision is titled by its question in plain words. The answer link opens the numbered outbox comment first, then the older one, then the feature pull request.

## The intro, for fun

The page was asked for a recommendation and a title, and the files had neither.

## The punchline, for fun

So it borrowed the words the agents had already written.

## The options, in plain words

A. A. Use the decision in plain words as the recommendation and the question as the title, as built.
B. B. Use option A's text as the recommendation and the item's name as the title.
C. C. Show the whole decision file for each item.

## What I had to decide

Which part of an outbox item stands for the recommendation, which part titles a settled entry, and which outbox comment the answer link opens when both exist.

## What I did meanwhile

Recommendation = the decision in plain words; settled title = the question in plain words, else the item id; answer link = the comment carrying the numbered outbox marker, else the plain outbox marker, else the feature PR. An item file that does not parse is left off the list and logged.

## What it costs to change later

A few lines in the view and the reader; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reader expects the recommendation to be option A's text rather than the decision sentence (author).
- Whether a malformed item should appear on the tab as unreadable instead of being left off (author).

```

<!-- /omni-outbox-settled: s2-02-how-outbox-items-read-on-the-page -->
