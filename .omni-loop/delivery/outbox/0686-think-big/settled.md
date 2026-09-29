# Settled outbox items — PRD 686

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-update-test-knows-concept-label -->

## s1-01-update-test-knows-concept-label — adopted

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
id: s1-01-update-test-knows-concept-label
prd: 686
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new concept label made an older test of the kit's update step expect one more label, and the plan had not given this slice that test. Was it right to add the label to that test's list?

## The decision, in plain words

We added the new label to the list of labels that test pretends a repository already has, and changed nothing else in it.

## The intro, for fun

A new label walked in, and an old test counted the chairs again.

## The punchline, for fun

One more chair, same table, nobody had to move.

## The options, in plain words

A. Add the new label to that test's fixture list, the option built.
B. Leave that test alone and let the update step's report say one label was created, changing its expected output instead.
C. Make that test read the label list from the kit's own label table, so a new label never needs a test edit again.

## What I had to decide

Whether s1 may touch `kit/bin/update.test.mjs`, outside its territory, to keep the suite green once `labels.concept` exists.

## What I did meanwhile

Its `LOOP_LABELS` fixture gains `'omni:concept'`, so its fake `gh label list` still holds every loop label and `omni update --apply` still reports `labels   ok`. No assertion changed.

## What it costs to change later

One string in one test fixture; undone by removing it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for s1 lists `kit/bin/init.test.mjs` but not `kit/bin/update.test.mjs`, which holds its own copy of the loop label list (author)

```

<!-- /omni-outbox-settled: s1-01-update-test-knows-concept-label -->

<!-- omni-outbox-settled: s1-02-shared-branch-verdict-shell -->

## s1-02-shared-branch-verdict-shell — adopted

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
id: s1-02-shared-branch-verdict-shell
prd: 686
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new concept check was a near copy of the bug and visual fix checks, so the repository's quality gate refused every commit. Should the three checks share one piece of code, even though that changes the older two?

## The decision, in plain words

The concept, bug and visual checks, and the phase-0 check, now share one piece of code for reading the branch and printing the verdict. Their behaviour and their messages stay the same.

## The intro, for fun

Three checks walked in wearing the same outfit, and the gate would not let them through.

## The punchline, for fun

Now they share one wardrobe and each keeps its own hat.

## The options, in plain words

A. A. Share one shell and one set of folder and page checks across the four commands and three verdicts, the option built.
B. B. Share them only between the concept check and a new helper, leaving bug and visual as they were; the gate still counts the copies they hold of the helper as new.
C. C. Add the concept check's copies to the gate's baseline so the gate stops counting them.

## What I had to decide

Whether the wave's fix for the duplication and complexity gate may refactor `omni bug`, `omni visual` and `omni phase0`, which no slice owns, onto a shared `kit/bin/branch-range.mjs`, and move the folder finder and raster check into `kit/lib/fix-verdict.mjs`.

## What I did meanwhile

Added `kit/bin/branch-range.mjs` (the base ref, the range's commits and paths, and the `omni <verb> <n> [--base <ref>]` shell); `concept`, `bug` and `visual` are each one call to it, and `phase0` reuses its base and commit readers. `numberedFolders` and `rasterFaults` moved into `kit/lib/fix-verdict.mjs`. The concept verdict's `folderFaults` and `networkLoads` and the Areas parser were split into smaller functions. Every message and exit code is unchanged, and each command's tests pass as they were.

## What it costs to change later

Reverting it means copying the helpers back into four command files and three verdicts, and the gate refusing commits again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The gate's own thresholds were read from its findings, not from a written rule in this repository (author).

```

<!-- /omni-outbox-settled: s1-02-shared-branch-verdict-shell -->

<!-- omni-outbox-settled: s3-01-area-screens-from-brief -->

## s3-01-area-screens-from-brief — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-29
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-29
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-area-screens-from-brief
prd: 686
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

A concept lists its areas with a name and a one-line brief, but not which screens of its vision tour each area covers. How should the brainstorm know which screens to start the new page from?

## The decision, in plain words

The brainstorm takes the screens that the area's brief or the concept's vision names for that area; when neither names any, it picks the screens that show what the brief describes, and says which ones it took so the person can correct the pick before the first question.

## The intro, for fun

The map says where each area lives, but forgot to draw the streets.

## The punchline, for fun

So the brainstorm reads the signposts, and asks if it guessed the right street.

## The options, in plain words

A. Read the screens from the words of the area's brief and the vision, and show the pick to the person to correct, the option built.
B. Add a fifth column to the concept's areas table naming the screens each area covers, filled by the studio and checked by the concept check.
C. Have the studio mark each screen of the vision tour with the area it belongs to, and have the brainstorm read that mark.

## What I had to decide

How `/omni:brainstorm --concept` finds the area's screens in `vision.html`. The spec's crown step says each area carries "the vision tour's screens it covers", but the `concept.md` Areas table it defines (and `kit/lib/concept/parse.mjs` enforces) has only `id | area | brief | PRD`, and nothing says how `vision.html` marks a screen's area.

## What I did meanwhile

The **From a concept** section of `kit/plugin/skills/brainstorm/SKILL.md` takes the screens of `vision.html` that the area's brief or **The vision** names for it, or, when neither names any, those that show what its brief describes; step 1 names the screens it took in its write-back, so the person corrects the pick before anything is written.

## What it costs to change later

Two sentences of skill prose. A later marker (a column, or an attribute on each screen of the vision tour) replaces them without touching any concept already merged.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's crown step lists the screens an area covers, but `concept.md`'s Areas table has no column for them and `omni concept` checks none.
- (author) `/omni:think-big` (slice s2) is written in parallel, so how its vision tour marks screens was not known when this was written.

```

<!-- /omni-outbox-settled: s3-01-area-screens-from-brief -->
