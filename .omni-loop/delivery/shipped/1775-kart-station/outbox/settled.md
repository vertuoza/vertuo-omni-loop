# Settled outbox items — PRD 1775

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-rival-crawl-on-the-edge -->

## s1-01-rival-crawl-on-the-edge — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-rival-crawl-on-the-edge
prd: 1775
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

With the softer edge, a computer driver that stalls with a wheel over the void could sit there until the grace ran out and then tip over. Should it be allowed to keep its foot down at very low speed so it can steer clear?

## The decision, in plain words

We let a computer driver with a wheel over the void keep the gas on while it is slower than 12 units a second, so a stalled one pulls itself back onto the road instead of tipping over.

## The intro, for fun

A kart stuck on the edge is a bit like a cat on a ledge.

## The punchline, for fun

We gave it a gentle nudge to the safe side.

## The options, in plain words

A. A. Keep the gas on below a crawl speed (built)
B. B. Leave the gas off and let a stalled rival tip over and come back on the line

## What I had to decide

The spec says rivals obey the same rules but does not say how a stalled rival behaves on the edge.

## What I did meanwhile

Built with the gas on below 12 units a second; the number is one constant in the rules file.

## What it costs to change later

Changing or removing it is one constant or one line in the rivals file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Why the rival stalled at near zero speed on one seed of the easy level is not explained (author)

```

<!-- /omni-outbox-settled: s1-01-rival-crawl-on-the-edge -->

<!-- omni-outbox-settled: s7-01-stand-ship-look -->

## s7-01-stand-ship-look — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s7
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-stand-ship-look
prd: 1775
slice: s7
rank: medium
bears-on: none
raised: 2026-10-13
wave: 3
---

## The question, in plain words

The spec says each stand shows a fleet's ship drawn with its mascot and colour, but there is no ship drawing per fleet. What should a stand show?

## The decision, in plain words

Each stand shows the fleet's mascot standing on a small platform lit in the fleet's colour; with no fleet, the neutral ship stands there instead.

## The intro, for fun

The grandstands are built, but nobody drew the spectators a ticket.

## The punchline, for fun

For now every fleet cheers from its own lit platform.

## The options, in plain words

A. A. The fleet's mascot on a platform lit in the fleet's colour
B. B. A dedicated starship sprite tinted in the fleet's colour, with the mascot in its window
C. C. The neutral ship on every stand, tinted in the fleet's colour

## What I had to decide

A person picks whether stands should show a dedicated ship drawing per fleet, tinted in the fleet's colour, instead of the mascot on a platform.

## What I did meanwhile

Stands show the mascot on a platform in the fleet's colour, and the neutral ship with no fleet.

## What it costs to change later

A new sprite per look and a change to one drawing function; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say which sprite a fleet's ship is (author)

```

<!-- /omni-outbox-settled: s7-01-stand-ship-look -->

<!-- omni-outbox-settled: s8-01-rivals-throw-nothing-from-the-air -->

## s8-01-rivals-throw-nothing-from-the-air — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-rivals-throw-nothing-from-the-air
prd: 1775
slice: s8
rank: medium
bears-on: none
raised: 2026-10-13
wave: 4
---

## The question, in plain words

A rival that held a trap and was flying over the gap threw it, and the trap landed on the ramp it had just left, so the karts behind spun out there and fell into the gap. The spec does not say whether a kart may use an item while it flies.

## The decision, in plain words

A rival uses no item while it is in the air; the player is unchanged, and the rule is one line in the rivals' item choice.

## The intro, for fun

A ramp is a poor place to leave a banana peel.

## The punchline, for fun

So the rivals keep their traps for dry land.

## The options, in plain words

A. A. Rivals use nothing in the air (built).
B. B. Rivals may use an item in the air, and the ramp keeps its trap: the rivals' laps then fall sometimes.
C. C. Nobody, player included, uses an item in the air.

## What I had to decide

Whether a kart may use an item in the air, for the rivals and for the player. The rivals use nothing in the air; if the player should be held to the same rule it is one more line in the player's item button.
Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

Rivals throw nothing from the air, and every rival finishes three laps without a fall on seeds 1, 7 and 42 at every level.

## What it costs to change later

One line and one test; undoing it is deleting the line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The pad before the gap jump stands 6 tiles before its ramp, not right before it, so the boost does not carry a rival into the tunnel's corner too fast (author).

```

<!-- /omni-outbox-settled: s8-01-rivals-throw-nothing-from-the-air -->
