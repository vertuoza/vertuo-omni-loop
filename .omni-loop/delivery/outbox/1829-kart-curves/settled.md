# Settled outbox items — PRD 1829

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-kart-drawing-call-sites-read-road -->

## s2-01-kart-drawing-call-sites-read-road — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-kart-drawing-call-sites-read-road
prd: 1829
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The kart's drawing code asks how far a kart leans over the edge, and now has to be handed the whole circuit instead of its rows. Its file sits outside this slice's territory, so should its two call lines be changed here?

## The decision, in plain words

Change only the two lines in the drawing code that lean the kart, so the game still builds. Nothing a player sees changes.

## The intro, for fun

Two lines in the drawing code wanted to ride along with the engine.

## The punchline, for fun

They were let on, on the condition that they sit still.

## The options, in plain words

A. A. Change the two lean calls in the drawing code, nothing else.
B. B. Leave the drawing code alone and let the lean function also accept bare rows, read tile by tile.

## What I had to decide

Edited the drawing module of the kart (kart/art): its two lean calls now pass the track instead of its rows. Nothing else there changed. If a person prefers it untouched until s3, the alternative is a lean function that also accepts bare rows, a constant to add.

## What I did meanwhile

Slice s3 owns the whole kart folder and can rework the drawing code freely.

## What it costs to change later

Two changed lines outside the declared territory; reverting them is a two-line edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person wants the drawing code left untouched until s3 (author)

```

<!-- /omni-outbox-settled: s2-01-kart-drawing-call-sites-read-road -->
