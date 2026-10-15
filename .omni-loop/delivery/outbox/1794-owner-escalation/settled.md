# Settled outbox items — PRD 1794

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-delegate-entry-shape -->

## s1-01-delegate-entry-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-delegate-entry-shape
prd: 1794
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

When an owner gets a stand-in, may that owner be a team, and must every entry with a stand-in spell out both names?

## The decision, in plain words

An owner with a stand-in must be one person, and both names are required; a team stays a plain owner with no stand-in. The settings are read back exactly as written.

## The intro, for fun

A team asking for a stand-in is like a choir asking for an understudy.

## The punchline, for fun

One person, one stand-in, both names on the card.

## The options, in plain words

A. A. An owner with a stand-in is one person's login; both names are required; a team stays a plain owner.
B. B. Also allow a team as the owner of an entry with a stand-in.

## What I had to decide

Answer A to keep it, or B to allow a team owner with a person as its stand-in.

## What I did meanwhile

A team can still own the laws as a plain entry; it just cannot name a stand-in.

## What it costs to change later

Allowing it later is a one-line change to the settings check; nobody's settings break either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the key `login` but does not say whether a team may hold it (author).

```

<!-- /omni-outbox-settled: s1-01-delegate-entry-shape -->

<!-- omni-outbox-settled: s5-01-escalation-record-read -->

## s5-01-escalation-record-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-escalation-record-read
prd: 1794
slice: s5
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

To learn who is asked about a waiting question, the Omni page reads the note the GitHub App keeps on the feature pull request. Should it read that note on its own, or as part of the pull request summary it already reads?

## The decision, in plain words

The page reads the note on its own, one extra GitHub read per open feature pull request each time it recounts. When that read fails, the page keeps what it showed before, as it already does when the summary cannot be read.

## The intro, for fun

Two readers knock on the same pull request door, a few seconds apart.

## The punchline, for fun

One could carry both letters, but the second one stays within its own fence.

## The options, in plain words

A. A. A read of its own, inside the slice's territory: one more background GitHub call per open feature PR per recount; the stored dossier snapshot is unchanged.
B. B. Read the record from the comments the dossier's GitHub summary already fetches: no extra call, but the summary and its stored snapshot gain a field, outside this slice's territory.

## What I had to decide

Whether the record keeps its own read in apps/galaxy/src/stages/sync/github.ts (escalationReader), or moves into the dossier's GitHub summary (apps/galaxy/src/dossier/github/reader.ts, summary.ts, and the snapshot schema), which already lists the feature PR's comments.

## What I did meanwhile

Each recount of a PRD at building or outbox with an open feature PR makes one more background GitHub read (the PR's first 100 comments), on the installation's budget. A PRD with no open feature PR costs nothing more. A failed record read keeps the PRD's stored counts until the next recount.

## What it costs to change later

Moving the read into the summary later is a few lines in four files outside this slice and an optional field in the stored snapshot: no migration, and the stored asked field stays as it is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many open feature PRs a busy workspace holds at once, and so what the extra read costs on its budget, is not measured (author).

```

<!-- /omni-outbox-settled: s5-01-escalation-record-read -->

<!-- omni-outbox-settled: s3-01-record-keeps-the-sweeps-step -->

## s3-01-record-keeps-the-sweeps-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-record-keeps-the-sweeps-step
prd: 1794
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When the check rewrites the waiting list on a pull request, should it work out each thing's step itself from the clock, or keep the step the hourly reminder last reached?

## The decision, in plain words

The check only adds new waiting things and drops answered ones; it keeps each existing line exactly as the hourly reminder left it, so the list never claims more people were asked than were really told.

## The intro, for fun

Two clocks on one wall never agree for long.

## The punchline, for fun

So only one of them is allowed to move the hands.

## The options, in plain words

A. The check keeps each listed thing's step as the hourly reminder left it, and only adds or drops things.
B. Every check run works out each thing's step from the clock and rewrites it, and the hourly reminder only posts what is not yet posted.

## What I had to decide

Answer A to keep the step owned by the hourly reminder alone, or B to let every check run move the step from the clock.

## What I did meanwhile

A thing seen for the first time starts at step 0 with nobody new asked; a thing already listed keeps its first-held time, step, people asked and next due time until the hourly reminder moves it.

## What it costs to change later

Changing it later is a few lines in the record keeper; no stored shape changes, and the comment's text stays the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the sweep moves each due thing and the record keeps first-held time, but not whether the check may also move a step (author).

```

<!-- /omni-outbox-settled: s3-01-record-keeps-the-sweeps-step -->
