# Settled outbox items — PRD 522

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-uncomparable-read-point-is-stale -->

## s1-01-uncomparable-read-point-is-stale — adopted

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
id: s1-01-uncomparable-read-point-is-stale
prd: 522
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When the point a copied knowledge base was read at no longer exists in the other repository, for example after its history was rewritten, what should the targets list say?

## The decision, in plain words

It says the copy is stale and explains that the read point cannot be compared, so a person refreshes the copy with the sync run.

## The intro, for fun

A bookmark in a book that has since been reprinted.

## The punchline, for fun

When the page is gone, we call the copy stale and read it again.

## The options, in plain words

A. Stale, with a detail saying the read point cannot be compared: The sync run is the fix, and stale is what sends a person there.
B. Drifted: Treats it as the config no longer matching the repository.
C. Unreachable: Treats any failed reading as the repository being unreadable.

## What I had to decide

Whether a copy whose read point GitHub cannot find is reported as stale, drifted or unreachable.

## What I did meanwhile

It reads stale, with the detail 'readAt <short commit> cannot be compared with the default branch', and the command exits 1.

## What it costs to change later

One constant in the targets reader and one test; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names stale only for a moved head that changed an evidence file; this case is not in it (author).

```

<!-- /omni-outbox-settled: s1-01-uncomparable-read-point-is-stale -->

<!-- omni-outbox-settled: s1-02-failed-reading-is-unreachable -->

## s1-02-failed-reading-is-unreachable — adopted

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
id: s1-02-failed-reading-is-unreachable
prd: 522
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When GitHub answers for a repository at first but then fails partway through reading it, for example because of a rate limit, what should the targets list say?

## The decision, in plain words

The whole row reads unreachable, with the error GitHub gave, and it stays in the list. A missing file is never a failure: it only means the file is not there.

## The intro, for fun

The librarian let us in, then turned the lights off halfway down the aisle.

## The punchline, for fun

We do not guess what was on the dark shelves: the row says unreachable.

## The options, in plain words

A. Unreachable, with the error line: the row is kept and nothing is guessed.
B. Keep what was read and mark the rest unknown: a new word the next PRDs would have to learn.
C. Stop the whole command with an error: one bad repository hides every other row.

## What I had to decide

Whether a reading that fails after the repository itself answered makes the row unreachable, or is reported some other way.

## What I did meanwhile

Any failure other than a missing file makes that row unreachable, with the error line as its detail; the command exits 1.

## What it costs to change later

One branch in the targets reader; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec defines unreachable as a repository gh cannot read, not a reading that fails partway (author).

```

<!-- /omni-outbox-settled: s1-02-failed-reading-is-unreachable -->

<!-- omni-outbox-settled: s2-01-copy-names-no-local-path -->

## s2-01-copy-names-no-local-path — adopted

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
id: s2-01-copy-names-no-local-path
prd: 522
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The spec says the source list of a copied knowledge base is never looked for in the plan repository. Should the other file references in a copy, such as where a rule is enforced or which page a section points to, also be left unchecked?

## The decision, in plain words

Every file a copy names is treated as a file of the other repository, so none is looked for in the plan repository; only the copy's shape and wording are checked.

## The intro, for fun

A copy of someone else's notes keeps pointing at their desk drawers.

## The punchline, for fun

So we stopped opening our own drawers to look for them.

## The options, in plain words

A. Skip every file lookup inside a copy (built).
B. Skip only the source list, as the spec words it; the rule references of a copy would then fail the check.
C. Check each reference against the other repository through GitHub, at the commit the copy was read at.

## What I had to decide

Whether the rule and page references of a copy are checked against the plan repository, skipped, or checked against the other repository.

## What I did meanwhile

Only the structure of a copy is graded; a wrong file name inside a copy goes unnoticed until the sync run redraws it.

## What it costs to change later

Changing it is one condition in each grader; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a copy may ever point at a page of the plan repository itself is not settled (author).

