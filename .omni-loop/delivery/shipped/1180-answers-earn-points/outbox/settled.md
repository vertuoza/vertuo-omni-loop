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

<!-- omni-outbox-settled: s3-01-capital-login-skipped -->

## s3-01-capital-login-skipped — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-capital-login-skipped
prd: 1180
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

GitHub accounts may be spelt with capital letters, like Serghok. Should points credited to such an account be skipped until it is spelt in lower case, or credited as GitHub spells it?

## The decision, in plain words

They are credited as GitHub spells them: the login check ignores case, and skips only names holding an at sign, a dot, a space or another character no GitHub login can hold. This departs from the spec's acceptance criterion 7, which also refused upper case.

## The intro, for fun

Somebody signed up to GitHub with their caps lock on.

## The punchline, for fun

The ledger reads their name the way GitHub does: without shouting back.

## The options, in plain words

A. Skip an event credited to a capitalised name, with a warning naming it, as the spec's criterion 7 says.
B. Lower the name before the check, so a capitalised GitHub name is credited under its lower-case spelling.
C. Accept the name in any case, as GitHub issues it, and credit it as spelt.

## What I had to decide

Skip capitalised names, lower them, or accept them as GitHub spells them.

## What I did meanwhile

C. As first built, the slice skipped capitalised names (A), but 12 members of the vertuoza GitHub organisation have a capital in their login, and one (`Serghok`) merged a pull request here: A would have stopped crediting them with every new point, zones secured included. The orchestrator changed the check to ignore case before merging. Contributors stay spelt as GitHub gives them; the board and the roster already match logins whatever their case.

## What it costs to change later

One flag in the projector and a test, no migration.

## What I could not know

(orchestrator) Whether anyone relies on criterion 7 refusing upper case; nothing in the code or the registers does.

```

<!-- /omni-outbox-settled: s3-01-capital-login-skipped -->

<!-- omni-outbox-settled: s3-02-dotted-approver-waits -->

## s3-02-dotted-approver-waits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-dotted-approver-waits
prd: 1180
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When a settled decision names its approver with a dotted name, which no GitHub account can have, should that settle wait for the name to be fixed, or be closed on no one?

## The decision, in plain words

It waits: the settle is not counted until someone corrects the name, and then the right person gets the credit, while that decision still counts as open on the board.

## The intro, for fun

A name with a dot walks into the ledger, and the ledger asks for some ID.

## The punchline, for fun

It can wait in the lobby until the name is spelt right, or leave with nobody's credit.

## The options, in plain words

A. A. The settle waits, skipped with a warning, until its approver's name is fixed; the decision stays open on the board meanwhile.
B. B. The reader drops a dotted approver, so the settle closes at once on no one and that credit is lost for good.

## What I had to decide

Keep the settle waiting until the name is fixed, or close it on no one at once.

## What I did meanwhile

A dotted approver's settle is skipped with a warning each poll; the decision stays open on the board, and is credited to the right login on the first poll after the line is corrected.

## What it costs to change later

Switching to B is one line in the settled-ledger reader and one test, no migration: nothing was written in the meantime.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's done-when for s3 says the approver yields no dotted name, while the spec's user story says the event waits until the name is fixed; I followed the user story, because closing on no one is permanent in the ledger. (author)

```

<!-- /omni-outbox-settled: s3-02-dotted-approver-waits -->

<!-- omni-outbox-settled: s3-03-harvest-follows-login -->

## s3-03-harvest-follows-login — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-07
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-07
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-harvest-follows-login
prd: 1180
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Writing the approver's name without the @ sign also changes what two other parts of the product expect, which this slice was not given. Should the slice update them, or leave the change to a later piece of work?

## The decision, in plain words

The slice updated them: two tests now expect the name without the @ sign, and the app's built copy was rebuilt so it matches the code.

## The intro, for fun

One little @ sign left the room, and two tests noticed it had gone.

## The punchline, for fun

They were told politely, and they agreed to stop looking for it.

## The options, in plain words

A. A. Update the two harvest tests and rebuild the app bundle in this slice, so the preflight is green.
B. B. Leave them out of this slice, with a red preflight, for a follow-up slice to fix.

## What I had to decide

Keep the two test updates and the rebuilt app copy in this slice, or move them out to a follow-up.

## What I did meanwhile

Two tests outside the slice's ground expect the approver without @, and the app's committed bundle is rebuilt from the changed kit code; nothing else moved.

## What it costs to change later

Reverting is three files: two one-line test expectations and a rebuild of the app bundle.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s3 names neither the harvest tests nor the app bundle; without them the preflight is red, so leaving them out was not a working option. (author)

```

<!-- /omni-outbox-settled: s3-03-harvest-follows-login -->
