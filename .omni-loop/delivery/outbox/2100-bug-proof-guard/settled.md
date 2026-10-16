# Settled outbox items — PRD 2100

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-film-card-font -->

## s1-01-film-card-font — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-film-card-font
prd: 2100
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The spec asks for a well-known public-domain pixel font on the before and after cards, but the agent could not fetch it, so every letter was drawn by hand in the same cell size. Should a person swap in the original font's letters?

## The decision, in plain words

The cards use a hand-drawn set of letters in the same size and style as that font. Every letter, digit and test-runner mark is covered and reads cleanly, but the shapes are not copies of the original font.

## The intro, for fun

The font was supposed to arrive by post, so the agent drew every letter itself.

## The punchline, for fun

Even the lowercase g got its tail, and the question mark got a very busy week.

## The options, in plain words

A. Keep the hand-drawn letters, the option built.
B. Embed the original public-domain font's letters, supplied by a person, with its notice.

## What I had to decide

Whether the cards keep the hand-drawn letters, or a person supplies the original public-domain font for the kit to embed.
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

The cards read well with the hand-drawn letters, and swapping them later changes one table of letter shapes and no behaviour.

## What it costs to change later

One table of letter shapes, and the tests that name its cell size.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the hand-drawn shapes match the original font closely enough for a reviewer (author)
- whether the original font's notice must travel with the kit if its letters are embedded (author)

```

<!-- /omni-outbox-settled: s1-01-film-card-font -->

<!-- omni-outbox-settled: s3-01-one-clip-gets-its-link -->

## s3-01-one-clip-gets-its-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-one-clip-gets-its-link
prd: 2100
slice: s3
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

When a bug fix's film has only one of its two clips, should the page still link the clip it has?

## The decision, in plain words

Yes: each clip the film holds gets its own link, the one before the fix first, and a clip it lacks gets none.

## The intro, for fun

Two clips were promised, and only one turned up to the screening.

## The punchline, for fun

For now, the one that came gets its own link.

## The options, in plain words

A. A. Link each clip the film holds, before first, and none for a clip it lacks (built).
B. B. Link the clips only when the film holds both, so a half film shows no clip link.

## What I had to decide

Which clip links the push command prints for a bug fix whose film holds only one of the two clips.

## What I did meanwhile

Each clip held is linked, before first, from a fixed list of two names: a filter, with nothing stored to undo.

## What it costs to change later

One filter over two names, and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a film with a single clip ever reaches a pull request (author)

```

<!-- /omni-outbox-settled: s3-01-one-clip-gets-its-link -->

<!-- omni-outbox-settled: s4-01-which-plugin-copy-counts -->

## s4-01-which-plugin-copy-counts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-which-plugin-copy-counts
prd: 2100
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The tool that lists installed plugins can show the Omni plugin once for each place it is installed on the runner machine, and the copies can be at different versions. Which copy decides whether the plugin is old enough for a job?

## The decision, in plain words

The runner looks at the copy installed for the machine's user, because a job loads that one, and takes the oldest when there are several, so a stale copy is never hidden by a fresh one. With no user copy at all, it takes the newest.

## The intro, for fun

Three copies of one plugin walk into a runner and each swears it is the latest.

## The punchline, for fun

The runner trusts the oldest one, since that is the one most likely to be wrong.

## The options, in plain words

A. Count the copy installed for the user, the oldest if there are several, and the newest only when there is no user copy.
B. Count the newest copy anywhere, so one fresh copy is enough to start a job.
C. Count the oldest copy anywhere, user or project, so any stale copy triggers an update.

## What I had to decide

The list of installed plugins shows one entry per place a plugin is installed, and the spec does not say which entry a job reads. Built as: entries for the user's own place, or with no place named, are the candidates, and the oldest version among them counts; with no such entry, the newest version among all of them counts. Another rule is a change in one small function of the runner's plugin file, with its tests.

Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

A runner with a single copy behaves the same under every option. With several copies, the job is checked against the oldest user copy and updated when that one is behind.

## What it costs to change later

One small function and its tests change if a person picks another rule; nothing stored or published depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the version is read the way the sync command reads it, but that command reads one entry and does not say what to do with several (author).
- Whether Claude Code loads the user copy or a project copy inside a job's own worktree was checked only on this machine, where the plugin folder keeps each version apart (author).

```

<!-- /omni-outbox-settled: s4-01-which-plugin-copy-counts -->

<!-- omni-outbox-settled: s4-02-no-pin-no-check -->

## s4-02-no-pin-no-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-no-pin-no-check
prd: 2100
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

A repository can have no copy of the Omni program file at all, so it pins no version. Should the runner still check the plugin before a job in that repository?

## The decision, in plain words

No: with nothing pinned there is nothing to compare, so the runner starts the job without looking at the plugin at all. A repository whose program file is only a small stand-in is checked against the version of the runner's own kit.

## The intro, for fun

No pinned version means no yardstick, and the runner will not invent one.

## The punchline, for fun

A job with nothing to be older than cannot be too old.

## The options, in plain words

A. Check nothing when the repository has no program file, and use the runner's own kit version for a stand-in program file.
B. Check every repository against the runner's own kit version, whether it has a program file or not.
C. Check nothing for a repository without a program file, and nothing for a stand-in program file either.

## What I had to decide

The spec compares the plugin with the version the repository's program file carries, and says nothing about a repository that has no such file. Built as: no program file means no version is pinned and nothing is checked or called; a program file that only hands over to the global one pins the version of the kit the runner itself runs. Checking against the runner's own version for every repository is a change to one condition in the runner's plugin file.

Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Jobs in repositories without a program file start as they always did, on whatever plugin the machine has. The hourly update still keeps the plugin near the latest release.

## What it costs to change later

One condition and its tests change if a person prefers another rule; nothing stored or published depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what a repository with no program file pins, nor what a stand-in program file pins (author).

```

<!-- /omni-outbox-settled: s4-02-no-pin-no-check -->

<!-- omni-outbox-settled: s4-03-unreadable-entry-runs-job -->

## s4-03-unreadable-entry-runs-job — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-16
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-16
- Slice: s4
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-unreadable-entry-runs-job
prd: 2100
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The Omni plugin can show up in the list of installed plugins with no readable version. Should a job in that case be refused, or run like it does when the whole list cannot be read?

## The decision, in plain words

The job runs, and the first line of its log says the version was not read, exactly as for a list that could not be read at all. The runner prints a line only when the version changed or an update failed, never on a job that needed no update.

## The intro, for fun

The plugin is on the list but will not say how old it is.

## The punchline, for fun

The runner takes its word that it is fine, and writes the doubt in the log.

## The options, in plain words

A. Let the job run, with the log's first line saying the version was not read, as for an unreadable list.
B. Refuse the job, naming the missing version as the reason.
C. Update the plugin first, then read again, and refuse only if the version is still missing.

## What I had to decide

The spec lets a job run when the list does not read, and is silent on an entry that is there without a version. Built as: that entry counts as not read, with its own reason in the log's first line. On the same path the runner prints a line only when the plugin's version changed or an update failed, as the spec says for the hourly update; a job that needs no update prints nothing.

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Jobs run on whatever plugin is installed, and the log says the age was not checked. The hourly update still tries to bring the plugin up.

## What it costs to change later

One branch of the runner's plugin file and its tests change if a person prefers refusing; nothing stored or published depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what an entry without a version counts as, nor whether the lines printed on a job's path follow the hourly update's rule (author).

```

<!-- /omni-outbox-settled: s4-03-unreadable-entry-runs-job -->
