# Settled outbox items — PRD 942

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-slice-waiting-reasons-left-to-wave-two -->

## s1-01-slice-waiting-reasons-left-to-wave-two — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-slice-waiting-reasons-left-to-wave-two
prd: 942
slice: s1
rank: medium
bears-on: none
raised: 2026-10-02
wave: 1
---

## The question, in plain words

The plan asks the first slice to remove every note saying a piece of code waits for another slice, but four such notes sit in files only later slices may change. Who removes them?

## The decision, in plain words

The first slice removed the seven notes in its own files and left the four others to the two later slices whose files hold them, so no slice steps on another's ground.

## The intro, for fun

Four old notes still say they are waiting for someone who already came.

## The punchline, for fun

They will be told the good news in the next wave.

## The options, in plain words

A. A. Leave the four notes to the later slices that own their files (built)
B. B. Widen the first slice's territory and clear them here
C. C. Clear them in a follow-up pull request after the feature branch is done

## What I had to decide

Whether the four leftover notes are cleared by the later slices that own their files, or by a follow-up to the first slice.

## What I did meanwhile

The later slices for the kit and the App own those files and are asked by the plan to give every cast a true reason, so they clear the notes as they pass.

## What it costs to change later

Low: if the later slices miss them, a one-line change per note fixes it before the feature ships.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the first slice to reach outside its territory for these four notes (author)

```

<!-- /omni-outbox-settled: s1-01-slice-waiting-reasons-left-to-wave-two -->
