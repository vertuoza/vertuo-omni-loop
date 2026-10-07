# Settled outbox items — PRD 1180

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-answers-pay-the-fleet-too -->

## s1-01-answers-pay-the-fleet-too — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-answers-pay-the-fleet-too
prd: 1180
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

When someone answers a question, should their fleet's score go up too, or only their own?

## The decision, in plain words

An answer counts like every other personal credit: the answerer gets 2 points and so does their fleet, and if the PRD is later lost those points are taken back like the rest of that PRD's points.

## The intro, for fun

Two points for an answer. But whose pocket do they land in?

## The punchline, for fun

Today the whole fleet cheers, and a lost PRD takes the cheer back.

## The options, in plain words

A. Count answer points for the answerer and their fleet, and take them back when the PRD is lost, as every other personal credit.
B. Count them for the answerer only, never for the fleet.
C. Count them for both, but never take them back when the PRD is lost.

## What I had to decide

Whether answer points also count for the answerer's fleet and are taken back when the PRD is lost.

## What I did meanwhile

Fleet rankings rise by 2 for each answer a member gives on a PRD; a lost PRD voids them in its season.

## What it costs to change later

Changing it later is one line in the scoring code; the stored history stays the same and the next score run recomputes every season.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the economy pays the contributor and stamps the event with the contributor's fleet, but does not say whether the fleet's score counts it (author).

```

<!-- /omni-outbox-settled: s1-01-answers-pay-the-fleet-too -->

<!-- omni-outbox-settled: s1-02-answers-touch-files-outside-the-slice -->

## s1-02-answers-touch-files-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-answers-touch-files-outside-the-slice
prd: 1180
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The slice needed a few small changes outside the files its plan listed. Is that all right?

## The decision, in plain words

Four small changes landed outside the listed files: the database check now runs on every pull request, the test stand-in for the database learned to answer the new read, a script test covers the new read, and the arcade's How to play page lists answered questions among what earns XP.

## The intro, for fun

The plan drew a fence around this slice. Four tiny footprints are on the other side.

## The punchline, for fun

Nothing was trampled, but the gardener should know.

## The options, in plain words

A. Keep all four changes in this slice.
B. Keep the workflow and test changes, and drop the How to play line so the arcade shows answers nowhere.
C. Move all four into a follow-up slice.

## What I had to decide

Whether the four out-of-plan changes stay, or each moves to a slice of its own.

## What I did meanwhile

The new database check runs in the database workflow; the arcade's How to play shows QUESTION ANSWERED x1.

## What it costs to change later

Each change is a few lines and can be reverted on its own; none changes stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory left out the database workflow, the game's test stand-in and the arcade menu, though the conventions require a new database check to run in CI and the rulebook change breaks the menu's own test without the label (author).

```

<!-- /omni-outbox-settled: s1-02-answers-touch-files-outside-the-slice -->

<!-- omni-outbox-settled: s1-03-which-answers-are-paid -->

## s1-03-which-answers-are-paid — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-which-answers-are-paid
prd: 1180
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

Which answered questions earn points: also those asked while fixing a bug, and those from someone who has since left the workspace?

## The decision, in plain words

Only questions tied to a numbered PRD earn points, never those of a bug or visual fix, and only for someone who is still a member of the workspace with a GitHub login, the same people the dashboards list.

## The intro, for fun

A question answered during a bug hunt walks into the scoreboard.

## The punchline, for fun

The doorman checks for a PRD number and a member card.

## The options, in plain words

A. Pay only answers on numbered PRDs, by current members with a GitHub login.
B. Also pay answers asked while working on a bug or visual fix.
C. Also pay answers by people who have left the workspace, when their login is known.

## What I had to decide

Whether fix questions and former members' answers should earn points too.

## What I did meanwhile

Answers on fixes and answers by people who left the workspace are not paid; they still count in Questions answered.

## What it costs to change later

A change is a new version of one database function; past answers would be paid on the next poll, since the backfill reads from the game's start.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a numbered dossier and the workspace roster; it does not say whether a fix's dossier, which also carries a number, counts as a PRD (author).

```

<!-- /omni-outbox-settled: s1-03-which-answers-are-paid -->
