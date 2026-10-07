---
id: s9-02-roadmap-phase0-proved-per-prd
prd: 1162
slice: s9
rank: medium
bears-on: none
raised: 2026-10-07
wave: 6
---

## The question, in plain words

The check that proves a review pull request holds only documents expects one project with its build plan, but a roadmap's review holds many projects and, by design, no plans yet. How does the skill prove it?

## The decision, in plain words

The skill runs that check once per project of the roadmap and accepts only one fault, the missing plan; everything else (documents only, signed, the spec and the page showing today beside after present) must hold for every project.

## The intro, for fun

The checker wanted a plan; the roadmap said plans come later.

## The punchline, for fun

So it checks everything else, one project at a time.

## The options, in plain words

A. A. Run the check once per project and allow only the missing plan (built)
B. B. Teach the check a roadmap mode that accepts every project of the roadmap without a plan
C. C. Skip that check for roadmaps and rely on the inbox check alone

## What I had to decide

Whether the skill proves the phase-0 PR by running omni phase0 per PRD and allowing only missing: plan (built), or whether omni phase0 should learn a roadmap mode first.

## What I did meanwhile

/omni:roadmap step 5 (and /omni:mega-roadmap step 5 through it) runs omni phase0 <prd> for every PRD and treats its not ok as expected only when missing: plan is its one fault; omni phase0 itself is unchanged, since kit code is outside s9's territory.

## What it costs to change later

Teaching omni phase0 a --roadmap <n> mode later is one kit change and one line in each skill's step 5.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says omni phase0 proves the roadmap's phase-0 PR, but no slice of the plan teaches it to accept PRDs without a plan.
