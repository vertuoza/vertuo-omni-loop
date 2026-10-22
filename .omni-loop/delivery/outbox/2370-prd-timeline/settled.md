# Settled outbox items — PRD 2370

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-timeline-github-reads -->

## s1-01-timeline-github-reads — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-timeline-github-reads
prd: 2370
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

To date every shipped PRD's timeline, the sync now reads each repository in full once, and asks GitHub one extra question per merged feature pull request to learn when it was marked ready. Is that cost acceptable?

## The decision, in plain words

I let the first sync after the merge read each repository in full once, and read when each merged feature pull request was first marked ready, so the shipped PRDs get their timelines too.

## The intro, for fun

Every timeline needs a history lesson, and history lives on GitHub.

## The punchline, for fun

One long read today, short reads every quarter hour after.

## The options, in plain words

A. Keep the one full read and read when each merged feature pull request was first marked ready.
B. Read only what changed, as before, and leave the shipped PRDs without a ready date.
C. Keep the full read, but take the ready date from the stored stages instead of asking GitHub.

## What I had to decide

Answer A to keep the one full read and the extra question per merged feature pull request. Answer B to read only what changed, leaving shipped PRDs without a ready date or a full timeline.

## What I did meanwhile

The sync reads a repository in full while it holds no milestone, then goes back to reading only what changed since the earlier of its stages' and its milestones' last sync. It asks for a feature pull request's events once it merged, not only while it is open and ready.

## What it costs to change later

A: one full read per repository after the merge (about 220 PRDs here, so about 220 extra event reads), then one extra read per feature pull request that merges or changes after it merged; all at background priority, which steps back when the budget runs low. B: a constant to change in the sync; the shipped PRDs' timelines stay partial.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A repository that holds PRDs but none GitHub can date is read in full each quarter hour, as one with no PRD issue already is for its stages. (author)

```

<!-- /omni-outbox-settled: s1-01-timeline-github-reads -->

<!-- omni-outbox-settled: s1-02-server-born-feature-pr -->

## s1-02-server-born-feature-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-server-born-feature-pr
prd: 2370
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

A PRD approved on the Omni page keeps its folder off the main branch until it ships, so the sync cannot tell its feature branch by the folder. Should the sync find it by the feature pull request whose description says it closes that PRD?

## The decision, in plain words

For a PRD approved on the Omni page, the sync takes as its feature pull request the one on a feature branch whose description closes that PRD, and dates its slices, ready and merge from it while it is built.

## The intro, for fun

A PRD without a folder is a guest without a name tag.

## The punchline, for fun

So the sync reads the guest list instead: the line that closes it.

## The options, in plain words

A. Find the feature pull request of a PRD approved on the Omni page by the line that closes it.
B. Date such a PRD's lane only once it ships and its folder reaches the main branch.

## What I had to decide

Answer A to keep finding these PRDs' feature pull requests by their closing line. Answer B to date them only once they ship and their folder reaches the main branch, accepting that their earlier slices go unrecorded.

## What I did meanwhile

The sync keeps each pull request's description from the list it already reads, and for each PRD approved on the Omni page with no folder on the main branch, takes the feature pull request whose description carries the repository's closing line for it.

## What it costs to change later

A: none beyond the description already in the list, and the events of that one pull request. B: a few lines to remove; those PRDs' first and last slice stay not recorded, since a later read only sees what changed recently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A feature pull request whose description drops the closing line is not found, and that PRD's lane waits until it ships. (author)

```

<!-- /omni-outbox-settled: s1-02-server-born-feature-pr -->

<!-- omni-outbox-settled: s1-03-what-dates-a-lane -->

## s1-03-what-dates-a-lane — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-what-dates-a-lane
prd: 2370
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

The spec leaves three dating details open: whether approval comes from the stored stage, which ready moment counts when a pull request goes back to draft, and which pull requests count as slices. Are the choices below right?

## The decision, in plain words

Approval is the phase-0 merge or the first approval, never the stored stage, which can hold the sync's own time. Ready is the first time the feature pull request was marked ready, and a slice is any pull request merged into the feature branch.

## The intro, for fun

Three clocks, one question: which tick counts?

## The punchline, for fun

We picked the ones GitHub signs, never the sync's own watch.

## The options, in plain words

A. Approval from GitHub or the page, the first ready moment, and any pull request merged into the feature branch as a slice.
B. Approval from the stored stage, the latest ready moment, and only slice-shaped branches as slices.

## What I had to decide

Answer A to keep these three choices. Answer B to take approval from the stored stage, the latest ready moment, and only slice-shaped branches as slices.

## What I did meanwhile

The sync dates approval from the phase-0 merge or the first approval, never the sync's time; ready from the first ready event of the feature pull request (its opening when opened ready); and first and last slice from every pull request merged into the feature branch, the last one before the feature pull request merged.

## What it costs to change later

A: none. B: a constant each in the sync's milestone code; a time already recorded stays, since the first time wins, so a change applies to PRDs not yet dated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A pull request with more than a hundred events is read on its first page only; its first ready event is almost always there, as events come oldest first. (author)

```

<!-- /omni-outbox-settled: s1-03-what-dates-a-lane -->