```

<!-- /omni-outbox-settled: s2-01-copy-names-no-local-path -->

<!-- omni-outbox-settled: s2-02-missing-copy-fails-check -->

## s2-02-missing-copy-fails-check — adopted

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
id: s2-02-missing-copy-fails-check
prd: 522
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the config says the knowledge of a repository is copied into the plan repository but the copy's folder is not there, should the knowledge check fail or only warn?

## The decision, in plain words

The check fails and names the missing folder, because the config then claims something that is not true.

## The intro, for fun

The guest list says the cousin brought a cake.

## The punchline, for fun

There is no cake, so the party check says so.

## The options, in plain words

A. Fail the check, naming the folder (built).
B. Warn only, and let the check pass.

## What I had to decide

Whether a copied repository with no copy folder fails the knowledge check or only warns.

## What I did meanwhile

A plan repository whose config lists a copy it does not hold stays red until the copy is added or the config says own or none.

## What it costs to change later

Turning it into a warning is one line; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nothing in the spec says whether the config or the folder is the truth when they disagree (author).

```

<!-- /omni-outbox-settled: s2-02-missing-copy-fails-check -->

<!-- omni-outbox-settled: s3-01-s3-rebuilds-the-bundle -->

## s3-01-s3-rebuilds-the-bundle — adopted

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
id: s3-01-s3-rebuilds-the-bundle
prd: 522
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The plan said the new skill's slice would not touch the built copy of the command line, but adding its help page does change it. Should that slice rebuild it anyway?

## The decision, in plain words

It rebuilt the built copy so the help page for the new skill ships with the next release and the checks stay green; the other slice of this wave rebuilds it too, so the two copies are merged by building once more.

## The intro, for fun

The plan swore this slice would never touch the build. The help page had other ideas.

## The punchline, for fun

So it rebuilt it, politely, and left a note on the fridge.

## The options, in plain words

A. Rebuild the bundle in this slice, beside the help entry (what was built).
B. Leave the bundle stale in this slice and rebuild it once after the wave merges; the slice's own test run stays red until then.

## What I had to decide

Whether the skill slice may rebuild the committed bundle outside its listed territory.

## What I did meanwhile

The bundle carries the new help entry; when the wave merges both slices, the bundle is rebuilt once from the merged source.

## What it costs to change later

A constant: the rebuilt bundle is a pure build of the source, so dropping this commit and rebuilding after the wave merge gives the same file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's shared-ground note says s3 changes no bundled source; it did not count the help entries, which the bundle carries. (author)

```

<!-- /omni-outbox-settled: s3-01-s3-rebuilds-the-bundle -->

<!-- omni-outbox-settled: s3-02-copy-forms-shaped-like-own -->

## s3-02-copy-forms-shaped-like-own — adopted

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
id: s3-02-copy-forms-shaped-like-own
prd: 522
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the skill drafts another repository's knowledge base inside the plan repository, what blank pages should it start the draft from?

## The decision, in plain words

It starts from the plan repository's own pages: the same pages, headings and order, with none of their text, then fills each part only from what the other repository shows.

## The intro, for fun

A draft needs a blank notebook, and the only notebook on the desk is the plan repository's.

## The punchline, for fun

So it borrowed the ruled lines and left every page of notes behind.

## The options, in plain words

A. Take the empty shape from the plan repository's own pages, never their text (what was built).
B. Add a way for the kit to lay blank pages down in any folder, and have the skill use it.
C. Write only the pages the other repository's evidence fills, and no blank ones.

## What I had to decide

Where the skill takes the empty shape of an imported copy's pages from.

## What I did meanwhile

The skill's instructions say to copy the page names, headings and order from the plan repository's own pages, and never their text.

## What it costs to change later

A constant: one paragraph of the skill's instructions, and no copy exists yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only that a copy uses a knowledge folder's own layout; the kit offers no command that lays blank pages down in another folder. (author)

```

<!-- /omni-outbox-settled: s3-02-copy-forms-shaped-like-own -->
