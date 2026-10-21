# Settled outbox items — PRD 2030

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-scene-lines-test-file -->

## s3-01-scene-lines-test-file — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-scene-lines-test-file
prd: 2030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The plan gave this piece no place for a test of how the scenes draw their new lines. Should that test live in a new file beside the scenes it checks?

## The decision, in plain words

We added one new test file beside the scenes, which draws each scene alone and checks that its small top line and its sentence show, in order and on time.

## The intro, for fun

The plan left the scenes a seat at the table, but forgot the chair for their test.

## The punchline, for fun

So we brought a folding chair and put it right beside them.

## The options, in plain words

A. Keep the new test file beside the scenes, outside the planned ground of this piece.
B. Drop it, and pin the new lines with reference pictures in the browser render tests instead.
C. Keep it, and give the later pieces that change the scenes the same file to extend.

## What I had to decide

Keep the new test file beside the scenes, or move its checks into the browser render tests of a later piece.

## What I did meanwhile

The new test file runs with the rest of the suite and no other piece of the plan touches it.

## What it costs to change later

Moving or deleting one test file; no product behaviour depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The browser render tests that compare frames with reference images could not run on this machine (its browser is not installed); the fixture holds no new field, so those frames should not move (author).

```

<!-- /omni-outbox-settled: s3-01-scene-lines-test-file -->

<!-- omni-outbox-settled: s3-02-full-layout-room-for-lines -->

## s3-02-full-layout-room-for-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-full-layout-room-for-lines
prd: 2030
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

In a feature scene where the screen fills the width, the title sits above it. Where should the new small top line and sentence go so they do not cover the screen?

## The decision, in plain words

When such a scene has a small top line or a sentence, its words start a little higher and the screen sits a little lower and smaller; without them the scene looks exactly as before.

## The intro, for fun

Two new lines wanted a seat above the screen, and the screen was already sitting there.

## The punchline, for fun

The screen kindly moved down one row and nobody spilled their coffee.

## The options, in plain words

A. Start the words higher and set the screen lower and a little smaller, only when the scene has these lines.
B. Keep the screen where it was and let the lines cover its top edge.
C. Draw the sentence under the screen instead of above it.

## What I had to decide

Keep the words starting higher and the screen lower when a scene has these lines, or choose other positions.

## What I did meanwhile

Only a full-width feature scene with a small top line or a sentence is drawn this way; every other scene is unchanged.

## What it costs to change later

Changing two numbers in the layout.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The positions were set by measuring one-line titles and bodies; a title or body that wraps to two lines may sit close to the screen (author).

```

<!-- /omni-outbox-settled: s3-02-full-layout-room-for-lines -->

<!-- omni-outbox-settled: s1-01-final-stop-and-open-accent -->

## s1-01-final-stop-and-open-accent — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-final-stop-and-open-accent
prd: 2030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

When a title ends with three dots, or holds an accent mark that is never closed, what should the video show?

## The decision, in plain words

Only a single full stop at the very end is coloured; three dots stay in the normal colour. An accent mark left open colours nothing, and the check refuses that title before any video is made.

## The intro, for fun

Three dots walk into a title and ask to be coloured in.

## The punchline, for fun

Only the lone full stop gets the paint; the dots stay plain.

## The options, in plain words

A. Only a single final full stop is coloured, and an open accent mark colours nothing (built).
B. An ending ellipsis is coloured too, all three dots in the accent.
C. An open accent mark colours everything after it, so the mistake shows on screen as well as in the check.

## What I had to decide

Whether an ellipsis at the end of a title takes the accent colour like a full stop, and whether an unclosed accent mark colours the rest of the title.

## What I did meanwhile

A title ending in one full stop colours it; one ending in three dots, a question mark or an exclamation mark colours none of them. An unclosed accent mark is dropped from the screen and colours nothing; the check stops the storyboard anyway.

## What it costs to change later

A constant in the title parser: colouring an ellipsis, or the rest of the title after an open mark, is a one-line change and a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names only a final full stop; how release-videos treats an ending ellipsis was not checked (author).

```

<!-- /omni-outbox-settled: s1-01-final-stop-and-open-accent -->

<!-- omni-outbox-settled: s4-01-steps-media-rule -->

## s4-01-steps-media-rule — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-steps-media-rule
prd: 2030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-21
wave: 3
---

## The question, in plain words

When a list of steps has no picture of its own, must every step bring one, or is one step with a picture enough?

## The decision, in plain words

Every step must bring its own picture when the list has none. A list with no picture of its own and a step without one is refused, the scene named.

## The intro, for fun

A list of steps walks into a video with no picture of its own.

## The punchline, for fun

We asked every step to bring one, so nobody stares at an empty card.

## The options, in plain words

A. A. Every step brings its own media when the scene has none (built): the card is never empty.
B. B. One step's media is enough: before the first step that brings one, the card stays empty.
C. C. One step's media is enough, and the first media shown is held from the scene's start.

## What I had to decide

Whether a steps scene with no media of its own needs every step to bring one (built), or only one step.

## What I did meanwhile

The schema refuses a steps scene with no media when any step brings none; the check reports it at the scene's path.

## What it costs to change later

Loosening it later is one line of the schema and a test: nothing written today breaks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the scene's media becomes optional when every step brings its own, and also that at least one of them is required; the plan only asks that a scene with no media at all is refused. The stricter reading was built. (author)

```

<!-- /omni-outbox-settled: s4-01-steps-media-rule -->
