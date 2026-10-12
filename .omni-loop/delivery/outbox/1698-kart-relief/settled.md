# Settled outbox items — PRD 1698

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s4-01-box-lines-vs-rivals-falls -->

## s4-01-box-lines-vs-rivals-falls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-box-lines-vs-rivals-falls
prd: 1698
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

With forty boxes the computer rivals pick up many more items, and some of them then fall off the road. Where should the new lines of boxes stand, and should the rivals be taught to cope?

## The decision, in plain words

The eight new lines stand where the three test races end with no rival falling, and the rivals themselves are left as they are.

## The intro, for fun

Forty boxes, and every rival wants a present.

## The punchline, for fun

Some of them open it a little too fast near a corner.

## The options, in plain words

A. A. Keep the lines where the three test races stay clean, rivals unchanged.
B. B. Keep the lines where they are most useful to players, and teach the rivals to brake after a BOOST.
C. C. Fewer lines, so fewer items reach the rivals.

## What I had to decide

Eight of the other straights got a line, chosen by trying placements until the three test races (seeds 1, 7 and 42) ended with no rival falling. A different answer moves a line by editing the map text.

## What I did meanwhile

The race plays with forty boxes; the no-fall test passes only for these placements.

## What it costs to change later

A line moved on the map is a few characters. Teaching the rivals to brake after a BOOST is a change to their driving, outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Why rivals fall after a BOOST or a spin-out near a corner was not investigated (author).

```

<!-- /omni-outbox-settled: s4-01-box-lines-vs-rivals-falls -->

<!-- omni-outbox-settled: s5-01-minimap-under-item-panel-at-36 -->

## s5-01-minimap-under-item-panel-at-36 — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-minimap-under-item-panel-at-36
prd: 1698
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 4
---

## The question, in plain words

The item panel is drawn by the page, not the canvas, so the game does not know how tall it is. Where should the minimap start under it?

## The decision, in plain words

The minimap starts 36 game pixels from the top, just under the panel as it is today, 8 pixels in from the right edge.

## The intro, for fun

The minimap needs a seat, and the item panel will not say how tall it sits.

## The punchline, for fun

We guessed 36 and left a constant to change.

## The options, in plain words

A. A. Fixed at 36 from the top (built)
B. B. Measured from the page's panel at run time, which couples the canvas to the page

## What I had to decide

Read the panel's height from its stylesheet: the top is 8 and the box is about 24 high, so 36 clears it on both grids. One constant, MINIMAP_TOP in art.ts, moves it.

## What I did meanwhile

The minimap sits at 36 from the top on both grids.

## What it costs to change later

A taller item panel would overlap it until the constant is raised.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The panel's real rendered height on a phone (author)

```

<!-- /omni-outbox-settled: s5-01-minimap-under-item-panel-at-36 -->
