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

<!-- omni-outbox-settled: s3-01-curves-rival-speed-cap -->

## s3-01-curves-rival-speed-cap — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-curves-rival-speed-cap
prd: 1829
slice: s3
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

How hard should the rivals brake for a bend: the spec fixes the radii but not how a rival's top speed falls as a bend tightens.

## The decision, in plain words

A rival drives flat out through a bend of radius 5 or more and lifts in the hairpins of radius 3, with its speed cap tied to the radius of the bend.

## The intro, for fun

Rivals now have bends to fear, and nobody told them how much.

## The punchline, for fun

So they brake exactly as much as the tightest bend deserves.

## The options, in plain words

A. A. Flat out from radius 5, lift in the hairpins of radius 3 (built)
B. B. Flat out from radius 4, so rivals are faster through the middle bends
C. C. One cap per bend, written in the track by hand

## What I had to decide

Keep the cap tied to the bend's radius with the flat-out threshold at 5 tiles; changing the threshold is one constant in the rivals' rules.

## What I did meanwhile

Rivals finish three laps from every seed with no fall on all three levels, and the flat-out and hairpin cases are tested.

## What it costs to change later

A different threshold changes lap times of the rivals only; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The exact cap for a radius between 3 and 5 is not in the spec (author)

```

<!-- /omni-outbox-settled: s3-01-curves-rival-speed-cap -->

<!-- omni-outbox-settled: s3-02-curves-station-positions -->

## s3-02-curves-station-positions — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-curves-station-positions
prd: 1829
slice: s3
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

Where do the stands, props, the second jump's landing pad and the walkway's width sit on the new circuit, which the spec leaves to the build.

## The decision, in plain words

The stands and props keep to open ground beside the new bends, the jump over the gap lands on a pad one row further on, and the walkway stays two tiles wide until the walkway slice makes it harder.

## The intro, for fun

The circuit bent, so the furniture had to find new seats.

## The punchline, for fun

The walkway keeps its old width until its own slice arrives.

## The options, in plain words

A. A. Positions chosen beside the new bends; walkway two tiles wide for now (built)
B. B. Narrow the walkway to one tile now, ahead of its slice
C. C. Keep the old square positions and let the bends cross them

## What I had to decide

Keep these positions; each is a number in the circuit's own table and moves with one edit.

## What I did meanwhile

The boxes, the places, the stands and both shortcuts are in the tests; the jump over the gap still holds.

## What it costs to change later

Moving any of them later is an edit of the circuit's table and its test numbers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The walkway width after the walkway slice is outside this slice (author)

```

<!-- /omni-outbox-settled: s3-02-curves-station-positions -->
