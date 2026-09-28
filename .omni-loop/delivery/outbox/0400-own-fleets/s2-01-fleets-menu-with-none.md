---
id: s2-01-fleets-menu-with-none
prd: 400
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When a workspace has no fleets yet, should the FLEETS entry of the arcade's menu disappear, or stay and open the invitation to raise your own fleets?

## The decision, in plain words

It stays. With no fleets it opens the invitation screen, which tells the owner where to set fleets up and a member to ask the owner, instead of the empty fleets wall.

## The intro, for fun

An empty hangar can still have a sign on the door.

## The punchline, for fun

So the door stays, and the sign says: build your own ships.

## The options, in plain words

A. Keep FLEETS on the menu; with no fleets it opens the invitation screen.
B. Hide FLEETS from the menu with no fleets; the invitation shows only if the fleet step is reached some other way.
C. Hide FLEETS, and show the invitation once, right after the hero is built, for a workspace with no fleets.

## What I had to decide

The spec asks both to hide the fleets wall when there are no fleets and to show the invitation on the fleet screens. With the fleet step skipped when there are no fleets, hiding the menu entry too would leave the invitation nowhere a person could reach it.

## What I did meanwhile

The FLEETS entry stays on the menu, its hint reads that there are no fleets yet, and it opens the invitation screen in place of the wall. The fleet column in the Hall of Heroes and TOP FLEETS are hidden.

## What it costs to change later

A constant: dropping the entry when there are no fleets is one condition in the menu's list, and the invitation screen stays for the fleet step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say which screen a member of a workspace with no fleets reads the invitation on. (author)
