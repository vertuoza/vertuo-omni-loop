---
id: s9-04-component-inventory
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Some small parts appear on almost every screen, like the fleet badge or the sign-in card, and when one of them changes the kit cannot say which screens are affected. Should the design memory keep a list of its parts and where they are used?

## The decision, in plain words

No list of parts was written. A past change to the fleet badge touched a hundred files and the kit could only name the screens that list those files themselves.

## The intro, for fun

The same little badge is pinned on every jacket in the building.

## The punchline, for fun

Change its colour and nobody can say which jackets to check.

## The options, in plain words

A. Keep no list of shared parts (built)
B. Add a component inventory that the touched check and the review read
C. Let each screen list the shared parts it uses

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a component inventory in the design memory (name, path, what it is for, its states, the screens that use it); omni design touched names the components a diff touches and the screens that use them, so the review screenshots those too.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's System section names the component folders by area. A replay of PRD 652 (person and fleet chips everywhere) through the kit's touched logic matched 101 paths and named only the dashboard and the PRD page. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the inventory should be read from code (exports of a folder) or hand-kept is not settled; the spec says no hand-kept index for screens
