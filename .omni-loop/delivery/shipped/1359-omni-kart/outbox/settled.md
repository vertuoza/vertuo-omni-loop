# Settled outbox items — PRD 1359

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-kart-registry-edits-outside-territory -->

## s1-01-kart-registry-edits-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-kart-registry-edits-outside-territory
prd: 1359
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Putting OMNI KART in the arcade meant touching the game list, the score lists and the tests that counted two games, which sit outside this slice's own files. Is that the right place for them?

## The decision, in plain words

The kart cabinet was added to the shared game list and the old tests that expected two games and a coming-soon cabinet were updated, so the third cabinet is now the kart and no cabinet says soon.

## The intro, for fun

A third cabinet rolled into the arcade and the old furniture had to shuffle over.

## The punchline, for fun

Nobody minded, except the sign that said soon.

## The options, in plain words

A. A. Keep the shared edits in this slice, as built.
B. B. Move the shared edits to a separate slice and keep this one to the kart's own files.

## What I had to decide

Confirm the shared game list and the updated tests may stay in this slice, or move them to a slice of their own.

## What I did meanwhile

The arcade shows OMNI KART as the third cabinet, locked until level 3.

## What it costs to change later

Small: the edits are a few lines in the game list, the grid and the tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a registry edit may ride in a slice whose territory is the kart's own files (author)

```

<!-- /omni-outbox-settled: s1-01-kart-registry-edits-outside-territory -->

<!-- omni-outbox-settled: s2-01-kart-three-views -->

## s2-01-kart-three-views — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-kart-three-views
prd: 1359
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec says the kart is drawn leaning left and leaning right, but a kart driving straight needs a picture too. What does it show?

## The decision, in plain words

The kart gets a third picture, driving straight, next to the left and right leans, so a kart that is not turning does not look like it is turning.

## The intro, for fun

A kart that always leans looks like it is late for every corner.

## The punchline, for fun

So it now has a straight face too.

## The options, in plain words

A. A. Three views: straight, left and right (built).
B. B. Two views only, as the spec reads: the kart keeps the last lean it had, or leans left at the start.

## What I had to decide

The kart has three views, each with two frames: straight, leaning left and leaning right. Straight is shown when no turn is held. Dropping the straight view later is one sprite and one line, and the other two keep their digests.

## What I did meanwhile

The player's kart leans only while a turn is held.

## What it costs to change later

One more forged sprite with a recorded digest.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person prefers the straight view is a matter of taste (author).

```

<!-- /omni-outbox-settled: s2-01-kart-three-views -->

<!-- omni-outbox-settled: s2-02-countdown-then-go -->

## s2-02-countdown-then-go — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-09
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-09
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-countdown-then-go
prd: 1359
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The race starts with 3, 2, 1 and GO over 3 seconds. Does GO take part of those 3 seconds, or come right after them?

## The decision, in plain words

The numbers 3, 2 and 1 take the whole 3 seconds, one second each, and GO shows for under a second as the kart is released.

## The intro, for fun

Three seconds is a long time to stare at a starting line.

## The punchline, for fun

GO gets the first moment of the race instead of a slice of the wait.

## The options, in plain words

A. A. 3, 2 and 1 take 3 seconds, GO shows over the first three quarters of a second of the race (built).
B. B. Four beats of three quarters of a second, GO being the last one, with the race starting after it.

## What I had to decide

The countdown phase lasts exactly 3 seconds, one for each of 3, 2 and 1, and nothing moves in it. The race begins at GO, which shows for three quarters of a second over the first moments of the race. Both lengths are constants in one block, so a different split is a constant.

## What I did meanwhile

A held A before GO moves nothing, and GO is the first moment the kart answers it.

## What it costs to change later

None: two constants.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long each number should show is a matter of feel (author).

```

<!-- /omni-outbox-settled: s2-02-countdown-then-go -->
