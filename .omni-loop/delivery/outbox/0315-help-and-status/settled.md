# Settled outbox items — PRD 315

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-failed-fetch-keeps-last-fetch-time -->

## s1-01-failed-fetch-keeps-last-fetch-time — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-failed-fetch-keeps-last-fetch-time
prd: 315
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When fetching fresh data fails, what should the overview say about how old the data it shows is?

## The decision, in plain words

It keeps saying when the last fetch that worked happened. When a fetch failed earlier, outside the overview, it says the data was never fetched.

## The intro, for fun

Git forgets when it last fetched the very moment a fetch fails.

## The punchline, for fun

The overview now remembers for it, and puts things back as they were.

## The options, in plain words

A. Put the record of the last fetch back after a failed fetch, and read an empty record as never fetched: the option built.
B. Leave the record git emptied as it is, and read its time: the header then says the data was just fetched right after a fetch failed.
C. Leave the record as it is, and give the header a third wording, last fetch failed, whenever the record is empty.

## What I had to decide

How the header reads the time of the last fetch when a fetch fails. The spec takes it from the checkout's `FETCH_HEAD`, but a failed `git fetch` empties `FETCH_HEAD` and stamps it with the failure's time. So a failed `omni status --fetch` would print `fetch failed: …; showing your last fetch` above a header saying `fetched just now`, and every later run would say the same.

## What I did meanwhile

`fetchRemote` in `kit/lib/status/facts.mjs` saves `FETCH_HEAD` (its bytes and times, or its absence) before `git fetch --prune`, and puts it back when the fetch fails, so the header still names the last fetch that worked. An empty `FETCH_HEAD`, which a failed fetch run outside `omni status` leaves, reads as `never fetched`. Pinned by three cases in `kit/bin/status.test.mjs`.

## What it costs to change later

Two small functions in `kit/lib/status/facts.mjs` and their tests. No stored data: the only file touched is the checkout's own `FETCH_HEAD`, put back as it was.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec takes the header's time from `FETCH_HEAD` and does not say what a failed fetch does to it: git empties it (seen with git 2.43).

```

<!-- /omni-outbox-settled: s1-01-failed-fetch-keeps-last-fetch-time -->

<!-- omni-outbox-settled: s1-02-nothing-in-progress-under-a-full-bar -->

## s1-02-nothing-in-progress-under-a-full-bar — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-nothing-in-progress-under-a-full-bar
prd: 315
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When every PRD has shipped, what should the line under the progress bar say?

## The decision, in plain words

It says nothing in progress. The spec only shows that line while some PRDs are still waiting or being built.

## The intro, for fun

The spec drew the bar with work still to do, never on the day it is all done.

## The punchline, for fun

A full bar now gets a quiet line under it: nothing in progress.

## The options, in plain words

A. Nothing in progress, under a full bar: the option built.
B. Zero in progress, the same shape as the line when work remains.
C. No line at all under a full bar.

## What I had to decide

What the line under the bar says once the bar is full. The spec draws it as `<n> in progress: <k> in the inbox, <m> in the outbox`, which would read `0 in progress: ` with nothing after the colon once every PRD has shipped.

## What I did meanwhile

`formatOverview` in `kit/lib/status/format.mjs` prints `nothing in progress` under a full bar, and the in-progress line names only the stages that hold a PRD. Pinned in `kit/lib/status/format.test.mjs`.

## What it costs to change later

One string in `kit/lib/status/format.mjs` and its test. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example and the plan's checks always have something in progress, and say nothing of a full bar.

```

<!-- /omni-outbox-settled: s1-02-nothing-in-progress-under-a-full-bar -->

<!-- omni-outbox-settled: s2-01-counts-line-leaves-empty-stages-out -->

## s2-01-counts-line-leaves-empty-stages-out — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-counts-line-leaves-empty-stages-out
prd: 315
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When nothing is being built or waiting for review, should the overview's counts still name the outbox and the PRDs in review, with a zero?

## The decision, in plain words

The outbox and the PRDs in review show only when they hold at least one PRD, so a quiet repository reads as shipped and inbox alone. An outbox that holds PRDs always says how many open items it has, zero included.

## The intro, for fun

A dashboard can shout zero at you, or just keep quiet about it.

## The punchline, for fun

This one keeps quiet, and only speaks up once something is there.

## The options, in plain words

A. Leave the outbox and the review stage out while they are empty, and give the open items with the outbox, zero included: the option built.
B. Always show all four counts, with a zero where a stage is empty.
C. Leave the open items out beside an outbox that has none open, and show them only when some wait for an answer.

## What I had to decide

How the counts line reads when a stage is empty. The spec shows it once, `SHIPPED 26     INBOX 2     OUTBOX 1 · 3 open items     IN REVIEW 1`, with every stage holding a PRD, and the plan's s1 check pins `SHIPPED 3     INBOX 2` for a repository with no feature or phase-0 branch. Neither says what an empty outbox, an empty review stage, or an outbox with no open item reads as, nor how the line keeps within 80 columns once the counts grow long.

