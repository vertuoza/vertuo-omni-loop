# Settled outbox items — PRD 324

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-context-bar-cells-rounded-down -->

## s1-01-context-bar-cells-rounded-down — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-context-bar-cells-rounded-down
prd: 324
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The example line in the spec draws six filled cells for 58 %, while its rule, one filled cell for each whole 10 %, gives five. Which one should the context bar follow?

## The decision, in plain words

The bar follows the rule: one filled cell for each whole 10 %, so 58 % fills five cells out of ten. The example line is read as drawn by hand.

## The intro, for fun

The spec drew the bar's rule with a ruler, then sketched its example freehand.

## The punchline, for fun

Fifty-eight now fills five cells, exactly as the rule counts them.

## The options, in plain words

A. Round down, one filled cell for each whole 10 %, as the rule and the plan's list say: 58 % fills five cells. The option built.
B. Round to the nearest cell, as the example draws it: 58 % fills six cells, but then 49 % fills five and 79 % fills eight, against the plan's list.

## What I had to decide

Whether the context bar fills one cell per whole 10 % (the spec's rule, and the plan's list of cells at 0, 49, 50, 79, 80, 100 and 130 %), or rounds to the nearest cell, as the spec's and the plan's example line `██████░░░░ 58%` draws it.

## What I did meanwhile

The bar rounds down: 0, 49, 50, 79, 80, 100 and 130 % fill 0, 4, 5, 7, 8, 10 and 10 cells, as the plan's done-when lists them, and 58.9 % fills five. The done-when's expected line is asserted with five cells, `█████░░░░░ 58%`, not the six its example draws.

## What it costs to change later

One expression in `kit/lib/statusline/render.mjs` and the expected cells in its tests and in `kit/bin/statusline.test.mjs`. No stored data, and no other slice depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example line and its rule disagree, and the plan's done-when repeats the example line while also listing the cells the rule gives; nothing says which one wins.

```

<!-- /omni-outbox-settled: s1-01-context-bar-cells-rounded-down -->

<!-- omni-outbox-settled: s1-02-five-hour-reset-time-read -->

## s1-02-five-hour-reset-time-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-five-hour-reset-time-read
prd: 324
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Claude Code tells the status line when the 5-hour usage resets, but the spec says neither in which form that moment comes nor how to count a minute that has only started. How should the line read it?

## The decision, in plain words

A number is read as seconds since 1970, and a text as a date. The time left counts a started minute as a whole one, so the last minute before the reset reads 1m, never 0m.

## The intro, for fun

The clock says when the window reopens, but not which way it tells the time.

## The punchline, for fun

Both ways are understood, and the countdown never reaches zero before the reset does.

## The options, in plain words

A. Seconds since 1970 or a date, minutes rounded up so the last minute reads 1m: the option built.
B. Seconds since 1970 or a date, minutes rounded down, so the last minute before the reset reads 0m.
C. Seconds since 1970 only: a moment sent as a date leaves the usage out of the line.

## What I had to decide

Whether `rate_limits.five_hour.resets_at` is read as Unix seconds, milliseconds or an ISO date, and whether the time to it rounds its minutes up or down.

## What I did meanwhile

A number is read as Unix seconds and a text as a date; anything else leaves the usage part out. The time left is counted in whole minutes rounded up: 30 seconds read `1m`, 44 minutes and a second read `45m`, 59 minutes and 30 seconds read `1h00`. The spec's own cases, `45m` and `1h05`, read the same either way.

## What it costs to change later

One function in `kit/lib/statusline/input.mjs`, one in `kit/lib/statusline/render.mjs`, and their tests. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the field but not its form: Claude Code's documentation, which is not in this repository, is the authority, and nothing here was checked against a live payload.
- (author) The spec gives `45m` and `1h05` but not how a part of a minute is counted.

```

<!-- /omni-outbox-settled: s1-02-five-hour-reset-time-read -->
