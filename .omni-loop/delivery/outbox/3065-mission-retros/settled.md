# Settled outbox items — PRD 3065

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-02-mission-retro-fixed-skill -->

## s2-02-mission-retro-fixed-skill — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-mission-retro-fixed-skill
prd: 3065
slice: s2
rank: medium
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

Should the database also list the new milestone retro skill among the loop's own skills, so that no repository can give one of its own skills the same name?

## The decision, in plain words

I left the database's list of the loop's own skills as it is. Adding the new skill there means changing tests and a list in the arcade that no slice of this plan owns, so it waits for a small follow-up.

## The intro, for fun

Two skills with the same name walk into a runner.

## The punchline, for fun

For now only one of them is allowed through the front door, and it is not ours.

## The options, in plain words

A. Leave the fixed list as it is in this PRD, and add the skill to it in a follow-up that also updates the arcade's list and its tests.
B. Widen this PRD's plan so a slice owns the arcade's runner list and its tests, and add the skill now.

## What I had to decide

The plan's s3 makes runners run /omni:mission-retro, but set_repository_runner_skill()'s fixed list, which refuses a repository's own skill named like a loop skill, was not extended: apps/galaxy/src/runners/runners.ultra-skills.migration.test.ts pins the newest definition to 20270125160000_qa_turn.sql and its list to RUNNER_SKILLS (apps/galaxy/src/runners/runners.contract.ts), and apps/galaxy/src/virtual-fleets/roles-sql.test.ts pins virtual_hero_roles() the same way. Both files sit outside every slice's territory. If s3 adds mission-retro to a hero's skills in kit/lib/virtual-fleet/roles.ts, roles-sql.test.ts fails until a migration redefines virtual_hero_roles().

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

No migration redefines set_repository_runner_skill() or virtual_hero_roles(); runner_jobs never checks a job's skill against that list, so the supervisor can still send the job.

## What it costs to change later

Low: one follow-up migration redefines the two functions, with RUNNER_SKILLS and the two pinning tests updated in the same change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s3 gives the skill to a hero role was not known when this slice was built.

```

<!-- /omni-outbox-settled: s2-02-mission-retro-fixed-skill -->

<!-- omni-outbox-settled: s4-01-stuck-line-names-short-jobs -->

## s4-01-stuck-line-names-short-jobs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-stuck-line-names-short-jobs
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

How should the supervisor name the five jobs a stuck repair reads, when a runner only takes a short line with no commas in it?

## The decision, in plain words

The supervisor names each of the five jobs by its first eight characters, separated by commas, as the PRD writes it. Five whole job names do not fit in the line a runner takes, and today's runners refuse a comma, so until the kit's line check takes one, a stuck repair is refused by the runner and spends one repair.

## The intro, for fun

Five long names walk into a line that only has room for four.

## The punchline, for fun

So each one gives its first name only, and the doorman still frowns at the commas.

## The options, in plain words

A. A. Name each job by its first 8 characters, separated by commas, and widen the runner line check to take a comma.
B. B. Name each job by its first 8 characters, separated by colons, which runners take today.
C. C. Name only the fifth job in full, and let the repair skill find the four jobs before it.

## What I had to decide

Pick how a stuck repair's line names its five jobs. A keeps the PRD's comma list and needs the kit's runner line check to take a comma (the mission-retro slice owns that check). B changes one constant in apps/omni-app/src/missions/stuck.ts so runners take the line today, and the repair skill splits on a colon. C names only the fifth job in full, and the skill reads the four before it from the mission.

## What I did meanwhile

Built A: `/omni:repair --mission <m> --stuck --jobs <j1>,<j2>,<j3>,<j4>,<j5>`, each job its first 8 characters, at most about 90 characters. The App keeps the fifth job's whole id as the repair's failed job by matching those 8 characters against the mission's jobs.

## What it costs to change later

Low: the line is one constant (stuckSkillLine in apps/omni-app/src/missions/stuck.ts) and its reader (stuckJobsOf). Changing it later changes no stored shape; stuck repairs already sent keep their line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the mission-retro slice (s3) widens the runner line check to take a comma, or parses the jobs another way, is not known here: it is built at the same time.
- (author) Whether the repair skill can read a job's log from its first 8 characters, rather than its whole id, is not known here.

```

<!-- /omni-outbox-settled: s4-01-stuck-line-names-short-jobs -->

<!-- omni-outbox-settled: s4-02-what-the-stuck-count-counts -->