## What I did meanwhile

`counts` in `kit/lib/status/format.mjs` always prints `SHIPPED` and `INBOX`, adds `OUTBOX <n> · <k> open item(s)` only when the outbox holds a PRD (`0 open items` when none is open), and adds `IN REVIEW <n>` only when a PRD is in review, so s1's `SHIPPED 3     INBOX 2` still holds. A count that would push the line past 80 columns starts a second line, indented like the first. Pinned in `kit/lib/status/format.test.mjs` and `kit/bin/status.test.mjs`.

## What it costs to change later

Two conditions and one wrapping loop in `kit/lib/status/format.mjs`, and the lines of the tests that pin them. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's only example has every stage holding a PRD; the plan's s1 check has neither an outbox nor a review stage, and says nothing of them.

```

<!-- /omni-outbox-settled: s2-01-counts-line-leaves-empty-stages-out -->

<!-- omni-outbox-settled: s2-02-fetch-time-read-across-worktrees -->

## s2-02-fetch-time-read-across-worktrees — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-fetch-time-read-across-worktrees
prd: 315
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When the overview runs from a second working copy of the repository, whose last fetch should its header report?

## The decision, in plain words

It reports the newer of two fetches: the one run from this working copy, and the one run from the main one. A fetch run from a third working copy is not seen, even though it refreshed the same data.

## The intro, for fun

Git remembers the last fetch per working copy, yet shares what was fetched between them all.

## The punchline, for fun

So the header now asks the main copy too before it says never.

## The options, in plain words

A. The newer of this working copy's last fetch and the main one's: the option built.
B. The newest fetch of any working copy of the repository, reading every linked worktree's record too.
C. Only this working copy's own fetch, as before: a linked worktree says never fetched until it fetches itself.

## What I had to decide

Where the header's fetch time comes from in a linked worktree. The spec takes it from the checkout's `FETCH_HEAD`, but git keeps one per worktree while the remote-tracking branches the overview reads are shared: wave 1's check found that `omni status`, run in a linked worktree, printed `never fetched` right after a fetch in the main checkout.

## What I did meanwhile

`fetchedAt` in `kit/lib/status/facts.mjs` takes the newer non-empty time of this checkout's `FETCH_HEAD` (`git rev-parse --git-path FETCH_HEAD`) and of the one in the common git folder (`git rev-parse --git-common-dir`); in a plain clone both are the same file. `fetchRemote` still saves and puts back only this checkout's own. Pinned by two cases in `kit/bin/status.test.mjs`.

## What it costs to change later

One function in `kit/lib/status/facts.mjs` and two tests. No stored data: it only reads the times of files git writes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the checkout's `FETCH_HEAD` and does not consider linked worktrees, where git keeps a `FETCH_HEAD` of their own.
- (author) Any fetch writes `FETCH_HEAD`, even one of a single branch, so the time it gives is the last fetch of anything, not of the default branch alone; this was true before this change too.

```

<!-- /omni-outbox-settled: s2-02-fetch-time-read-across-worktrees -->

<!-- omni-outbox-settled: s2-03-branch-without-shared-history-skipped -->

## s2-03-branch-without-shared-history-skipped — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-branch-without-shared-history-skipped
prd: 315
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When a feature branch shares no history with the main line, so the overview cannot tell what it built, should it still count its open questions?

## The decision, in plain words

No: the whole branch is skipped, the way a branch the overview cannot read is, and its PRD stays in the inbox. The overview still shows everything else.

## The intro, for fun

A branch with no common past cannot say what it changed since it left.

## The punchline, for fun

So the overview lets it sit this one out rather than guess.

## The options, in plain words

A. Skip the whole branch, its open items included: the option built.
B. Read it as not built, and still count its open items, so a PRD with open questions on such a branch shows in the outbox.

## What I had to decide

What a feature branch that cannot be compared with the base does to the counts. The spec skips a branch whose tree cannot be read, and decides built from `git diff <base>...<feature>`, which fails when the two share no commit. Its tree can still be read, so the spec's rule does not say whether its open items count.

## What I did meanwhile

`featuresOf` in `kit/lib/status/facts.mjs` reads a feature branch's built check and its open items together, and skips the branch when any of those git calls fails, so a branch with no merge base is left out like an unreadable one. Pinned in `kit/bin/status.test.mjs` with a feature branch that has no history in common with `main`, beside two remote branches that point at a file instead of a commit.

## What it costs to change later

One helper in `kit/lib/status/facts.mjs` and one test. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names an unreadable tree only; a feature branch cut outside the main line's history is not considered, and none of this repository's branches is one.

