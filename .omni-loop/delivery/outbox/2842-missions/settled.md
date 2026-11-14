# Settled outbox items — PRD 2842

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-arcade-leaves-out-virtual-fleets -->

## s1-01-arcade-leaves-out-virtual-fleets — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-arcade-leaves-out-virtual-fleets
prd: 2842
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

How does the arcade stop offering a virtual fleet to players, when the code that lists the arcade's fleets sits outside what this slice may change?

## The decision, in plain words

I changed the two lines that read the arcade's fleets so they leave virtual fleets out, and the database also refuses a player who tries to join one. Settings and the Fleet section still list them.

## The intro, for fun

A fleet of agents walked into the arcade and asked for a joystick.

## The punchline, for fun

The arcade checked its list, and the agents were not on it.

## The options, in plain words

A. A. The arcade's read leaves virtual fleets out, and the database refuses a player in one (built).
B. B. A database view of the players' fleets that every arcade read uses instead.
C. C. Only the database refusal: the select screen may still show a virtual fleet, and joining it fails.

## What I had to decide

Keep the arcade's read filtered (A), or move the filter into the database so no app code has to remember it (B).

## What I did meanwhile

The arcade's select screen lists only players' fleets; the database refuses a player in a virtual fleet whatever the screen shows.

## What it costs to change later

Small either way: B is one database view and a change of the arcade's read to it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The change is outside the slice's territory: apps/galaxy/src/data/load-galaxy.ts (loadFleets takes `players`) and apps/galaxy/src/data/arcade.ts (passes it). No other slice of the plan touches either file. (author)
- The season's fleet ranking and the galaxy view still read every fleet, so a virtual fleet shows there with no points; nothing in the spec says whether it should. (author)

```

<!-- /omni-outbox-settled: s1-01-arcade-leaves-out-virtual-fleets -->

<!-- omni-outbox-settled: s1-02-hero-defaults -->

## s1-02-hero-defaults — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-hero-defaults
prd: 2842
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

What does each new hero start with: which preferred model, which limits, and which one line says whether it works alone?

## The decision, in plain words

Every hero prefers Claude, Sonnet for the Engineer and the QA and Opus for the others, and never merges or answers for a person, plus one limit of its own role. The drawer says what the Engineer and the QA do alone, and that a person does the others' work today.

## The intro, for fun

Five heroes signed up, and someone had to write their job descriptions.

## The punchline, for fun

Nobody asked for a raise: the agent and model are only written down.

## The options, in plain words

A. A. Claude for all; Sonnet for the Engineer and the QA, Opus for the others; the shared and per-role limits as built.
B. B. Other models or limits per role, named by a person.
C. C. No model recorded until routing by model exists.

## What I had to decide

Keep these defaults (A), or name other models and limits per role (B).

## What I did meanwhile

The defaults are recorded on each hero and change nothing yet: the runner's accounts still decide the model, as the spec says.

## What it costs to change later

A constant: two lists kept equal by a test, kit/lib/virtual-fleet/roles.ts and virtual_hero_roles() in the migration; heroes already made keep what they were given.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names each role's skills but no model, no limit sentence and no wording for the drawer's lines; the mockup's Reviewer line `A person, until its skill` was replaced by `A person does this today`, as the spec words it. (author)
- The why line for a role that does not work alone (s6's Heroes tab) is written too: `Its review skill is not built yet.`, `Its brainstorm and roadmap need a person.`, `Its plan needs a person.` (author)

```

<!-- /omni-outbox-settled: s1-02-hero-defaults -->

<!-- omni-outbox-settled: s1-03-virtual-fleet-name-and-cap -->

## s1-03-virtual-fleet-name-and-cap — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-03-virtual-fleet-name-and-cap -->
