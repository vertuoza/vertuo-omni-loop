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

<!-- omni-outbox-settled: s3-01-match-tuning -->

## s3-01-match-tuning — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-match-tuning
prd: 2101
slice: s3
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

How fast should the ball get, and how slow should the computer opponent react, so a rally feels fair and still ends?

## The decision, in plain words

The ball starts gently, speeds up a little at every hit up to a firm cap, and the computer reacts a quarter of a second late, so it starts missing once the rally gets fast.

## The intro, for fun

Somebody had to decide how sleepy the robot is.

## The punchline, for fun

A quarter of a second of daydreaming, and it is still a better player than most of us.

## The options, in plain words

A. A. Keep these numbers (built).
B. B. A gentler match: a slower cap and a slower speed-up, so rallies last longer before the AI misses.
C. C. A harder match: a shorter AI delay or a faster AI, so points come later in a rally.

## What I had to decide

Keep the numbers in the match's constants block, or name new ones there: the ball's serve speed, its speed-up per hit and its cap, the opponent's delay and top speed, the paddle sizes and the serve angles.

## What I did meanwhile

The match plays with these numbers: serve 150 px/s, ×1.07 per return, cap 480 px/s, the AI 0.25 s late at 160 px/s, the player at 220 px/s, paddles 40 px tall, serves between 0.25 and 0.6 rad. A test proves the AI misses before the ball reaches its cap for 200 seeds.

## What it costs to change later

A constant: every number sits in one block of the rules file, and the tests read them from there.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The numbers were chosen by reasoning and checked by the tests only; nobody has played a match with a real voice yet. The feel is a person's check once s5 puts the match on screen.
- (author) The spec's 'no death earns a point' test is read as: a player who concedes three balls in a row from a given rally never ends higher than the same reading player who misses none, for 200 seeds and four rallies; a concession also never changes the score, at every concession of 200 matches.

```

<!-- /omni-outbox-settled: s3-01-match-tuning -->

<!-- omni-outbox-settled: s4-01-grid-lists-the-pong-group -->

## s4-01-grid-lists-the-pong-group — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-grid-lists-the-pong-group
prd: 2101
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The new game's screen had to be listed in the shared file that says which screens a phone held upright draws tall, and that file was not in this step's planned ground. Is adding one line there fine?

## The decision, in plain words

We added the new game's screen group to that shared list, one line, so the phone held upright draws it tall like every other screen, as a test already requires of every screen.

## The intro, for fun

Every screen in the arcade must say how it stands on a phone held upright.

## The punchline, for fun

The new game raised its hand in a file nobody planned to open.

## The options, in plain words

A. A. Keep the one added line in the shared list of tall screens, as built
B. B. Take the line out, and plan it into a later step that owns the shared list

## What I had to decide

Keep the one line in the shared grid list (A), or plan the file into the slice that owns it next time (B).

## What I did meanwhile

The new game's screen is drawn on the tall grid on a phone held upright, as the plan's done-when asks.

## What it costs to change later

Removing it is one line; without it the existing test that every screen is listed as tall fails.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names grid.ts in no slice's territory, so no slice could add the group without leaving its ground (author).

```

<!-- /omni-outbox-settled: s4-01-grid-lists-the-pong-group -->

<!-- omni-outbox-settled: s4-02-ready-screen-reads-a-busy-or-lost-mic -->

## s4-02-ready-screen-reads-a-busy-or-lost-mic — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-ready-screen-reads-a-busy-or-lost-mic
prd: 2101
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The spec names two reasons a microphone is refused, blocked or not found, and says nothing of a microphone busy in another app, or one unplugged before the match starts. What should the ready screen say then?

## The decision, in plain words

A microphone busy in another app reads NO MIC FOUND, and one unplugged on the ready screen sends the player back to A · TURN ON MIC; MIC LOST stays for a match in play.

## The intro, for fun

A microphone can be busy, borrowed or simply pulled out at the worst moment.

## The punchline, for fun

The ready screen keeps two excuses and asks politely again.

## The options, in plain words

A. A. A busy microphone reads NO MIC FOUND, and one unplugged on the ready screen turns back to A · TURN ON MIC, as built
B. B. A busy microphone gets its own line, such as MIC IN USE ELSEWHERE, and one unplugged on the ready screen reads MIC LOST

## What I had to decide

Keep the two readings as built (A), or give a busy microphone its own line (B).

## What I did meanwhile

A busy microphone reads NO MIC FOUND, and A asks again once the other app lets it go.

## What it costs to change later

Each reading is one line of the microphone's error mapping and of the ready screen's words.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No player has seen a busy microphone's line yet; how often it happens on a laptop is not known (author).

```

<!-- /omni-outbox-settled: s4-02-ready-screen-reads-a-busy-or-lost-mic -->

<!-- omni-outbox-settled: s4-03-pitch-meter-spans-sixty-hz-each-side -->

## s4-03-pitch-meter-spans-sixty-hz-each-side — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-pitch-meter-spans-sixty-hz-each-side
prd: 2101
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The pitch meter's bar marks the heard pitch against the limit, but the spec does not say how far above and below the limit the bar reaches, nor whether it shows the pitch as a number.

## The decision, in plain words

The bar reaches 60 Hz on each side of the limit, a pitch further away sits at its end, and no number is shown, as the draft screen shows.

## The intro, for fun

A bar needs two ends, and a voice can wander far past either.

## The punchline, for fun

Past sixty, the marker just leans on the wall.

## The options, in plain words

A. A. The bar reaches 60 Hz each side of the limit, with no number, as built
B. B. The bar reaches 120 Hz each side, and the heard pitch shows as a number beside it

## What I had to decide

Keep 60 Hz each side and no number (A), or widen the bar and add the number (B).

## What I did meanwhile

Each of the three limits gets the same bar, with its still band a sixth of it in the middle.

## What it costs to change later

One number in the scene's words; showing the pitch as a number is one more line on the screen.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not tried with a real voice: whether 60 Hz leaves the marker too still or too jumpy is for a person to feel (author).

```

<!-- /omni-outbox-settled: s4-03-pitch-meter-spans-sixty-hz-each-side -->
