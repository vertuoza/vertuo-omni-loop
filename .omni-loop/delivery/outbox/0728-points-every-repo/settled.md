# Settled outbox items — PRD 728

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-region-full-name -->

## s1-01-region-full-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-region-full-name
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When the game names the repository where a slice was built, should it write the owner and the name, or only the name?

## The decision, in plain words

It writes both, the owner and the name, so two repositories with the same name under different owners never mix.

## The intro, for fun

Two repositories walk into a ledger with the same first name.

## The punchline, for fun

Surnames were handed out at the door.

## The options, in plain words

A. Owner and name, the option built: never ambiguous across owners.
B. The bare name only, as before: shorter ids and labels, ambiguous if two owners hold the same repository name.

## What I had to decide

Whether a region in an event id and in the region column is owner/name or the bare name. The spec writes it as the region repo without saying which.

## What I did meanwhile

Full owner/name everywhere: ids read zone:vertuoza/vertuo-ai-domain:vertuoza/vertuo-omni-loop#12:s1:secured. Sectors still match a bare name, so the existing sector rows keep working.

## What it costs to change later

Nothing is written until the rollout's first run. After it, the ids are permanent: changing to bare names then would mean a second id per zone for the same fact, so the choice should be settled before the game is switched back on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the arcade's labels read well with the owner in front of every region name (s4 draws them)

```

<!-- /omni-outbox-settled: s1-01-region-full-name -->

<!-- omni-outbox-settled: s1-02-game-since-default -->

## s1-02-game-since-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-game-since-default
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

A workspace created after this change: when does its game start?

## The decision, in plain words

At the moment it is created. Every workspace that already exists starts at the moment the change is applied, as the spec asks.

## The intro, for fun

The starting pistol fires once for everyone already on the track.

## The punchline, for fun

Late runners get their own pistol.

## The options, in plain words

A. A new workspace starts when it is created, the option built.
B. A new workspace has no start and counts everything its repositories ever delivered.

## What I had to decide

What the new game start moment holds for a workspace made after the migration. The spec only says the migration sets it to the moment it is applied.

## What I did meanwhile

The column is required, defaulting to now: existing workspaces get the migration's moment, a new one its creation moment.

## What it costs to change later

A migration that drops the default, or makes the column optional, if a new workspace should instead replay its repositories' history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a workspace created later should count PRDs delivered before it was created

```

<!-- /omni-outbox-settled: s1-02-game-since-default -->

<!-- omni-outbox-settled: s1-03-unreadable-repository-empty -->

## s1-03-unreadable-repository-empty — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-unreadable-repository-empty
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

If the game cannot read one of the tracked repositories, should the whole scoring run stop, or skip that repository and score the others?

## The decision, in plain words

It skips that repository and scores the others. Nothing wrong gets written: the skipped repository's events are only written later, once it can be read.

## The intro, for fun

One locked door on a street of open houses.

## The punchline, for fun

The postman keeps delivering to the neighbours.

## The options, in plain words

A. Skip it and score the others, the option built.
B. Stop the whole run, so a missing access is noticed at once.

## What I had to decide

Whether a failed list of a tracked repository's PRD issues stops the poll. Before, the one plan repository was read or the poll failed.

## What I did meanwhile

A repository the game cannot read reads as empty; the other repositories still land. A missing access therefore shows as missing points, not as a failed run.

## What it costs to change later

One line: make that read hard again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner should see which repositories were skipped (the run does not log it today)

```

<!-- /omni-outbox-settled: s1-03-unreadable-repository-empty -->

<!-- omni-outbox-settled: s1-04-settled-by-who -->

## s1-04-settled-by-who — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-settled-by-who
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Who earns the points for an answered question when the record says nobody, or says a session answered on behalf of a person?

## The decision, in plain words

Nobody earns them when the record says nobody. When a session answered on behalf of a person, that person earns them.

## The intro, for fun

The answer was signed by a robot, on behalf of a human.

## The punchline, for fun

The human gets the medal; the robot gets a thank-you note.

## The options, in plain words

A. Pay the person the session answered for, the option built.
B. Pay nobody for an answer a session gave.

## What I had to decide

How the approver line of a settled question maps to the person who is paid. The spec says the approver's login is paid, and the records hold two shapes it does not cover.

## What I did meanwhile

The word nobody pays no one (those questions settle with a verdict that pays nothing anyway). A line naming a session delegated by someone pays that someone.

## What it costs to change later

One rule in the reader.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a delegated answer should pay the person, or nobody since a session gave it

```

<!-- /omni-outbox-settled: s1-04-settled-by-who -->

<!-- omni-outbox-settled: s1-05-scripts-test-outside-territory -->

## s1-05-scripts-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-scripts-test-outside-territory
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

This part changed a test file that the plan did not hand it. Is that acceptable?

## The decision, in plain words

Yes: the test runs the scoring command this part changed, so it had to learn the new reading. Only that one test's expectations moved.

## The intro, for fun

The fence said stay in the garden; the hose reached the neighbour's tulips.

## The punchline, for fun

Only the tulips that were already thirsty.

## The options, in plain words

A. Keep the change in this slice, the option built.
B. Move it to a follow-up slice, leaving the suite red in between.

## What I had to decide

Whether the end-to-end test of the game scripts may change in this slice. The plan gives this slice the project command but not its test file.

## What I did meanwhile

The test now seeds a tracked and an untracked repository, expects the tracked one to be read and the untracked one never, and expects the new row named by its home. The other six script tests are untouched.

## What it costs to change later

None: the edit is the test of code this slice owns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no later slice lists that test file, so nobody else would have updated it

```

<!-- /omni-outbox-settled: s1-05-scripts-test-outside-territory -->