```

<!-- /omni-outbox-settled: s2-03-branch-without-shared-history-skipped -->

<!-- omni-outbox-settled: s4-01-prd-number-still-shows-the-overview -->

## s4-01-prd-number-still-shows-the-overview — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-prd-number-still-shows-the-overview
prd: 315
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When someone asks the status command in Claude about one PRD by its number, what should it do?

## The decision, in plain words

It shows the whole repository's overview anyway, then adds one line saying it has no view of a single PRD and that their own PRDs are listed in it.

## The intro, for fun

Someone asks the overview about one PRD, and the overview only knows how to show them all.

## The punchline, for fun

So it shows them all, and points at the row that answers.

## The options, in plain words

A. Show the whole overview anyway, then one line saying it covers every PRD and lists theirs: the option built.
B. Name what the command takes, a request for fresh data or nothing, and stop without showing anything, as the ask mode command does.
C. Show the whole overview, then repeat below it the row of that PRD when it is one of theirs.

## What I had to decide

What `/omni:status` does with an argument other than a request for fresh data, such as a PRD number. The spec says the skill runs `omni status`, with `--fetch` when the person asks for fresh data, and never runs the gate; it says nothing of any other argument. `/omni:ask`, the thin skill the spec names as its model, answers an unknown argument by naming the words it takes and stopping.

## What I did meanwhile

`kit/plugin/skills/status/SKILL.md`, under Input: a PRD number or anything else runs the overview anyway (fetching first when fresh data was also asked for), then one line under it says `/omni:status` shows the whole repository, never one PRD alone, and that the person's own PRDs are listed in it with where each stands. The gate is never run: the plugin test pins that no `omni status <`, PRD number or gate flag appears in the skill.

## What it costs to change later

A few lines of prose in one skill. No code, no stored data, no command changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan say what the skill runs and that it never runs the gate, and nothing about an argument it does not take.
- (author) Whether people will type a PRD number after the command at all is not known.

```

<!-- /omni-outbox-settled: s4-01-prd-number-still-shows-the-overview -->

<!-- omni-outbox-settled: s3-01-one-open-item-waits -->

## s3-01-one-open-item-waits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-one-open-item-waits
prd: 315
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When exactly one question of yours waits for an answer, how should the overview's row say it?

## The decision, in plain words

It says 1 open item waits for an answer, so the verb agrees with a single item. With two or more it says they wait, as the spec writes it.

## The intro, for fun

The spec wrote the row for a crowd of questions, never for one on its own.

## The punchline, for fun

One lonely question now waits, and a crowd of them still wait together.

## The options, in plain words

A. Make the verb agree: 1 open item waits, 2 open items wait: the option built.
B. Keep the spec's letter for every count: 1 open item wait for an answer.
C. Word it so no verb has to agree, such as open items: 1, waiting for an answer.

## What I had to decide

The words of an outbox row of yours when exactly one open item is left. The spec and the plan give them as `<k> open item(s) wait for an answer`: the `(s)` says the noun follows the count, but the verb is written only for many, so `1 open item wait for an answer` would follow the letter of the plan's check.

## What I did meanwhile

`standing` in `kit/lib/status/format.mjs` prints `1 open item waits for an answer` for one and `<k> open items wait for an answer` for more. Pinned in `kit/lib/status/format.test.mjs` and `kit/bin/status.test.mjs`.

## What it costs to change later

One condition in `kit/lib/status/format.mjs` and the lines of the tests that pin it. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan write the row as a template, `<k> open item(s) wait for an answer`, and never show it with one item.

```

<!-- /omni-outbox-settled: s3-01-one-open-item-waits -->

<!-- omni-outbox-settled: s3-02-shipped-list-wraps-under-the-rows -->

## s3-02-shipped-list-wraps-under-the-rows — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-28
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-shipped-list-wraps-under-the-rows
prd: 315
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When the list of your shipped PRDs runs onto a second line, where should that line start?

## The decision, in plain words

It starts where the numbers of the rows above it start, as the spec's example draws it, not under the first shipped PRD of the list.

## The intro, for fun

The spec's picture and the plan's sentence disagree by exactly four spaces.

## The punchline, for fun

The picture won, and the list now lines up with the rows above it.

## The options, in plain words

A. Start the next lines where the rows' numbers start, as the spec's example draws it: the option built.
B. Start them under the first shipped PRD of the list, four columns further right, as the plan's sentence reads.

## What I had to decide

Where the continuation lines of the `shipped` row of yours start. The spec's example starts them at the same column as the `#` of the rows above, under the count `24:`. The plan's check says the list is wrapped at 80 columns under the first entry, which read literally is four columns further right, under `#301`.

## What I did meanwhile

`shippedRow` in `kit/lib/status/format.mjs` starts every continuation line at column 13, the column the line under the bar and the other rows' numbers start at, and never ends a line on the separator. Pinned against the spec's example in `kit/lib/status/format.test.mjs`.

## What it costs to change later

One indent in `kit/lib/status/format.mjs` and the lines of the tests that pin it. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example and the plan's check place the second line of the shipped list at two different columns; the spec was taken as the source of truth.

```

<!-- /omni-outbox-settled: s3-02-shipped-list-wraps-under-the-rows -->
