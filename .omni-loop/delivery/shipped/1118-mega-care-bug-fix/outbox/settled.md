# Settled outbox items — PRD 1118

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-waits-on-closed-or-unreadable -->

## s1-01-waits-on-closed-or-unreadable — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-waits-on-closed-or-unreadable
prd: 1118
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

When a pull request waits on another one that was closed without merging, or that cannot be looked up, should care keep holding it or go back to fixing it?

## The decision, in plain words

A closed-without-merging dependency no longer holds the pull request, so care goes back to fixing it as usual. A dependency that cannot be looked up keeps holding it, so no fix attempt is spent on a guess.

## The intro, for fun

The spec says what to do when the other pull request is open or merged, and stays quiet on the rest.

## The punchline, for fun

Somebody had to decide what a closed door means.

## The options, in plain words

A. Closed unmerged: fix as usual. Unreadable: hold.
B. Both hold until a person removes the line.
C. Both fix as usual.

## What I had to decide

Whether a closed or unreadable dependency holds the pull request.

## What I did meanwhile

Closed means fix as usual; unreadable means hold and spend nothing.

## What it costs to change later

A constant in one pure function: swapping either case is a one-line change with its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names only the open and merged cases (author).

```

<!-- /omni-outbox-settled: s1-01-waits-on-closed-or-unreadable -->

<!-- omni-outbox-settled: s1-02-care-list-reads-bug-fix-plan -->

## s1-02-care-list-reads-bug-fix-plan — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-care-list-reads-bug-fix-plan
prd: 1118
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

How does the list of pull requests find a bug's fixes and its record, and does it list a repository whose pull request is not opened yet?

## The decision, in plain words

Each row of the bug's fix-plan table counts once, in its order, and the record is the pull request that will close the bug; a repository with no pull request yet is left off the list until one opens.

## The intro, for fun

The bug-fix skill that writes the fix plan is built later, so the list had to guess its handwriting.

## The punchline, for fun

Reading a letter before it is written takes some optimism.

## The options, in plain words

A. Any reference in each table row, in order; the record from GitHub's closing links; repositories without a pull request left out.
B. A fixed column layout for the fix plan, refused otherwise.
C. List a repository without a pull request as missing.

## What I had to decide

Whether the fix-plan table and the closing link are the right places to read a bug's pull requests, and whether a repository with no pull request yet belongs on the list.

## What I did meanwhile

Rows read by any pull request reference or link in table order; records read from the pull requests GitHub links as closing the issue; no pull request yet means not listed.

## What it costs to change later

One parser and one read in the care list: the bug-fix skill can match them, or they change with their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec fixes the fix-plan marker but not the table's columns, and does not say how the record pull request is found (author).

```

<!-- /omni-outbox-settled: s1-02-care-list-reads-bug-fix-plan -->

<!-- omni-outbox-settled: s5-01-guide-rows-wait-for-skills -->

## s5-01-guide-rows-wait-for-skills — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s5
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-guide-rows-wait-for-skills
prd: 1118
slice: s5
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

The page about working across several repositories should list the two new commands in its table, but its own check refuses to name a command that does not exist yet, and the two commands are only built in later steps. When should the table list them?

## The decision, in plain words

The drawing already shows both commands now. The two table rows are written and kept aside, to be added in the same step that builds the last of the two commands, so the page never names a command that is not there.

## The intro, for fun

The guide wanted to introduce two guests who had not arrived yet.

## The punchline, for fun

The doorman checked the list and said: not until they walk in.

## The options, in plain words

A. A. Draw both now; add the two table rows and the caption names in the step that builds the second command, once both exist
B. B. Move this whole step after both commands are built, in a later wave
C. C. Name both in the table now and let the guide check stay red until both commands exist

## What I had to decide

Whether the guide's table rows for the two new commands land with the last command's own step, or the build order changes so this step runs after both.

## What I did meanwhile

The diagram and its test are merged; the guide table does not list the two commands yet, so the guide check stays green for every later step.

## What it costs to change later

Adding two table rows and two names in one picture caption: a few lines, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan put this step in the first wave and said it shares nothing with the others, but the guide check ties it to the steps that create the two commands (author)
- The rows are written and kept in the slice's hand-off; whoever builds the last command must add them, or they are lost (author)

```

<!-- /omni-outbox-settled: s5-01-guide-rows-wait-for-skills -->

<!-- omni-outbox-settled: s2-01-fixes-record-line-format -->

## s2-01-fixes-record-line-format — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-06
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-06
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-fixes-record-line-format
prd: 1118
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

When one bug is fixed in several repositories, how does its record show which reproduction and which guard belong to which repository, and what does the check skip?

## The decision, in plain words

Each repository gets its own line in the reproduction and guard parts, starting with its name in bold, short or full. Because the reproductions live in the other repositories, the check no longer looks for a reproduction file in the plan repository.

## The intro, for fun

The spec asked for one line per repository and left the shape of the line to whoever writes it.

## The punchline, for fun

So every line now wears a name tag.

## The options, in plain words

A. A. A bold name per line, either name accepted, File and Red not checked with a Fixes table, Mutation not checked per repository
B. B. The same, but Mutation also needs one line per repository
C. C. A second table instead of lines, one column per part

## What I had to decide

The shape of a per-repository line in a multi-repository bug record, and which single-repository checks it skips.

## What I did meanwhile

Lines read as `- **<name or owner/name>:** text`; table cells take either name; a pull request is `#n`, `owner/name#n` or its link and must be in the row's repository; with a Fixes table the File and Red lines are not checked; the Mutation part is not checked per repository.

## What it costs to change later

One small parser in the bug check and its tests; the bug-fix skill built later writes to whatever shape this check reads.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says one line per repository but not its shape (author)
- The spec skips only the changed-file check; the file-exists and Red checks were skipped too, since the file lives in another repository (author)
- The spec lists Mutation among the per-repository parts, but the plan's done-when checks only Reproduction and Guard (author)

```

<!-- /omni-outbox-settled: s2-01-fixes-record-line-format -->
