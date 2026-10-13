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
