# Settled outbox items — PRD 2377

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-merge-checks-not-red -->

## s1-01-merge-checks-not-red — adopted

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
id: s1-01-merge-checks-not-red
prd: 2377
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When an approved change still has its automatic checks running, does it already wait on the person who merges it?

## The decision, in plain words

Yes: once approved, it waits on the person who merges unless a check has failed. A check still running counts as fine, and only a failed one takes it off the board.

## The intro, for fun

Approved, green-ish, and still spinning: is anyone waiting yet?

## The punchline, for fun

We said yes, and let the spinner finish the sentence.

## The options, in plain words

A. No failed check run: a running check still counts as waiting on the merge, the option built.
B. Every check run passed: a change waits on its merge only once its checks are all green, read again on every sync while it is approved.
C. Read commit statuses too, so a red status from an outside service also takes it off the board.

## What I had to decide

What "its checks are green" means for a merge wait (spec §1): no check run on the head commit failed, or every one passed.

## What I did meanwhile

A merge wait opens once a review approves and no check run failed (failure, timed out, cancelled, action required, startup failure); a run still in progress does not hold it. Only check runs are read, not commit statuses. The one check-runs read also gives the locked laws the outbox check holds the pull request on, read from that check's title, for s2.

## What it costs to change later

One set of conclusions and one condition in apps/galaxy/src/stages/sync/waits.ts and github.ts; no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A check that goes from running to green changes nothing GitHub lists as an update, so with green-only the sync would not see it until the pull request moved again: that is why running counts as fine (author)
- Commit statuses (an older GitHub API some services still use) are not read, so a red status alone does not take a change off the board (author)
- The locked laws are read from the outbox check's title as apps/omni-app/src/outbox-check/law-locked.ts words it; a change to that wording would silently drop them (author)

```

<!-- /omni-outbox-settled: s1-01-merge-checks-not-red -->

<!-- omni-outbox-settled: s1-02-no-backfill-of-old-pulls -->

## s1-02-no-backfill-of-old-pulls — adopted

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
id: s1-02-no-backfill-of-old-pulls
prd: 2377
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

On the day the board ships, should it already show the changes that were waiting before, even if nobody touched them since?

## The decision, in plain words

No: a change that was waiting before the board shipped shows up the next time anything happens on it, such as a review, a push or a label. Nothing is read twice to fill the board on day one.

## The intro, for fun

The board opens its doors, and the old queue is still outside.

## The punchline, for fun

They come in one by one, as soon as anyone knocks.

## The options, in plain words

A. Fill the board as changes move: no extra read on the first run, the option built.
B. Read every open pull request once, on the first run after the release, so the board is full on day one, at a one-off cost of a few GitHub reads per repository.

## What I had to decide

Whether the first sync after the release reads every open pull request of each repository once, to fill the board, or only the ones that changed since the last sync, as every later run does.

## What I did meanwhile

Only the pull requests the sync already lists (updated since the repository's last sync) are read for waits. A repository the sync never read before gets a full read, as today.

## What it costs to change later

A one-off read could be added later as a constant in apps/galaxy/src/stages/sync/github.ts and sync.ts (an open-pull-requests list for a repository with no waits row yet); no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many pull requests wait unchanged in today's repositories, and so how empty the board looks on day one, was not measured (author)

```

<!-- /omni-outbox-settled: s1-02-no-backfill-of-old-pulls -->

<!-- omni-outbox-settled: s1-03-which-pulls-are-read -->

## s1-03-which-pulls-are-read — adopted

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
id: s1-03-which-pulls-are-read
prd: 2377
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Which changes should the board look at, and may it read one more thing on GitHub for some of them to date their wait?

## The decision, in plain words

It looks at a change only when it can tell which PRD it belongs to, or when it is a labelled bug fix or visual update. To know since when a review was asked, it also reads the change's history, which it already did for feature changes.

## The intro, for fun

Every branch named feat looks like ours from far away.

## The punchline, for fun

So we only count the ones that can show their papers.

## The options, in plain words

A. Count a pull request only when its PRD is known or it is a labelled fix, and read its events to date a review, the option built.
B. Count every pull request on a feature-shaped branch, even with no PRD found, shown without one.
C. Read no events beyond a feature PR's, and date a phase-0 or fix review from when it was opened.

## What I had to decide

Which pull requests into the default branch count as waits (spec §1 lists phase-0, feature, bug fix and visual update ones), and whether dating a review wait may cost a third read per pull request beyond the spec's two.

## What I did meanwhile

A feature or phase-0 pull request counts only when its PRD is known: its folder's topic, else the link line its body carries (Closes #n, Refs #n). Its events are read for when a review was last asked; a feature PR's were already read, so the new read is only for phase-0 and fix pull requests that are open, ready and changed.

## What it costs to change later

One condition in apps/galaxy/src/stages/sync/waits.ts (waitedPull) and the events read in github.ts; no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many extra GitHub reads this costs a busy repository per run was not measured; it is bounded by the open, ready, changed phase-0 and fix pull requests (author)

```

<!-- /omni-outbox-settled: s1-03-which-pulls-are-read -->
