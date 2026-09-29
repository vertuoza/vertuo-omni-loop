# Settled outbox items — PRD 556

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-init-test-outside-territory -->

## s1-01-init-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-init-test-outside-territory
prd: 556
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Adding the six bug labels to the setup command also changes what an older setup test expects to see created. Should that test be updated in this slice even though the plan did not list it?

## The decision, in plain words

Yes: the older setup test and the update test now expect the six new labels too, in the same order the setup command creates them. Nothing else in them changed.

## The intro, for fun

Six new labels walked in, and an old test counted the guests at the door.

## The punchline, for fun

We added them to its guest list rather than turning them away.

## The options, in plain words

A. Update the older setup test in this slice so it expects the six new labels.
B. Leave the older setup test failing here and fix it in a later slice that lists it.

## What I had to decide

Whether a test outside the slice's listed files may be updated when the slice's own change makes it wrong.

## What I did meanwhile

kit/bin/init.test.mjs lists the six new labels in its expected label lists and its first-run output, and kit/bin/update.test.mjs lists them among the labels its fake repository already has; both are green.

## What it costs to change later

Reverting is dropping the six names from those lists; no behaviour depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan's done-when asks omni init to create the six labels, which this test checks; only its territory list left the file out.

```

<!-- /omni-outbox-settled: s1-01-init-test-outside-territory -->

<!-- omni-outbox-settled: s2-01-porting-note-outside-territory -->

## s2-01-porting-note-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-porting-note-outside-territory
prd: 556
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The new bug-fix skill was adapted from an older skill in another repository. Should the note that lists what changed in that adaptation live beside the other such notes, even though the plan did not list that folder for this piece of work?

## The decision, in plain words

The note was written beside the other adaptation notes, the way every other adapted skill has one, so a reviewer can compare the new skill with its source.

## The intro, for fun

Every adapted skill keeps a diary of what it changed on the way here.

## The punchline, for fun

This one wrote its diary one folder outside the lines it was given.

## The options, in plain words

A. Keep the note beside the other adaptation notes.
B. Drop the note and the provenance line, as the visual-fix skill has none.

## What I had to decide

Keep the adaptation note beside the others, or drop it.

## What I did meanwhile

The note is in the pull request; nothing reads it but people.

## What it costs to change later

Removing it later is one deleted file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the plan names the porting folder for no slice; the caller asked for the note.

```

<!-- /omni-outbox-settled: s2-01-porting-note-outside-territory -->
