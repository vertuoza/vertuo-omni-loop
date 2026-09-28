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
