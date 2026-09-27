# Settled outbox items — PRD 216

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-draft-choice-guards -->

## s1-01-draft-choice-guards — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-draft-choice-guards
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec says a push numbers the draft this Claude session opened, or else the only unnumbered draft on the computer. That second rule can take a draft another brainstorm opened at the same time: should the push be stricter?

## The decision, in plain words

Yes, a little: a terminal that knows its Claude session never takes a draft another session opened, and once a PRD was numbered from this computer, a later push of it takes no other draft. Without a session id, the spec's rule stands as written.

## The intro, for fun

Two brainstorms shared one notebook of drafts, and a push came looking for its page.

## The punchline, for fun

It now reads the name on the page before tearing it out.

## The options, in plain words

A. Keep both guards: never another session's draft, and no other draft once the PRD was numbered here
B. Follow the spec to the letter: this session's draft, else the only unnumbered one, whoever opened it
C. Keep only the first guard, and still take the only unnumbered draft after the PRD was numbered here

## What I had to decide

Follow the spec's second rule to the letter, or keep a push from numbering a draft another brainstorm opened, which would merge that brainstorm into the wrong PRD.

## What I did meanwhile

A push takes this session's own draft first. From a terminal with a session id it never takes a draft another session opened, and after PRD n was numbered on this computer, later pushes of n reach its dossier by its key.

## What it costs to change later

One small function in the kit and its tests: dropping a guard is deleting two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a brainstorm ever runs across two Claude sessions (after clearing the conversation, say) is unknown; then the second session's push leaves the first session's draft unnumbered (author).

```

<!-- /omni-outbox-settled: s1-01-draft-choice-guards -->

<!-- omni-outbox-settled: s1-04-push-retitles-and-dates-merge -->

## s1-04-push-retitles-and-dates-merge — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-push-retitles-and-dates-merge
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Each push carries the spec's title, and a draft numbered to a dossier the fallback already made is merged into it. Should every push rename the dossier, and which opening date should a merged dossier keep?

## The decision, in plain words

Every push sets the title to the spec's latest one. A merged dossier keeps the earlier opening date, the draft's, so the questions asked during that brainstorm still belong to it.

## The intro, for fun

The draft arrived first, and the fallback's copy arrived later with all the paperwork.

## The punchline, for fun

The dossier now remembers who was actually early.

## The options, in plain words

A. Retitle on every push, and date a merged dossier from the earlier opening
B. Title a dossier only when it is created or numbered, and keep the fallback's date on a merge
C. Retitle on every push, but keep the fallback's date on a merge

## What I had to decide

Rename the dossier on every push or only once, and keep the fallback's date or the draft's when the two merge.

## What I did meanwhile

The title follows the spec on every push, and a merge dates the dossier from the draft's opening.

## What it costs to change later

One line each in the database function and the test fake; no row changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The questions slice reads the opening date for its brainstorm rule; it is assumed to read this same date (author).

```

<!-- /omni-outbox-settled: s1-04-push-retitles-and-dates-merge -->

<!-- omni-outbox-settled: s1-05-version-numbers-counted -->

## s1-05-version-numbers-counted — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-version-numbers-counted
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Versions show as v1, v2 and v3, but the spec's tables hold no version number. Should the number be stored, or counted from the order the versions were added?

## The decision, in plain words

It is counted: a version's number is its place among the versions of its kind, by the time it was added. Each version is timed as it is written, after the dossier is locked, so the newest is always the last added.

## The intro, for fun

Every version wanted a number on its shirt, and nobody had printed any.

## The punchline, for fun

They now line up by arrival and count off.

## The options, in plain words

A. Count each version's place among its kind, by the time it was added
B. Store a number on each version, unique for its dossier and kind

## What I had to decide

Store a number on each version, or count them.

## What I did meanwhile

A push answers each added version's number by counting, and the page slices can count the same way.

## What it costs to change later

Storing a number later is one additive migration, filled from the same order.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None beyond the spec: two versions of one kind are never added at the same moment, since a push holds the dossier's lock (author).

```

<!-- /omni-outbox-settled: s1-05-version-numbers-counted -->

<!-- omni-outbox-settled: s1-06-dossier-command-lines -->

## s1-06-dossier-command-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-06-dossier-command-lines
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec lists the command's lines and exit codes, but not which stream carries them, how a push ends when one file is too large, or what a missing PRD folder is.

## The decision, in plain words

A skip line goes to the error stream and a result to the normal one; a push with a file too large still sends the others, names that file and ends as skipped. The status line never fails, and a PRD with no folder is a usage mistake.

## The intro, for fun

One file was too big for the suitcase, so the others flew without it.

## The punchline, for fun

A note in the suitcase says which one stayed home.

## The options, in plain words

A. Skip lines on the error stream, a partly sent push ends as skipped, and a missing folder is a usage mistake
B. Every line on the normal stream, so a skill reads one place
C. A partly sent push ends as done, with the file too large named as a warning

## What I had to decide

Which stream carries which line, and how a partly sent push ends.

## What I did meanwhile

The two small skills of the next wave print whatever the command printed, on either stream.

## What it costs to change later

A few constants in the command and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The skills are not written yet; they are assumed to show both streams (author).

```

<!-- /omni-outbox-settled: s1-06-dossier-command-lines -->

<!-- omni-outbox-settled: s1-07-fallback-writes-through-grants -->

## s1-07-fallback-writes-through-grants — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-07-fallback-writes-through-grants
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The fallback slice may not add a database migration, yet it must create dossiers and add versions as the service account. What should this slice give it?

## The decision, in plain words

The service account may read both tables, create a dossier by its key and rename it, and add versions only through the version rule the kit's push uses. It may not delete anything or write a version directly.

## The intro, for fun

The night shift needed a key, and the building only had master keys.

## The punchline, for fun

We cut one that opens the front door and the mail slot.

## The options, in plain words

A. Table rights to read, create and rename, and the version rule for versions
B. One function for the fallback that finds or creates the dossier and adds its versions in one call
C. Nothing now: the fallback slice adds what it needs, outside its listed files

## What I had to decide

Give the fallback a few table rights plus the version rule, or one function that does its whole job.

## What I did meanwhile

The fallback slice can create dossiers with its table rights and call the version rule for each changed file.

## What it costs to change later

Moving to a single function later is one migration and a change in the fallback's script.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The fallback's exact reads are not designed yet; it may need a right this slice did not grant (author).

```

<!-- /omni-outbox-settled: s1-07-fallback-writes-through-grants -->
