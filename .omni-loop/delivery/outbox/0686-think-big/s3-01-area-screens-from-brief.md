---
id: s3-01-area-screens-from-brief
prd: 686
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

A concept lists its areas with a name and a one-line brief, but not which screens of its vision tour each area covers. How should the brainstorm know which screens to start the new page from?

## The decision, in plain words

The brainstorm takes the screens that the area's brief or the concept's vision names for that area; when neither names any, it picks the screens that show what the brief describes, and says which ones it took so the person can correct the pick before the first question.

## The intro, for fun

The map says where each area lives, but forgot to draw the streets.

## The punchline, for fun

So the brainstorm reads the signposts, and asks if it guessed the right street.

## The options, in plain words

A. Read the screens from the words of the area's brief and the vision, and show the pick to the person to correct, the option built.
B. Add a fifth column to the concept's areas table naming the screens each area covers, filled by the studio and checked by the concept check.
C. Have the studio mark each screen of the vision tour with the area it belongs to, and have the brainstorm read that mark.

## What I had to decide

How `/omni:brainstorm --concept` finds the area's screens in `vision.html`. The spec's crown step says each area carries "the vision tour's screens it covers", but the `concept.md` Areas table it defines (and `kit/lib/concept/parse.mjs` enforces) has only `id | area | brief | PRD`, and nothing says how `vision.html` marks a screen's area.

## What I did meanwhile

The **From a concept** section of `kit/plugin/skills/brainstorm/SKILL.md` takes the screens of `vision.html` that the area's brief or **The vision** names for it, or, when neither names any, those that show what its brief describes; step 1 names the screens it took in its write-back, so the person corrects the pick before anything is written.

## What it costs to change later

Two sentences of skill prose. A later marker (a column, or an attribute on each screen of the vision tour) replaces them without touching any concept already merged.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's crown step lists the screens an area covers, but `concept.md`'s Areas table has no column for them and `omni concept` checks none.
- (author) `/omni:think-big` (slice s2) is written in parallel, so how its vision tour marks screens was not known when this was written.
