# Settled outbox items — PRD 1963

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-stills-frost-ice-patch -->

## s2-01-stills-frost-ice-patch — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-stills-frost-ice-patch
prd: 1963
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

A frozen patch on the first bend of FROST EIGHT now shows in the picture of the race on the arcade's cabinet screen, so that picture was redrawn. Is that right?

## The decision, in plain words

We redrew the stored picture of the cabinet screen so that it shows the new ice, because leaving it as it was would have kept the tests red.

## The intro, for fun

The ice has barely arrived and it is already in the photo album.

## The punchline, for fun

Say whether the album keeps the new picture.

## The options, in plain words

A. A. Keep the regenerated still, with the ice patch in the picture.
B. B. Keep the old still and change the camera of the still so the patch is out of view.

## What I had to decide

The still of FROST EIGHT in apps/galaxy/src/arcade/games/stills.ts is generated from the real track and texture; it sits outside this slice's territory, so it was regenerated with the test's update flag (33 rows of pixels changed) and nothing else in that file.

## What I did meanwhile

The new still ships with the ice patch drawn in.

## What it costs to change later

Reverting means restoring the old still, which no longer matches the track.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the cabinet's still should show the patch or a calmer part of the track (author)

```

<!-- /omni-outbox-settled: s2-01-stills-frost-ice-patch -->
