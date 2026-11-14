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

<!-- omni-outbox-settled: s3-01-s3-help-guide-ground -->

## s3-01-s3-help-guide-ground — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-s3-help-guide-ground
prd: 2842
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

The mission skill needed a few edits just outside its slice's listed folders so the help list, the docs guide and their tests stay green. Is that fine?

## The decision, in plain words

I added the mission skill to the help list, gave the guide its Missions page in the sidebar order, and updated the counts in the tests that check those lists, because those tests fail otherwise.

## The intro, for fun

A new skill walked into the help list and asked for a chair.

## The punchline, for fun

The tests counted the chairs and insisted on one more.

## The options, in plain words

A. A. Keep the edits as built: the lists and tests name the new skill and page.
B. B. Move the list edits into a slice that owns the help list and the guide, and ship the skill alone.

## What I had to decide

Edited kit/lib/help/entries.ts (a mission entry in the Start group), docs/guide/meta.json, and the counts and orders in kit/lib/help/entries.test.ts, apps/galaxy/src/docs/guide.test.ts, docs.test.ts and skills.test.ts. Also chose the docs branch shape mission/<nnnn>-<slug> (no config key names one) and made the fleet's key the one question the one-line form asks, since no omni command lists a workspace's Virtual Fleets yet.

## What I did meanwhile

Nothing waits on this: the slice builds, and a different answer undoes the edits.

## What it costs to change later

A few lines of list and count edits in files outside the slice's folders.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan's help territory meant the help list (kit/lib/help/entries.ts) rather than the help skill folder (author)
- Whether a fleet-listing command should exist for the skill to read the only fleet (author)

```

<!-- /omni-outbox-settled: s3-01-s3-help-guide-ground -->

<!-- omni-outbox-settled: s4-01-start-and-wakes-refresh-the-mission -->

## s4-01-start-and-wakes-refresh-the-mission — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-start-and-wakes-refresh-the-mission
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

How does a mission that went quiet start checking again, once a person resumes it, a job of it ends or one of its PRDs moves on?

## The decision, in plain words

A mission checks every minute while it runs or waits, and goes quiet once it is delivered, stopped, or paused with nothing still running. Whatever wakes it (Start, Resume, a job's end, a stage change, an answer) puts its check back in line, rather than only bringing forward a check already waiting.

## The intro, for fun

A mission that naps needs an alarm clock that also works when it was unplugged.

## The punchline, for fun

So every alarm here also plugs it back in.

## The options, in plain words

A. Every wake refreshes the mission's job, which ends once there is nothing to watch (built).
B. The mission's job never ends: it checks every minute, delivered, stopped and paused included, and a bare wake is enough.
C. Start and Resume refresh it; the other wakes only bring a queued check forward, and a quiet mission waits for a person.

## What I had to decide

Whether every wake of a mission adds or requeues its job on the ledger (background_job_refresh, kind mission, key and lane mission:<id>, due at once), as built and as s5 must call it, or whether the mission's job should stay queued for ever so a bare background_job_wake is enough.

Decided by: Jev (hardToRevert 0.42) · agent said false

## What I did meanwhile

Built the job to end done when nothing is left to watch, and to end later a minute on while the mission runs or waits, or is paused with a job still running. Exported missionJob(id, repo) with the exact kind, key, subject, lane and payload s5 refreshes. To stay under the ledger's cap of 20 laters in a row, a run refreshes its own job every 15 laters, which resets the count at the price of one extra run reading the same state.

## What it costs to change later

A constant: if the job should never end, the handler returns later instead of done in two places, and s5 may then call background_job_wake alone. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each wake calls background_job_wake, which only brings forward a queued job; a job that ended is not queued, so a bare wake would do nothing.
- (author) Whether a paused mission should keep a check every minute to record job ends was left open: built to keep checking only while a job of it still runs.

```

<!-- /omni-outbox-settled: s4-01-start-and-wakes-refresh-the-mission -->

<!-- omni-outbox-settled: s4-02-answered-prd-carries-on-by-its-stage -->

## s4-02-answered-prd-carries-on-by-its-stage — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-answered-prd-carries-on-by-its-stage
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

When a PRD of a mission waits for a person to answer its questions, how does the mission tell it was answered and the work carried on?

## The decision, in plain words

The mission does not follow the fix the page runs once a person answers, and never sends that PRD again itself. It keeps the PRD waiting on answers until the PRD reads ready for review, then waits for its merge.

## The intro, for fun

The mission asked a question and then stared at the door.

## The punchline, for fun

It only looks up when the PRD walks in ready.

## The options, in plain words

A. The PRD carries on by its stage: ready, then merged (built).
B. The mission also follows the auto-fix jobs of the PRD, and stops the PRD, saying why, when one fails.

## What I had to decide

Whether a PRD waiting on answers is seen moving on only through its stage (ready, then merged), as built, or whether the mission should also follow the runner jobs the page's auto-fix sends for it, and react to their ends as it does to its own.

Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Built the PRD's state from its stage first: a PRD at outbox reads waiting for a merge, shipped or retro reads merged, whatever the mission's own runs said. A job of the mission that ended on answers keeps the PRD waiting on answers until then. A done job with no outcome is read as stopped mid-way, as the Runners page reads it.

## What it costs to change later

A constant and one more read: following the auto-fix jobs means reading the runner jobs of the PRD's line beside the mission's own, and mapping their ends with the same table. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) If the auto-fix stops or fails, the mission keeps reading waiting on answers, and only a person sees the fix's own end on the Runners page.

