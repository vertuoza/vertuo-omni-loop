# Settled outbox items — PRD 790

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-care-help-entry -->

## s1-01-care-help-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-care-help-entry
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The new PR care command needs a line in the built-in help, but the help belongs to a later part of this work. Should this part write it now?

## The decision, in plain words

We wrote the help line for the new command now, because every command must have one for the checks to pass. The later part that adds the PR care skill builds on it.

## The intro, for fun

A new command walked in without a name tag.

## The punchline, for fun

So we printed one at the door rather than keep it waiting outside.

## The options, in plain words

A. Add the command's help entry in s1, the option built.
B. Leave the help line to the later part, and accept failing checks on the feature until then.

## What I had to decide

Whether slice s1 may add the `care` command's help entry in kit/lib/help (s5's territory), since the help test fails for any command without one.

## What I did meanwhile

s1 adds one command entry to kit/lib/help/entries.mjs and bumps the command count from 36 to 37 in entries.test.mjs; s5 adds the skill entry on top.

## What it costs to change later

One help entry and a counter in a test; undone by moving the entry into s5.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s5 wants to reword the command's help text (author)

```

<!-- /omni-outbox-settled: s1-01-care-help-entry -->

<!-- omni-outbox-settled: s1-02-which-claims-hold-a-round -->

## s1-02-which-claims-hold-a-round — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-which-claims-hold-a-round
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

PR care must not push while a wave is building. Which unfinished pieces count as a wave still building?

## The decision, in plain words

Any piece whose pull request is still open counts, even a claim gone quiet, except one marked stuck. When the list of pieces cannot be read, PR care only reports and pushes nothing.

## The intro, for fun

Is anyone still in the kitchen?

## The punchline, for fun

If a pan is on the stove, nobody mops the floor.

## The options, in plain words

A. Open sub-PRs (in flight or stale claim) hold the round, stuck ones do not, the option built.
B. Only fresh claims hold the round; a stale claim no longer freezes it.
C. Any sub-PR not yet merged holds the round, stuck ones included.

## What I had to decide

Which board states make `omni care state` report `wave.holdsClaims: true`, and what happens when the board cannot be read.

## What I did meanwhile

in-flight and claimed-stale count as claims; stuck, merged, runnable and blocked do not; an unreadable board gives holdsClaims null, which decideRound treats as report-only.

## What it costs to change later

One set of state names in kit/bin/commands/care.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a stuck sub-PR should also freeze PR care (author)

```

<!-- /omni-outbox-settled: s1-02-which-claims-hold-a-round -->

<!-- omni-outbox-settled: s1-03-asked-stays-asked -->

## s1-03-asked-stays-asked — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-asked-stays-asked
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Once PR care hands a review comment to the PM, what happens when more people reply in that thread?

## The decision, in plain words

The comment stays with the PM: PR care never picks it up again, whatever is said after. A comment PR care fixed or declined becomes the PM's the moment a reviewer answers or reopens it.

## The intro, for fun

Some conversations are above everyone's pay grade.

## The punchline, for fun

Those ones go to the PM and stay there.

## The options, in plain words

A. An asked thread stays with the PM for good, the option built.
B. PR care reads the PM's reply in an asked thread and acts on it in the next round.

## What I had to decide

How a review thread whose last care reply says asked reads when later comments arrive, and whether a reopened thread counts as the reviewer's last word.

## What I did meanwhile

A thread whose last care marker is asked stays asked with nothing to do; a fixed or pushed-back thread with a later non-care comment, or unresolved again, reads as asked and the round posts an asked reply.

## What it costs to change later

A few lines in kit/lib/care/state.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how the PM's own answer in the thread should be carried out (author)

```

<!-- /omni-outbox-settled: s1-03-asked-stays-asked -->

<!-- omni-outbox-settled: s2-01-chip-open-count -->

## s2-01-chip-open-count — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-chip-open-count
prd: 790
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The health chip says how many review comments are still open. Should that count include the comments waiting for the product manager's decision, or only the ones nobody has handled yet?

## The decision, in plain words

The chip counts every comment not yet resolved on GitHub, so it includes the ones waiting for the product manager's decision as well as the ones nobody has handled.

## The intro, for fun

Two open comments, or one open and one waiting for you? The chip had to pick a meaning.

## The punchline, for fun

It went with the plain meaning: anything not resolved yet counts as open.

## The options, in plain words

A. count every unresolved thread, asked included (built)
B. count only the threads nobody has handled, matching the tab's open count
C. show two numbers on the chip, open and asked

## What I had to decide

The spec shows the chip as `CI ✓ · no conflict · 2 open` and, on the tab, separate counts of open, fixed, pushed-back and asked threads. It does not say whether the chip's open number includes asked threads.

## What I did meanwhile

`openThreads` in `apps/galaxy/src/dossier/github/care.ts` counts every unresolved thread (unhandled plus asked), and the chip uses it.

## What it costs to change later

A one-line change to the filter in `openThreads`, and its test expectations. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether people read the chip number as all unresolved comments is not tested with a product manager (author)

```

<!-- /omni-outbox-settled: s2-01-chip-open-count -->

<!-- omni-outbox-settled: s2-02-page-reads-care-marks -->

## s2-02-page-reads-care-marks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-page-reads-care-marks
prd: 790
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The page and the terminal command both need to recognise the hidden mark a care reply carries, and the time written in the watch line. Should the page share the terminal's reader, or keep its own copy?

## The decision, in plain words

The page keeps its own small reader of the mark and of the watch line for now, because the terminal's reader is being built at the same time. It expects the watch line's times written in the standard date-and-time form.

## The intro, for fun

Two readers for one hidden mark: twins built in separate rooms on the same day.

## The punchline, for fun

They agree today; a later tidy-up can make them one.

## The options, in plain words

A. keep a separate reader on the page, standard times expected (built)
B. share the terminal's reader once it is merged, in a follow-up slice
C. fix the care line's time format in the spec and have both sides test against one fixture

## What I had to decide

s1 builds the kit's marker reader and state parser in `kit/lib/care/` in the same wave, so galaxy cannot import it yet. The spec also does not fix the time format of the status comment's `PR care: watching since <time> · last round <time>` line.

## What I did meanwhile

`apps/galaxy/src/dossier/github/care.ts` has its own `careVerdictOf` (the `<!-- omni-care: fixed|pushed-back|asked -->` marker) and reads the care line's two times with `Date.parse`, so ISO 8601 times are expected; a time it cannot parse reads as no watch.

## What it costs to change later

Swapping the local reader for an import from `kit/lib/care/` once s1 is merged is a small refactor with the same tests. If s5 writes the times in another form, only the care-line parser changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s1 and s5 write exactly this marker and ISO times is not known from this slice (author)

```

<!-- /omni-outbox-settled: s2-02-page-reads-care-marks -->
