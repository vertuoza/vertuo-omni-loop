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
