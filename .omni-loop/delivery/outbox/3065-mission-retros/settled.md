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
