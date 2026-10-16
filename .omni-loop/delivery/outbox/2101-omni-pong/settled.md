# Settled outbox items — PRD 2101

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-board-list-tests-outside-territory -->

## s1-01-board-list-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-board-list-tests-outside-territory
prd: 2101
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

Adding the fifth game also adds its crew board, and two tests that list every game's board sit outside this slice's ground. Should this slice update them?

## The decision, in plain words

This slice added the new game's board to those two lists, so every test stays green when the game joins the room.

## The intro, for fun

A new cabinet arrived, and two old guest lists suddenly had one name missing.

## The punchline, for fun

We wrote the name in, rather than leave the door shut on a game with no players yet.

## The options, in plain words

A. Update the two board-list tests in this slice, as built.
B. Leave them for a later slice, with the preflight red until then.

## What I had to decide

Adopt A if the two board-list tests may follow the registry in the slice that grows it; pick B to move them to a later slice.

## What I did meanwhile

The two tests list OMNI PONG's board beside the other four games' boards.

## What it costs to change later

One line each in two tests; undoing it is removing those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the board-list tests to be in s1, or simply missed them when it listed every test that counts games (author)

```

<!-- /omni-outbox-settled: s1-01-board-list-tests-outside-territory -->

<!-- omni-outbox-settled: s2-01-pitch-floors -->

## s2-01-pitch-floors — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-pitch-floors
prd: 2101
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

How loud and how clear must a sound be before the game reads it as a voice that steers the paddle?

## The decision, in plain words

A sound steers only when it is clearly louder than a quiet room and clearly a held note: speech, breath and hiss steer nothing. The two thresholds sit beside the pitch limits so they can be retuned in one place.

## The intro, for fun

Somewhere between a whisper and an opera there is a voice that moves a paddle.

## The punchline, for fun

We picked where the quiet ends; your open space may want a say.

## The options, in plain words

A. A. Keep the thresholds as built: a sound a little louder than a quiet room, and clearly a held note, steers.
B. B. Ask for a clearer note, so only a steady hum steers, at the price of a wavering voice dropping out.
C. C. Ask for a louder sound, so a quiet room steers less, at the price of a soft voice having to hum louder.

## What I had to decide

Keep the two thresholds as built, or set new ones after a person has played a few matches on a laptop microphone and a headset.

## What I did meanwhile

The game reads a sound whose loudness is at least 0.01 (RMS of samples in -1..1) and whose normalised autocorrelation peak is at least 0.8; the first peak within 90 % of the highest is taken as the period, so a voice is not read an octave low.

## What it costs to change later

A constant in one file (apps/galaxy/src/arcade/pong/rules.ts, PITCH.loudnessFloor, clarityFloor, peakShare); no stored data and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Tuned on synthesised sines and seeded white noise only; not yet heard against a real voice or a noisy room (author).

```

<!-- /omni-outbox-settled: s2-01-pitch-floors -->
