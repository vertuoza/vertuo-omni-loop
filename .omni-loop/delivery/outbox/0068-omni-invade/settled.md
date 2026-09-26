# Settled outbox items — PRD 68

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-slice-brought-in-main -->

## s1-01-slice-brought-in-main — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-slice-brought-in-main
prd: 68
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The plan said the feature branch would take in the finished knowledge forms work before the first wave, but it had not. Should this first slice have brought that work in itself?

## The decision, in plain words

The slice took in the latest main branch before building, so the forms it renames exist. When this slice merges, the feature branch gets that work too.

## The intro, for fun

The plan said the furniture would arrive first. The movers showed up to an empty flat.

## The punchline, for fun

So they brought the sofa themselves, and signed for it.

## The options, in plain words

A. Take in main on the slice branch and build (what was built).
B. Stop the slice, and have the wave merge main into the feature branch first.

## What I had to decide

Whether a slice may take in the main branch when its feature branch has not yet, or whether it should stop and wait for the wave to do it.

## What I did meanwhile

The slice's sub-PR carries main's recent commits as a merge; the feature branch picks them up when it merges.

## What it costs to change later

Low: the merge is clean and main's commits would reach the feature branch anyway. Undoing it means merging main into the feature branch directly and rebasing the slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan names the merge as the feature branch's step; which branch takes it is the only open point (author).

```

<!-- /omni-outbox-settled: s1-01-slice-brought-in-main -->

<!-- omni-outbox-settled: s1-02-rename-reach -->

## s1-02-rename-reach — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-rename-reach
prd: 68
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The rename touched three small test helpers the slice was not given, and left two places on the old word: a list of game words the jokes must avoid, and this project's own filled-in forms. Is that the right line to draw?

## The decision, in plain words

The three helpers now use the new word, while the game-word list and this project's own forms keep the old one. The forms still read fine, and the checker warns on each old spelling until someone reruns the fill.

## The intro, for fun

Renaming a street is easy. Getting every letterbox to agree takes longer.

## The punchline, for fun

The post still arrives; the checker just sighs at each old sign.

## The options, in plain words

A. Rename the three helpers, keep the game-word list and this project's own forms as they are (what was built).
B. Also rewrite this project's own forms to the new spelling in this slice.
C. Keep the three helpers on the old spelling too, and stay strictly inside the slice's files.

## What I had to decide

Whether this project's own forms should be rewritten to the new spelling now, and whether the game-word list should drop the old word.

## What I did meanwhile

The checker prints one warning per old spelling in this project's own forms and still passes.

## What it costs to change later

Low: rewriting the forms is a search and replace in one folder; the helper renames are one line each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a later run of the fill skill on this project is planned to rewrite the forms (author).

```

<!-- /omni-outbox-settled: s1-02-rename-reach -->
