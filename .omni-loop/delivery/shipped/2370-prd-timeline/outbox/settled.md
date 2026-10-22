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

<!-- omni-outbox-settled: s4-01-target-lanes-from-synced-repositories -->

## s4-01-target-lanes-from-synced-repositories — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-target-lanes-from-synced-repositories
prd: 2370
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a PRD lands in several repositories, should the timeline also show the repositories the loop is not set up in?

## The decision, in plain words

The timeline shows a lane only for a repository the loop already reads every quarter hour, one that carries the loop's settings. A repository without them shows no lane for now.

## The intro, for fun

Some repositories never filled in the guest book.

## The punchline, for fun

So the party photo only shows the ones who signed in.

## The options, in plain words

A. Keep it: a lane only for a repository the loop already reads, with its settings.
B. Also read the plan's targets listed in its settings (or its product's repositories) even without the loop's settings, at the price of more GitHub reads every quarter hour.

## What I had to decide

Whether a target repository that carries no `.omni-loop/config.yml` should still give its PRD a lane. Today the stages sync only lists the repositories the App reaches that carry the config (`knowledgeReader.repos`), and the reader returns an empty snapshot for any other, so a config-less target is never read.

## What I did meanwhile

Built A: `targetMilestones` (apps/galaxy/src/stages/sync/milestones.ts) reads the target feature PRs of each repository the sync already reads, and the route records a lane only for a PRD a repository of the same workspace holds. No new repository is listed and no new list call is made; the one added read is the ready events of a target feature PR, as s1 already does for every feature PR.

## What it costs to change later

Low. Lanes are dated by GitHub's own times, so reading more repositories later (B) only means listing the plan's targets and reading their pull requests: the first sync of a repository reads it in full and fills every lane it shows, shipped PRDs included. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many plan repositories of a workspace have targets without the loop's config is not known here: an imported or knowledge-less target (`plan.targets[].knowledge: imported | none`) may carry none.
- (author) Option B spends more of the App's GitHub budget each quarter hour (PRD 902); its cost was not measured.

```

<!-- /omni-outbox-settled: s4-01-target-lanes-from-synced-repositories -->

<!-- omni-outbox-settled: s4-02-plan-repository-own-lane -->

## s4-02-plan-repository-own-lane — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-plan-repository-own-lane
prd: 2370
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a PRD of a plan repository builds nothing in the plan repository itself, should its own pull request still count as one of its lanes?

## The decision, in plain words

Its own pull request always counts as a lane, as for any PRD. The spec says it counts only when it carries work of its own, so the PRD is done when that pull request merges, not at the last target's merge.

## The intro, for fun

The conductor walks on stage too, even without an instrument.

## The punchline, for fun

Nobody is sure whether to time the applause from the last violin or from the bow.

## The options, in plain words

A. Keep it: the plan's own pull request is always a lane, and the PRD is done when the last lane merges, the plan's included.
B. Leave the plan's own lane out of the timeline when it has no work of its own and the PRD has target lanes, as the spec says, filtered where the timeline is read.

## What I had to decide

The spec (section 1) says the plan repository's own feature PR is a lane 'when it carries slices of its own'. The sync writes the plan repository's lane from its feature PR as s1 does for every PRD (`milestonesOfRepo`), whatever slices it has.

## What I did meanwhile

Built A: the plan's lane is recorded whenever its feature PR exists, with no first-slice or last-slice when no sub-PR merged into it, so its Starting and Building read `not recorded`. Dropping it at write time is not reliable: the plan's feature PR opens at planning, before any target PR exists, and a milestone once written is kept.

## What it costs to change later

Low. Option B is a filter where the timeline is read (`timeline()` or the views): a lane of the PRD's own repository with no first-slice is left out when the PRD has another lane. No stored row changes, and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a plan repository's feature PR usually merges before or after its targets' PRs is not known here; it decides whether A moves the PRD's done time.
- (author) The fix belongs to `apps/galaxy/src/timeline/`, outside this slice's territory.

```

<!-- /omni-outbox-settled: s4-02-plan-repository-own-lane -->