```

<!-- /omni-outbox-settled: s4-02-answered-prd-carries-on-by-its-stage -->

<!-- omni-outbox-settled: s4-03-a-stopped-prd-comes-back-by-hand -->

## s4-03-a-stopped-prd-comes-back-by-hand — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-a-stopped-prd-comes-back-by-hand
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

Once a PRD of a mission stops (it failed, was held twice, or its job was cancelled), how does it come back into the mission?

## The decision, in plain words

The mission never sends a stopped or cancelled PRD again: it comes back only when a person takes it to ready for review by hand, and the mission then waits for its merge. A mission left with nothing able to move reads stopped, and says so in those words.

## The intro, for fun

A PRD tripped twice, and the mission decided not to push it a third time.

## The punchline, for fun

A person can still carry it over the line, and the mission cheers from there.

## The options, in plain words

A. A stopped PRD comes back only by hand, through its stage (built).
B. Resume also sends each stopped PRD again, once more.

## What I had to decide

Whether a stopped PRD comes back only through its stage, as built, or whether a person's Resume of the mission should also clear the stopped PRDs so the mission sends them again, one more run each.

## What I did meanwhile

Built the stop as final for the mission's own sends, the PRD's stage winning over it. The stopped mission's waiting line names each stopped PRD with why, then 'Take it to ready by hand and the mission carries on.'

## What it costs to change later

A constant in the pure pick, plus Resume (s5) recording a resumed event the supervisor reads as a fresh start: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a stopped mission says why and how to resume, but not whether Resume retries what stopped.

```

<!-- /omni-outbox-settled: s4-03-a-stopped-prd-comes-back-by-hand -->

<!-- omni-outbox-settled: s4-04-approval-read-from-the-prd-page -->

## s4-04-approval-read-from-the-prd-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-04-approval-read-from-the-prd-page
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

Where does a mission read whether a PRD's approval still stands, before it sends it?

## The decision, in plain words

From the PRD's page on Omni only: the latest product approval there, and whether a later change voided it, which reads 'approve it again'. A PRD approved only by merging its first pull request, with no approval recorded on its page, reads 'approve it' and is not sent.

## The intro, for fun

The mission checks the stamp on the PRD before it lets it board.

## The punchline, for fun

No stamp on the page, no boarding, however nice the ticket looks.

## The options, in plain words

A. Only the approval in force on the PRD's page counts (built).
B. A merged phase-0 pull request counts too, when the page holds no approval.

## What I had to decide

Whether the approval in force on the PRD's page is the only proof a mission accepts, as built, or whether a PRD approved by merging its phase-0 pull request should count too.

## What I did meanwhile

Built the read on the approvals of the PRD's page (the product kind, latest first) and the voids a push left on it; the tech approval is not read apart, since a product approval is refused until it is given. A mission's scope is this repository's PRDs, whose phase 0 here is on the server.

## What it costs to change later

A constant and one read: counting a phase-0 merge means reading the PRD's stage past inbox as approved too. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether every repository a mission may run in records its approvals on the page was not checked: a repository whose phase 0 is a merged pull request would see its PRDs wait on approval for ever.

```

<!-- /omni-outbox-settled: s4-04-approval-read-from-the-prd-page -->

<!-- omni-outbox-settled: s5-01-stage-and-answer-wakes-need-two-call-sites -->

## s5-01-stage-and-answer-wakes-need-two-call-sites — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-stage-and-answer-wakes-need-two-call-sites
prd: 2842
slice: s5
rank: medium
bears-on: none
raised: 2026-11-14
wave: 4
---

## The question, in plain words

A mission should wake the moment one of its PRDs changes stage or gets an answer, but the code that learns of those two things sits outside what this slice may change. Who should call the wake?

## The decision, in plain words

I built the wake itself and wired the end of a mission's job, which is inside this slice. For a stage change and an answer, I left the call out: until it is added, the mission's own check a minute later catches them.

## The intro, for fun

A mission has a doorbell now, but two of its visitors still use the back window.

## The punchline, for fun

The minute's check keeps the window from staying shut.

## The options, in plain words

A. A. Only the end of a job wakes at once; a stage change and an answer wait for the minute's check (built).
B. B. Add the two calls to the wake of a repository's missions, and the wake to the public API's runners service, in a follow-up slice.
C. C. Add them now by widening this slice's territory.

## What I had to decide

Whether a later slice or a small follow-up adds one call to the service's wakeRepo(repo) (apps/galaxy/src/missions/missions.service.ts, tested) in the stage event route and in the place an answer is stored, or whether those two stay on the minute's check.

## What I did meanwhile

A running mission is woken at once by Start, Resume and the end of one of its jobs, and within a minute by a stage change or an answer. The service's wakeRepo(repo) wakes every mission of a repository and is tested, but nothing calls it yet: its live wrapper is added with its first caller.

## What it costs to change later

One line at each call site: the stage event route (apps/galaxy/src/stages/event/) and the answer's storage; a job ended by the public API's cancel is the same, as it builds its runners service without the wake.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for an immediate wake on a stage change and an answer, but the plan's territory for s5 holds neither the stage event route nor the answer code, nor the public API's service wiring.

```

<!-- /omni-outbox-settled: s5-01-stage-and-answer-wakes-need-two-call-sites -->
