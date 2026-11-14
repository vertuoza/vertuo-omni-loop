---
id: s1-03-virtual-fleet-name-and-cap
prd: 2842
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

When is a virtual fleet's name taken, and do virtual fleets count toward the workspace's limit of 12 active fleets?

## The decision, in plain words

A name is taken when any fleet of the workspace, retired ones included, already has the same short key, so a different spelling of Beaver is taken too. Virtual fleets count toward the limit of 12 active fleets, as players' fleets do.

## The intro, for fun

Two fleets wanted to be called Beaver, and only one dam was available.

## The punchline, for fun

The second one is asked to choose another name, politely.

## The options, in plain words

A. A. Taken when its key is used, retired fleets included; one limit of 12 for both kinds (built).
B. B. Taken only when the same name is typed, ignoring case.
C. C. Key-based, with a limit of its own for virtual fleets.

## What I had to decide

Keep the key-based check and the shared limit (A), compare only the names as typed (B), or give virtual fleets a limit of their own (C).

## What I did meanwhile

A taken name reads `Name taken: choose another` under the field; the 13th active fleet, of either kind, is refused in the drawer's foot.

## What it costs to change later

Small: one check in create_virtual_fleet(); a separate limit is one more count in the same function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the name is unique in the workspace, players' fleets included, but not whether a retired fleet or a different spelling of the same key counts; keys are never reused because the ledger names them, so this follows that. (author)
- Create fleet lands on the new fleet in the Fleet section, its board for now: the Operation room it should land on arrives with the Fleet's tabs (slice s6). (author)
- In the demo the drawer opens but makes no fleet, and says `The demo world keeps its own fleets.` (author)
