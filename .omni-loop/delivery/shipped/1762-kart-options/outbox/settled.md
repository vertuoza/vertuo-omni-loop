# Settled outbox items — PRD 1762

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s4-01-kart-art-takes-laps -->

## s4-01-kart-art-takes-laps — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-kart-art-takes-laps
prd: 1762
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The kart's drawing file builds the race, but the plan gives that file to a later slice. How does a single race get the player's laps and difficulty now?

## The decision, in plain words

I added two optional settings, laps and difficulty, to the one place that makes the race, and nothing else in that file changed.

## The intro, for fun

The race builder sat in a room this slice had no key to.

## The punchline, for fun

We slipped two optional notes under the door instead of moving in.

## The options, in plain words

A. A. Add the two optional settings to the race maker (built).
B. B. Pass the settings through a field of the track instead.
C. C. Wait for the slice that owns the drawing file.

## What I had to decide

A later slice may keep or move the two optional settings; removing them is a two-line change. Decided without asking: the plan lists no other way to reach the race maker from the options.

## What I did meanwhile

Single races already run the player's laps and difficulty; MULTI is untouched.

## What it costs to change later

A merge conflict is possible with the slice that owns the kart drawing file, limited to one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the slice that owns the kart drawing file wants the two settings kept as they are (author)

```

<!-- /omni-outbox-settled: s4-01-kart-art-takes-laps -->

<!-- omni-outbox-settled: s5-01-kart-panel-lives-in-options-module -->

## s5-01-kart-panel-lives-in-options-module — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-kart-panel-lives-in-options-module
prd: 1762
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The new KART screen needs its place in the options panel, but the panel's moves live in a file that belongs to the first slice, not this one. Where should it go?

## The decision, in plain words

The KART lines and their moves were added to the existing options file, as a small change next to the keys, laps and difficulty lines, instead of a second copy of the panel's logic.

## The intro, for fun

The kart wants a garage, and the garage plan was drawn on the neighbour's land.

## The punchline, for fun

We put up the door where the street already had one.

## The options, in plain words

A. A. Keep it in the options file: one place for every line of the panel (built).
B. B. Move it to a file of its own, and have the options file call it.

## What I had to decide

Say whether the KART panel's logic may stay in the options file, or must move to a file of its own.

## What I did meanwhile

The KART panel works from the options file, with its tests beside the others.

## What it costs to change later

Moving it later is a rename of a few functions and a type, with the tests following.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the first slice's owner wants the panel's logic kept apart from the options file (author)

```

<!-- /omni-outbox-settled: s5-01-kart-panel-lives-in-options-module -->

<!-- omni-outbox-settled: s6-01-s6-art-touches-live-race -->

## s6-01-s6-art-touches-live-race — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s6
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-s6-art-touches-live-race
prd: 1762
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 4
---

## The question, in plain words

The race that is played live is started from a file the plan did not list for this slice. Should this slice touch it, or should the plan list it?

## The decision, in plain words

The slice changed two lines of the file that starts a live race: it hands the grid's lap count to the race and sends the whole-race time to the other players while the board gets the three-lap time.

## The intro, for fun

Two lines slipped over the fence of the plan.

## The punchline, for fun

The fence is now a little wider.

## The options, in plain words

A. A. Keep the two small edits and list that file in the plan for later slices
B. B. Move the wiring into a new file inside this slice and call it from the old one

## What I had to decide

Territory is a list of paths; the live race is created in kart/art.ts, which is not on the s6 row but is the only place the start's laps and the finish message can be wired. Moving them elsewhere would mean duplicating the race's creation. Built as option A: two small edits in art.ts, no other change there.

## What I did meanwhile

The slice works with the two edits in place.

## What it costs to change later

Later slices that edit art.ts may meet these two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Why the plan row left art.ts out (author)

```

<!-- /omni-outbox-settled: s6-01-s6-art-touches-live-race -->
