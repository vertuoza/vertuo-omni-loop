# Settled outbox items — PRD 72

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-retro-label-look -->

## s1-01-retro-label-look — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-retro-label-look
prd: 72
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

What colour and what description should the new label for retros carry, since the spec asks for both but names neither?

## The decision, in plain words

The label is a pale lavender that no other label of the loop uses, and its description says it marks the retro of a merged feature: its retro pull request, or one finding to act on.

## The intro, for fun

Every new label has to pick an outfit before its first day at work.

## The punchline, for fun

It went with lavender: calm enough for looking back, bright enough to be found.

## The options, in plain words

A. A pale lavender no other loop label uses, with a description naming the retro pull request and a finding to act on, the option built.
B. A grey, so retro issues read as history rather than as work waiting to be done.
C. Another colour or wording a person prefers; only the look of the label changes.

## What I had to decide

The colour and the description `LABEL_STYLES.retro` gives the `omni:retro` label, which `omni init` creates with both. The spec ("The app's manifest, the kit, the environment") asks for `labels.retro` "with its colour and description in `LABEL_STYLES`" and names neither.

## What I did meanwhile

Colour `d4c5f9`, a pale lavender none of the seven other loop labels uses; description "Omni Loop: the retro of a merged PRD — its retro pull request, or one finding to act on", under GitHub's 100-character cap and in the "Omni Loop: …" shape the others share. `kit/lib/init/labels.test.mjs` pins that the colour differs from every other loop label's and that the description fits the cap.

## What it costs to change later

One line in `kit/lib/init/labels.mjs` and a rebuilt `kit/dist/omni.mjs`. `omni init` never recolours or rewords a label that exists, so a repository that already created it changes it by hand on its labels page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the team already reads a colour as "looking back" or "not work yet" on its boards.

```

<!-- /omni-outbox-settled: s1-01-retro-label-look -->
