# Settled outbox items — PRD 2485

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-help-count-guard -->

## s1-01-help-count-guard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-help-count-guard
prd: 2485
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

Adding the new command broke a guard that counts every command the kit has, and that guard lives outside the files this part of the work may change. May it count one more command?

## The decision, in plain words

The guard now counts sixty-five commands instead of sixty-four. Nothing else in that file changed.

## The intro, for fun

One new command walked in, and the doorman's tally sheet disagreed.

## The punchline, for fun

The tally now says one more, and nobody else got in.

## The options, in plain words

A. A. Count sixty-five commands in the help table's test, as built.
B. B. Widen the plan's territory to name the help table's test, and keep the same change.
C. C. Drop the count from the test, so a new command never needs it changed.

## What I had to decide

Keep the new count of sixty-five commands in the help table's test, or ask for that test to be widened in the plan instead.
Decided by: Jev (hardToRevert 0.72) · agent said false

## What I did meanwhile

The guard is green with the new command counted; every other check of the help table runs as before.

## What it costs to change later

One number in one test; reverting it is the same one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this part named the help table but not its test, which counts the commands (author).

```

<!-- /omni-outbox-settled: s1-01-help-count-guard -->

<!-- omni-outbox-settled: s1-02-keep-when-unsure -->

## s1-02-keep-when-unsure — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-23
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-23
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-keep-when-unsure
prd: 2485
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

The design lists five reasons to keep a worktree. What should cleaning do when it cannot tell, for instance when it cannot read the progress of the work, or when the tool that made the worktree still holds a lock on it?

## The decision, in plain words

When in doubt, cleaning keeps the worktree and says why: it cannot read the progress of the work, the folder is already gone, the folder cannot be read, or another tool has locked it. A feature that has no review request yet counts as still open.

## The intro, for fun

A tidy robot found a box labelled maybe, and chose to leave it on the shelf.

## The punchline, for fun

The shelf stays a little fuller, and nothing anyone needed went in the bin.

## The options, in plain words

A. A. Keep the worktree whenever cleaning cannot be sure, and print why, as built.
B. B. Remove it on the five listed reasons alone, treating an unreadable progress as finished.
C. C. Keep it, but stay silent about the extra reasons and print only the five listed ones.

## What I had to decide

Keep a worktree whenever cleaning cannot be sure it is safe, naming why on its line, or remove it on the five listed reasons alone.
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

A worktree cleaning cannot judge stays on disk with its reason printed; a later run removes it once the reason is gone.

## What it costs to change later

Some disk stays used until the reason clears, for instance until the person signs in so the progress can be read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Other lines the design did not spell out, chosen as plain words: a trial run ends with the space it would free, one worktree is said in the singular, removing a path that is no worktree says so, and a worktree that is not the kit's says it is not the kit's (author).
- The progress of a slice is read from this checkout's PRD folder; run from a checkout that does not hold the PRD, a slice's worktree is kept until it is run where the PRD is (author).

```

<!-- /omni-outbox-settled: s1-02-keep-when-unsure -->
