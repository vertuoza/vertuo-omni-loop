---
id: s5-01-shared-ground-is-computed
prd: 72
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a slice changes a file outside the ground it declared, the retro leaves the change unflagged if that ground is shared. Should shared ground be what two slices both declare in the plan's table, or whatever the plan's note about sharing mentions?

## The decision, in plain words

Shared ground is worked out from what the slices declare: ground that two slices both claim. A path the plan's note only mentions in passing does not count.

## The intro, for fun

Two neighbours sharing a garden path is fine, as long as the map agrees on where the path is.

## The punchline, for fun

So the retro reads the fences the slices drew, not the chatter over them.

## The options, in plain words

A. Shared ground is what two slices both declare, worked out from the plan's table, the option built.
B. Shared ground is every path the plan's note about sharing mentions, as written.
C. Both: what two slices declare, plus what the note mentions.

## What I had to decide

What `territoryFacts` treats as the plan's shared ground when it grades a breach. The spec says a finding is "any breach the plan does not list as shared ground"; the plan skill says the shared-ground note lists "each prefix more than one slice declares", in prose. PRD 72's note names `apps/omni-app/src/retro/` and `apps/omni-app/test/fixtures/` in one paragraph, the second precisely to say it is not shared; PRD 50's note names `kit/lib/outbox/` to say s1 stays clear of it. Read as a list, either note would unflag ground it meant to fence off.

## What I did meanwhile

Shared ground is every prefix the kit's `collisions(parsePlanSlices(plan))` finds between two slices' territories (through `sharedGround`). A path outside its slice's territory but under shared ground is counted in the facts (`territory.counts.shared`, and per sub-PR) and never becomes a finding. The PRD's own outbox folder is every slice's ground, since `/omni:do-work` allows item and account files there. PRD 50 gives `kit/dist/omni.mjs` as its shared ground and no breach.

## What it costs to change later

One function, `territoryFacts` in `apps/omni-app/src/retro/kinds/delivery.facts.mjs`, and its tests; retros already merged keep the counts they were made with.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a plan's note is meant to declare ground its table does not, for a file no slice lists in its territory.
- (author) Whether ground that one slice's territory wholly contains (PRD 72's `apps/omni-app/src/retro/`, around the wave-3 prefixes) should count as shared, since the kit's `sharedGround` names the wider prefix.
