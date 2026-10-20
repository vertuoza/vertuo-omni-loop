# Bug 2146: OMNI KART: inside COMET RING's tunnel, the item boxes past its exit are hidden

## Triage

- **Domain:** OMNI KART drawing: the sprites hidden behind nearer ground (`apps/galaxy/src/arcade/kart/art.ts`, `coverOf` / `hideBehind`, PRD 1698) and the tunnel ceiling the mode 7 renderer paints (`mode7.ts`, PRD 1775, PRD 1829)
- **Risk:** low — every player on COMET RING sees the item boxes past the tunnel exit only once out of the tunnel, so they cannot aim for one while inside; nothing breaks and the boxes are there (Jev, 0.90)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/art.tunnel.test.ts`
- **Red:** AssertionError: expected [ …(19) ] to deeply equal []

## Fix

A sprite is hidden where the ground drawn on the screen is nearer than it. `coverOf` scanned each
column of the sprite's screen box from the top and hid everything from the first nearer row down.
That rule fits a hill's crest, which covers a thing from below. Inside the tunnel, the roof is
nearer than a box down the road and fills the top of the box's screen box, so the first nearer row
was the box's top row and the whole box was hidden.

Now `coverOf` reads a column from either end. From below, it finds the nearer rows that reach the
box's bottom: a crest's road or a wall. From above, it finds the nearer rows that reach the box's
top: a tunnel's roof. `hideBehind` clips the sprite to the rows between the two. A crest hides what
it hid before, and the roof hides only the part of a thing it covers. The same rule shows a rival or
a box on the road ahead inside the tunnel, which the old rule also hid.

## Guard

`art.tunnel.test.ts`, "every circuit's tunnel lets the road ahead be seen from inside it". For every
circuit of the register that has a tunnel, from every tile of the tunnel, a thing on the road 2 to
8 tiles ahead is drawn wherever nothing nearer is drawn. It is red on the default branch
(`expected [ …(48) ] to deeply equal []` on the wide grid, 46 on the tall one) and green here.

## Mutation

mutation: no changed core file against origin/main (a533dac7): nothing to mutate
