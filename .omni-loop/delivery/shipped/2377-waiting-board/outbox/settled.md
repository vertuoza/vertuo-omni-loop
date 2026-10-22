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

<!-- omni-outbox-settled: s2-01-outbox-wait-on-listed-draft-feature-pr -->

## s2-01-outbox-wait-on-listed-draft-feature-pr — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-outbox-wait-on-listed-draft-feature-pr
prd: 2377
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When does a draft feature change with open questions show as waiting on a person, and since when?

## The decision, in plain words

It shows while the sync reads that change and it is still a draft with an open high or human-action question, and it counts from the first sync that saw it. A change nobody touched since the last sync keeps what it showed.

## The intro, for fun

A question left open on a draft: when does the board start the clock?

## The punchline, for fun

We start it the first time the sync looks, and not a minute before.

## The options, in plain words

A. A. Wait on the listed draft feature PR, counted from the first sync that saw it: the option built.
B. B. Store the feature PR's number and each item's first-seen time in prd_outbox and read them there: exact, but a migration.
C. C. Read the feature PR's comments on every sync to date each item: exact, but one more GitHub read per draft.

## What I had to decide

How an outbox wait finds its pull request and its since (spec §1), when the stored outbox keeps no pull request number and no date per question.

## What I did meanwhile

An outbox wait is opened for a draft feature PR into the default branch that the sync listed (so changed since the last sync) when its PRD's stored outbox (prd_outbox) holds an open high or human-action item that is not a held law. Its turn is the PRD's owner plus the people the escalation record asks; its since is the first sync that saw it, kept after. A listed pull request that is ready, closed or has no item left ends its wait; one not listed keeps it. A law wait reads the record only for a pull request with a PRD, uses every owner and delegate laws.owners names, and keeps its row when the record cannot be read.

## What it costs to change later

One function in apps/galaxy/src/stages/sync/waits.ts (outboxWaits); a stored pull request number and first-seen date in prd_outbox would need a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) An answer given on the page that does not touch the pull request ends the wait only at the next sync that lists it
- (author) Since is the first sync that saw the items, not the time the first question was raised
- (author) laws.owners is repository-wide, so a law that names its own owners in CODEOWNERS shows every configured owner

```

<!-- /omni-outbox-settled: s2-01-outbox-wait-on-listed-draft-feature-pr -->

<!-- omni-outbox-settled: s3-01-law-wait-shows-no-law-id -->

## s3-01-law-wait-shows-no-law-id — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-law-wait-shows-no-law-id
prd: 2377
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The Waiting page should say which law a pull request is held by, but the stored wait does not keep the law's name. What should the row say?

## The decision, in plain words

A held-by-a-law row reads just 'law' for now, with the law's owners as the turn. Showing the law's name needs the sync to store it.

## The intro, for fun

The page knows a law is holding the door, but not which law's name is on it.

## The punchline, for fun

For now the row simply says 'law', and the owners know which one to look for.

## The options, in plain words

A. A. Show just the word law, with no name (built).
B. B. Store the law's name with the wait in a follow-up and show it on the row.

## What I had to decide

Show `law` with no id; the table has no column for the law's id, and this slice may not change the table.

## What I did meanwhile

The row reads `law` and links to the pull request, where the failing check names the law.

## What it costs to change later

Adding the id later is one nullable column, one sync field and one word in the row.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Where the law id should be stored (a column of waits, or read from the check) is (author) not settled by the spec.

```

<!-- /omni-outbox-settled: s3-01-law-wait-shows-no-law-id -->

<!-- omni-outbox-settled: s3-02-late-wait-limit-fixed-at-two -->

## s3-02-late-wait-limit-fixed-at-two — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-late-wait-limit-fixed-at-two
prd: 2377
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

A wait reads red after 2 working days. Should the page read that number from each repository's own setting, or keep one number for everyone?

## The decision, in plain words

The page uses 2 working days for every wait, the kit's default, instead of each repository's own setting.

## The intro, for fun

The page needs to know when a wait is officially late, and it picked two days.

## The punchline, for fun

Two working days: long enough to be fair, short enough to be nagged.

## The options, in plain words

A. A. One limit of 2 working days for every wait (built).
B. B. Read each repository's own escalation setting and colour each wait by it.

## What I had to decide

A constant of 2 working days in the board's model; the app does not read a repository's `limits.escalationWorkingDays`.

## What I did meanwhile

Every wait older than 2 working days reads red, whatever a repository's setting says.

## What it costs to change later

Reading the setting later means storing it per repository and passing it to the model: one constant replaced.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a workspace should be able to change the limit is (author) not settled by the spec.

```

<!-- /omni-outbox-settled: s3-02-late-wait-limit-fixed-at-two -->

<!-- omni-outbox-settled: s3-03-sidebar-entry-touches-switch-tests -->

## s3-03-sidebar-entry-touches-switch-tests — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-sidebar-entry-touches-switch-tests
prd: 2377
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Adding the Waiting entry to the sidebar changed two tests that list every entry, which sit outside this slice's folders. Was it right to update them?

## The decision, in plain words

Two tests of the app's page switch listed every sidebar entry, so they failed once Waiting was added. They now list Waiting too, and nothing else in them changed.

## The intro, for fun

One new menu line, and two tests in another folder noticed at once.

## The punchline, for fun

They only wanted to be told about the new neighbour.

## The options, in plain words

A. A. Update the two lists in place (built).
B. B. Leave them red and widen the plan's territory first.

## What I had to decide

Add Waiting to the entry lists in switch.test.ts and headers.test.ts, one word each; the plan's territory did not name them.

## What I did meanwhile

The tests pass with the entry listed; no production code outside the slice changed.

## What it costs to change later

Undoing it is deleting one word in each of two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan should have named the two test files is (author) left to the planner.

```

<!-- /omni-outbox-settled: s3-03-sidebar-entry-touches-switch-tests -->

<!-- omni-outbox-settled: s5-01-bell-law-line-without-id -->

## s5-01-bell-law-line-without-id — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-22
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-22
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-bell-law-line-without-id
prd: 2377
slice: s5
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

The bell's Reviews line for a held law reads just Law, not Law with the law's name, because the waits table does not store which law holds the pull request. Should the sync also record the law's name so the line can say it?

## The decision, in plain words

The line says Law and opens the pull request, where the held law is named by its check. Adding the name later means one more column and a sync change, which is a later slice.

## The intro, for fun

A bell that rings for a law without saying which one.

## The punchline, for fun

The law is in the building; its name tag is in another table.

## The options, in plain words

A. A. Keep the line as built: Law, opening the pull request.
B. B. Record the law ids in a new waits column in a later slice, and say Law <id> in the line.

## What I had to decide

The spec asks for Law <id>, but the waits table (s1, the spec's section 2) holds no law id, and this slice's territory is the bell and the route, not the sync or the migration. Built: the line reads Law. A different answer costs one constant in the bell's line and a column in the waits table.

## What I did meanwhile

The line reads Law and links to the pull request, where the law-locked check names the law.

## What it costs to change later

A person who holds several laws cannot tell which one from the bell alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the escalation record's law ids should be stored on the wait (author)

```

<!-- /omni-outbox-settled: s5-01-bell-law-line-without-id -->
