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

<!-- omni-outbox-settled: s2-01-mission-push-wiring -->

## s2-01-mission-push-wiring — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-mission-push-wiring
prd: 2842
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The new command and the new kind of page need a line each in a few shared lists the slice was not given. Do I add those lines here, or leave the command unreachable?

## The decision, in plain words

I added one line in each shared list, so the command runs and the app takes a mission's page. Nothing else in those places changed.

## The intro, for fun

A new command knocked on the front door, but its name was not on the list.

## The punchline, for fun

So I wrote its name on the list, in pencil, where the owner can see it.

## The options, in plain words

A. Keep the wiring lines as built: the command and the page kind work in this slice
B. Move them to a separate slice, leaving the command unregistered until it lands
C. Widen the plan's territory for s2 to name these files, with the same lines

## What I had to decide

Keep the few wiring lines outside the territory (A), or move them to a slice of their own (B).

## What I did meanwhile

omni mission push is listed and runs; the app's dossier push takes the mission kind, its page link reads /missions/<id>, and the missions folder is one the layout names.

## What it costs to change later

Small either way: each is one line, and no other slice of the plan touches these files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The files outside the territory: kit/bin/commands/index.ts (the command table), kit/lib/help/entries.ts and its test (the help entry, the count 68 to 69), kit/lib/layout.ts (the missions folder), apps/galaxy/src/dossier/api.ts (the page route of a mission) and apps/galaxy/src/dossier/page/work.ts (a mission's path and names). The plan's territory named kit/bin/omni.ts, which holds no command list.
- (author) The fake dossier store refuses a mission through the general push, as the database does, so the fake and the database agree.
- (author) apps/galaxy/src/runners/runners.migration.test.ts pinned the runner job columns' order in the database's types; it now lets the two mission columns sit between log_tail and notify_url. That file is in s5's territory, which comes later.

```

<!-- /omni-outbox-settled: s2-01-mission-push-wiring -->

<!-- omni-outbox-settled: s2-02-brief-allows-no-measure -->

## s2-02-brief-allows-no-measure — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-brief-allows-no-measure
prd: 2842
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The plan says a brief holds one to five signs of success, yet a one-line mission holds none. Should the brief accept a mission with no sign yet?

## The decision, in plain words

The brief accepts none to five signs, so a one-line mission is a valid brief. The conversation that writes a full mission still asks for at least one.

## The intro, for fun

A mission walked in with a goal and no way to tell if it worked.

## The punchline, for fun

We let it in anyway, and handed it a notebook for later.

## The options, in plain words

A. Zero to five signs: a one-line mission has none yet (built)
B. One to five signs: the one-line mission writes a placeholder sign a person fills later
C. One to five signs, and the one-line mission asks for one: it is no longer one line

## What I had to decide

Allow zero signs in the brief (A), or demand one and have the one-line mission write a placeholder sign (B).

## What I did meanwhile

The kit's schema and the database both take 0 to 5 measures; a brief with none reads as an empty list.

## What it costs to change later

Small: one bound in the kit's schema and one in the database check, and a placeholder in the one-line skill for B.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says both: the brief holds 1 to 5 measures, and /omni:mission --prd writes no measure yet. Both cannot hold for one schema.
- (author) The other bounds are mine, as the spec names none: a title of 200 characters, a goal of 500, 50 PRDs and 10 roadmaps in a scope, and a sign, how it is read and its target of 200 characters each.
- (author) The fleet is named by its key, as the Fleet section's address names it (night-shift); the app checks it is an active Virtual Fleet of the workspace.

```

<!-- /omni-outbox-settled: s2-02-brief-allows-no-measure -->

<!-- omni-outbox-settled: s2-03-mission-page-link -->

## s2-03-mission-page-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-mission-page-link
prd: 2842
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Pushing a mission prints a link to its page, but no slice of the plan builds a page that shows one mission's brief. Where should that link lead?

## The decision, in plain words

The link reads like the other pages' links, at the missions address, and the page behind it is left for later. Until then it shows the usual page-not-found screen.

## The intro, for fun

The brief got a shiny new address before anyone built the house.

## The punchline, for fun

The mail is safe; the postman just has nowhere to knock yet.

## The options, in plain words

A. The missions address now, its page in a later slice or PRD (built)
B. The Fleet section's Missions tab, with the mission chosen in the address
C. A small page in this PRD that shows the brief and its versions, added to s7

## What I had to decide

Keep the missions address and build its page in a later slice or PRD (A), or point the link at the Fleet section's Missions tab, which shows the mission among the others (B).

## What I did meanwhile

omni mission push prints <app>/missions/<id>; the app stores every version of the brief, and the Missions tab of the Fleet section (s7) lists the mission once it is built.

## What it costs to change later

Small: the address is one entry in each of two lists, and a page reading a dossier by its id exists for every other kind.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the mission's page on the Omni app is the source of truth while it runs, and s7 says the Missions tab links its brief; neither names a page of its own, and no slice's territory holds one.

```

<!-- /omni-outbox-settled: s2-03-mission-page-link -->

<!-- omni-outbox-settled: s2-04-push-updates-running-brief -->

## s2-04-push-updates-running-brief — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-04-push-updates-running-brief
prd: 2842
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

When someone pushes a changed brief while the mission is already running, should the running mission take the new goal, scope and fleet?

## The decision, in plain words

A push updates the brief's fields at any time, and never touches whether the mission runs, who started it or when it next checks. The next check reads the new scope.

## The intro, for fun

Halfway through the trip, someone redrew the map.

## The punchline, for fun

The driver keeps driving, and simply reads the new map at the next turn.

## The options, in plain words

A. A push updates the running mission's brief; the next check follows it (built)
B. A changed brief is refused while the mission runs or waits, and taken once it is paused
C. A changed brief is stored as a new version, and applied only when a person presses Resume

## What I had to decide

Let a push change a running mission's brief (A), or keep the brief as it was at Start and refuse a changed one until the mission is paused (B).

## What I did meanwhile

mission_push() updates fleet, title, goal, measures, scope and mandate only when one changed, and leaves status, waiting_on, started_by and next_wake_at as they were; every version of the files is kept on the page.

## What it costs to change later

Small: one condition in mission_push() for B, and its check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the page is the source of truth while the mission runs, and omni mission push sends the files there, but not whether a running mission follows a new brief. A PRD a running mission already sent keeps its job either way: the supervisor (s4) only sends new ones.

```

<!-- /omni-outbox-settled: s2-04-push-updates-running-brief -->

<!-- omni-outbox-settled: s6-01-s6-hero-edit-outside-territory -->

## s6-01-s6-hero-edit-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-s6-hero-edit-outside-territory
prd: 2842
slice: s6
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Adding or removing a hero from the Heroes tab needs a small database step and a route that the plan did not list for this slice. Is it fine that this slice carries them?

## The decision, in plain words

The slice adds two database functions that let only an owner of the workspace add or remove a hero, a check of them, and one route the tab calls. Nobody could change a hero before, so the tab's Add a hero and Remove had nothing to call.

## The intro, for fun

A tab with an Add button and nothing behind it is only a very polite sign.

## The punchline, for fun

So the slice built the door, not only the sign.

## The options, in plain words

A. A. Keep the database step, its check and the route in this slice (built).
B. B. Move them to a slice of their own and ship the Heroes tab read-only until then.

## What I had to decide

Option A kept the work in this slice: migration 20270122095000_virtual_hero_edit.sql (add_virtual_hero and remove_virtual_hero, owner only, one hero per role, never the last hero), its cases appended to supabase/checks/virtual_fleets.sql, and the route apps/galaxy/app/api/virtual-fleets/heroes/route.ts, all outside the slice's territory. Option B moves them to s1's territory or a new slice. Undoing A costs a revert of those three files.

## What I did meanwhile

Nothing waits on it: the Heroes tab reads and shows heroes either way.

## What it costs to change later

small

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says an owner adds a hero; it does not say whether a plain member may remove one (author).

```

<!-- /omni-outbox-settled: s6-01-s6-hero-edit-outside-territory -->
