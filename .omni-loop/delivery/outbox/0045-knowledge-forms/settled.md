# Settled outbox items — PRD 45

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s4-01-init-lays-down-the-forms -->

## s4-01-init-lays-down-the-forms — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-init-lays-down-the-forms
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Should the one-line install also create the empty knowledge forms, and end by telling people how to fill them?

## The decision, in plain words

Yes. Installing now creates the empty forms, and its last message points to the skill that fills them.

## The options, in plain words

A. The install writes the blank forms after the config and the bin, and its closing steps name the terraform skill.
B. The install stays as shipped. Its closing steps only tell the person to run the forms command, then the terraform skill.
C. The install stays as shipped, and the terraform skill writes the blank forms itself when it runs.

## What I had to decide

PRD 39's `omni init` merged after this spec was first written. The spec had left the installer out of scope, with `omni kb init` as a separate command. Now that `omni init` ships, a repository can be installed without any forms, so the spec has to say whether the install lays them down. This is spec decision 13, added while re-planning and never put to the PRD author.

## What I did meanwhile

The spec (decision 13) and the plan (s4) have `omni init` run the forms writer after the config and the bin, and add a closing step naming `/omni:terraform`. Nothing is built yet: s4 is in wave 4.

## What it costs to change later

Before s4 merges: drop s4's forms step and the closing line from the plan, a few minutes. After it merges: revert s4's commit. Repositories installed in between keep their blank forms, which are harmless.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether `omni init` should stay as small as PRD 39 shipped it: config, bin and labels (author).

```

<!-- /omni-outbox-settled: s4-01-init-lays-down-the-forms -->

<!-- omni-outbox-settled: s4-02-laws-source-from-register-entries -->

## s4-02-laws-source-from-register-entries — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-laws-source-from-register-entries
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Once every install creates the knowledge folder, how should the install decide whether a repository has product rules that bind the agents?

## The decision, in plain words

It looks for at least one written principle, rule or invariant, instead of only checking that the folder exists.

## The options, in plain words

A. The install reads laws from the registers only when they hold at least one principle, rule or invariant.
B. Keep PRD 39's rule, where the folder existing means laws. A reinstall then reads laws from empty registers, which changes nothing until an entry is written.
C. The install stops guessing and always writes none; a person switches it on by hand.

## What I had to decide

PRD 39's `detectLawsSource` returns `knowledge` whenever `.omni-loop/knowledge` exists. A first install detects it before any form is written, so it still reads `none`. But decision 13 makes every install create that folder, so any later `omni init --force` would switch `laws.source` to `knowledge`, even in a repository whose registers are empty. This is spec decision 14, added while re-planning and never put to the PRD author.

## What I did meanwhile

The spec (decision 14) and the plan (s4, in `kit/lib/init/detect.mjs`) change the detection to registers that hold at least one entry. PRD 39's tests change only where they assert `laws.source` on a bare knowledge folder. Nothing is built yet: s4 is in wave 4.

## What it costs to change later

One function and its tests. If B or C is chosen, s4 drops the change, and nothing else in the plan depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a repository with an empty register folder ever means to adopt laws soon, and so should read as having them (author).

```

<!-- /omni-outbox-settled: s4-02-laws-source-from-register-entries -->