## s4-02-what-the-stuck-count-counts — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-what-the-stuck-count-counts
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

Which job ends count toward a stuck mission, and what does the supervisor do when a stuck repair ends and the mission has nothing else that can move?

## The decision, in plain words

Only the jobs that build, check or review a PRD count toward being stuck, never a committee, a planner, a repair or a retro. A mission with nothing able to move still stops as it does today, and a stuck repair counts as fixed once something moves after it.

## The intro, for fun

Counting sheep is easy until someone asks which animals are sheep.

## The punchline, for fun

We count only the ones that were supposed to be building something.

## The options, in plain words

A. A. Count only a PRD's step jobs, let a mission with nothing able to move stop, and settle a stuck repair by what happens next.
B. B. Count every job the mission sent, committees and PM jobs included.
C. C. Pause by stuck even when the mission would otherwise stop, so a person always gets the stuck question.

## What I had to decide

Confirm what the stuck count counts and how a stuck repair ends, or pick another reading. Each choice is a few lines of apps/omni-app/src/missions/stuck.ts (beatsOf, settleStuck) and stuck-run.ts.

## What I did meanwhile

Built A: a job end counts when it is a PRD's step job (build, QA, a QA fix, the Reviewer, the fix after it) and its last attempt ended; a lost or limited attempt carried by its resume does not. Moving is a PRD sent to a step further than any it reached, a ready, a join or a merge; a Resume of the mission, a stuck repair sent and a pause by stuck start the count again. The stuck count acts only while the mission runs or waits: one that would stop stops. A code stuck repair settles once its fix landed; a fix that cannot land ends it not fixed; an omni-loop one files its report and the mission goes on; only person, a spent cause or the spent 9 pause.

## What it costs to change later

Low: no stored shape depends on it. The count is read again from the mission's events on every run, so a different reading applies to running missions from the next run on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names retro jobs as counting nothing but does not say whether a committee, a PM or a care job does.
- (author) The kit's repair record line has no items field, so a change to a rule that a stuck repair proposes is not read into the mission's outbox; only a milestone retro's items are.

```

<!-- /omni-outbox-settled: s4-02-what-the-stuck-count-counts -->

<!-- omni-outbox-settled: s4-03-milestone-retros-run-and-shape -->

## s4-03-milestone-retros-run-and-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-18
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-18
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-milestone-retros-run-and-shape
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

How does a delivered mission still get its retros, and how is a proposed rule change written down for the mission page to show?

## The decision, in plain words

A delivered mission keeps being checked until each retro it sent is written down, one retro at a time, and one over its token budget skips the ones it never sent. A proposed change names what it changes in plain words that start with law, rule or the form's name, so the page can tell them apart.

## The intro, for fun

The party is over, but someone still has to write the thank-you notes.

## The punchline, for fun

The supervisor stays behind with the pen, one note at a time.

## The options, in plain words

A. A. Keep watching a delivered mission until its retros are written, one milestone retro at a time, and keep a target as plain words with its kind first.
B. B. Also hold a milestone retro back while a stuck repair works, so only one retro of any kind runs per mission.
C. C. Keep an item's target as separate fields (its kind, its id, its form and section) in a follow-up migration.

## What I had to decide

Confirm how milestone retros run and how an item's target is kept, or pick another. The run is apps/omni-app/src/missions/milestone.ts and milestone-run.ts; the target words are targetWords there, which the mission page (s5) reads.

## What I did meanwhile

Built A: a delivered mission's job keeps running while a milestone retro it sent is not recorded yet, then ends; the roadmaps' retros go first and the mission's last, never two at once, while a stuck repair or a PRD's repair may run beside one. A delivered mission over a cap keeps each milestone it did not send as skipped, `budget reached`. An item's target is kept as `law <id>`, `rule <id>` or `the <form> form: <section>`; its file is kept empty, since the retro's record line names no file per item; a retro's file the database would refuse is kept empty too.

## What it costs to change later

Low: the target words are text in mission_items, read by the mission page alone; a different shape is one function and the rows written so far, which a short follow-up can rewrite before any person answers one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's 'one retro at a time per mission' could also hold a milestone retro back while a stuck repair works; this slice reads it as one milestone retro at a time.
- (author) A mission delivered before this change, whose job runs again, sends its mission retro then: nothing in the spec says to leave such missions out.

```

<!-- /omni-outbox-settled: s4-03-milestone-retros-run-and-shape -->
