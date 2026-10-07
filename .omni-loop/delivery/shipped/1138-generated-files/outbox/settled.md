# Settled outbox items — PRD 1138

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-generated-sources-wider -->

## s1-01-generated-sources-wider — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-generated-sources-wider
prd: 1138
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The spec lists the folders each built bundle is rebuilt from, but both builds read a few more. Should the list name every folder each build reads?

## The decision, in plain words

The list names every folder each build really reads, so a change to the kit's templates, its pitch engine, the App's entry points or the shared packages also marks the right bundle as needing a rebuild.

## The intro, for fun

Two bundles, and each reads a few more folders than the spec remembered.

## The punchline, for fun

A list of sources that forgets one is a rebuild that never happens.

## The options, in plain words

A. A. Name every folder each build reads (built).
B. B. Keep only the folders the spec spelled out, and let the tests that compare each bundle with a fresh build catch the rest.

## What I had to decide

Whether this repository's generated list names every source folder of each build, or only the ones the spec spelled out.

## What I did meanwhile

Both entries list the wider sources: the kit bundle from kit/lib/, kit/bin/, kit/templates/, kit/pitch-engine/ and kit/build.ts; the App's bundles from apps/omni-app/src/, apps/omni-app/entries/, apps/omni-app/build.ts, kit/lib/, packages/design/ and packages/github/.

## What it costs to change later

One line of .omni-loop/config.yml either way; nothing else reads the list differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) packages/design/ and packages/github/ were read from the App's imports today; a package it starts importing later must be added by hand.

```

<!-- /omni-outbox-settled: s1-01-generated-sources-wider -->

<!-- omni-outbox-settled: s2-01-merge-gate-reads-generated-from-the-cli -->

## s2-01-merge-gate-reads-generated-from-the-cli — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-merge-gate-reads-generated-from-the-cli
prd: 1138
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The merge check only knows which files are built if the command that runs it hands them over, and that command sat outside this slice's agreed files. Should the slice have changed it?

## The decision, in plain words

We changed that one command by a single line so it hands the repository's list of built files to the merge check; without it the merge check would never use the list.

## The intro, for fun

The gate learned a new rule, but nobody told the doorman.

## The punchline, for fun

So we slipped him a one-line note.

## The options, in plain words

A. A. Keep the one-line change to the merge command that hands it the list of built files (built).
B. B. Undo it and make that change in a later piece of work that owns the merge command.
C. C. Have the merge check find the list on its own, so the merge command changes nothing.

## What I had to decide

Whether the one-line change to the merge command, outside the slice's territory, stays as built.

## What I did meanwhile

The merge gate drops built files from its territory report when run here; a sub-PR in another repository is graded as before.

## What it costs to change later

Reverting is one line; the merge gate then reports rebuilt bundles as outside the territory again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test drives omni flow check merge with a generated section; the merge gate itself is tested with one. (author)

```

<!-- /omni-outbox-settled: s2-01-merge-gate-reads-generated-from-the-cli -->

<!-- omni-outbox-settled: s2-02-wave-frontier-still-counts-generated-ground -->

## s2-02-wave-frontier-still-counts-generated-ground — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-wave-frontier-still-counts-generated-ground
prd: 1138
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The plan check now lets two pieces of work that share only a built file run side by side, but the part that picks what a wave starts still keeps them apart. Should it follow the same list?

## The decision, in plain words

We left the wave picker as it is, since it sat outside this slice's agreed files; a plan that still lists built files may run one of those pieces a wave later than the plan check allows.

## The intro, for fun

The planner says two can dance; the bouncer still lets in one.

## The punchline, for fun

Nobody is hurt, the second just waits a song.

## The options, in plain words

A. A. Leave the wave picker as it is, since plans stop listing built files after the next piece of work (built).
B. B. Hand the wave picker the list of built files in a follow-up.
C. C. Make every check that compares files ask for the list, so none can forget it.

## What I had to decide

Whether the wave picker should read the list of built files too, in a follow-up.

## What I did meanwhile

A plan listing a generated path in two slices of one wave passes omni plan check, and the board defers the second slice to the next wave run. Once /omni:plan stops listing generated paths (s3), no plan hits this.

## What it costs to change later

A follow-up hands the list to the wave picker; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Not measured how often a plan still lists a generated path in two slices of one wave. (author)

```

<!-- /omni-outbox-settled: s2-02-wave-frontier-still-counts-generated-ground -->

<!-- omni-outbox-settled: s3-01-finish-rebuild-commit -->

## s3-01-finish-rebuild-commit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-finish-rebuild-commit
prd: 1138
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When the final check of a whole feature rebuilds the built files, what should its commit be called, and against what does it decide which ones are out of date?

## The decision, in plain words

The final check compares the feature with the main line it joins, rebuilds whatever that shows out of date, and commits it alone under a name that says it is the finish of the PRD, like the wave's own rebuild commit.

## The intro, for fun

Every feature gets one last tidy-up before it goes out the door.

## The punchline, for fun

Even the tidy-up needs a name tag.

## The options, in plain words

A. Name it the finish's rebuild of the PRD, compared with the main line it joins.
B. Reuse the wave's name with the last wave's number, compared with the feature before the merge.
C. Fold the rebuilt files into the merge commit, with no commit of their own.

## What I had to decide

Whether the finish's rebuild commit is named for the finish of the PRD, and compares against the main line rather than the feature's last state.

## What I did meanwhile

The finish rebuilds against the main line and commits as a finish rebuild of the PRD.

## What it costs to change later

A wording change in one skill step and its test: a constant.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the finish does the same as the wave but names no commit for it (author).

```

<!-- /omni-outbox-settled: s3-01-finish-rebuild-commit -->
