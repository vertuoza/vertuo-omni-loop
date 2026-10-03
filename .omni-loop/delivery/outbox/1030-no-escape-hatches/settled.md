# Settled outbox items — PRD 1030

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-schemas-verify-ci-trigger -->

## s1-01-schemas-verify-ci-trigger — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-schemas-verify-ci-trigger
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When should the database check that every stored row still matches what the code expects run on a pull request, and how much of the local database stack does it need?

## The decision, in plain words

It runs on every pull request that changes the source of the arcade or the App, not only the database folder, and the check now starts the database's web API as well as the database, because the reads go through that API exactly as they do in production.

## The intro, for fun

Every schema wants its day in front of a real database.

## The punchline, for fun

So the database check now shows up to a lot more parties.

## The options, in plain words

A. Run on every change to the arcade's and the App's source, starting the API too: the option built.
B. Run only when a boundary file, the script or the database folder changes, and ask each slice to keep its schemas in the boundary file, so the job runs less often.
C. Agree on a schema file name beside each module and trigger on that name, at the price of one more convention for the wave-2 slices.

## What I had to decide

Whether the supabase workflow's pull-request job should run on every change to the arcade's and the App's source (so a schema edited inside its module always meets the database), and start the API services rather than the database alone.

## What I did meanwhile

The trigger lists the two source folders, every boundary file and the verify script, and the job starts the database with PostgREST, Kong and Auth (all other services left out). Narrowing it later is one list in the workflow.

## What it costs to change later

A few more minutes of CI on pull requests that touch the arcade's or the App's source but no schema; the job's time limit went from 15 to 20 minutes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not yet timed on a GitHub runner: the extra images and the install were only measured on a local machine
- the plan says the trigger holds every schema file, but schemas live inside their modules, so no narrower pattern names them

```

<!-- /omni-outbox-settled: s1-01-schemas-verify-ci-trigger -->

<!-- omni-outbox-settled: s1-02-fallow-knows-boundary-files -->

## s1-02-fallow-knows-boundary-files — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-fallow-knows-boundary-files
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The dead-code audit cannot see files the database check loads by name, so it would call every one of them unused. Who teaches it about them?

## The decision, in plain words

This slice changed the audit's settings, a file outside its own list, so the audit counts every boundary file and the check's fixtures as loaded, and accepts that they all export the same name.

## The intro, for fun

The dead-code audit only believes in files someone imports.

## The punchline, for fun

The boundary files now have a signed note from the script.

## The options, in plain words

A. Change the audit's settings in this slice so every later boundary file passes: the option built.
B. Leave the settings alone and let each wave-2 slice record the audit's findings as items of its own.
C. Name every boundary file in a single registry that imports them all, which the plan set out to avoid.

## What I had to decide

Whether the first slice may change the dead-code audit's settings, which no slice of the plan lists, so the wave-2 slices can add boundary files without each failing the audit.

## What I did meanwhile

Three entries were added to the audit's settings: the verify script as an entry, every boundary file and fixture as loaded at run time, and their shared export name accepted. Removing them is three lines.

## What it costs to change later

Three lines in a shared settings file outside the slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for this slice did not list the audit's settings, though its boundary convention needs them

```

<!-- /omni-outbox-settled: s1-02-fallow-knows-boundary-files -->

<!-- omni-outbox-settled: s1-03-boundary-reads-only-by-get -->

## s1-03-boundary-reads-only-by-get — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-boundary-reads-only-by-get
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The production check must read real rows without ever changing one, even with the most powerful database key. How is that guaranteed?

## The decision, in plain words

The check's database client refuses every request that is not a plain read before it leaves, and the database runs plain reads in a read-only transaction, so a registered read that tried to write would fail instead. A read that calls a database function must ask for it as a plain read.

## The intro, for fun

Lending the master key to a script calls for a very short leash.

## The punchline, for fun

This one can look at every room and open no door.

## The options, in plain words

A. Refuse every request but a plain read in the check's client: the option built.
B. Trust each registered read to only read, and review them by eye.
C. Run the production check with a read-only database role made for it, which needs a migration this feature rules out.

## What I had to decide

How the registered reads are kept to reading against production, and what the wave-2 slices must write for it: a database function read through the check has to be called as a plain read.

## What I did meanwhile

The client sends only plain reads; anything else fails with a line naming the refused request. The shared read description lives with the arcade's parsing helper, and says whether a read answers rows or one row.

## What it costs to change later

A database function whose arguments cannot travel in a web address cannot be registered as it is called today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not yet tried against production, which runs once before the feature is marked ready
- the App's own reads would import this description from the arcade's folder, as no shared package holds it

```

<!-- /omni-outbox-settled: s1-03-boundary-reads-only-by-get -->

<!-- omni-outbox-settled: s1-04-phaser-helpers-from-the-module -->

## s1-04-phaser-helpers-from-the-module — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-phaser-helpers-from-the-module
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The game engine is only downloaded when someone opens the platform game. How can the new checks on its objects exist without making every page download it?

## The decision, in plain words

The four checks are made from the engine the game has already loaded, instead of loading the engine themselves, so pages that never open the game still never download it.

## The intro, for fun

Checking an engine's work without inviting the engine over is a delicate dance.

## The punchline, for fun

The checks borrow the engine the game already brought.

## The options, in plain words

A. Make the four checks from the engine the scene loaded: the option built.
B. Import the engine in the checks' file and move that file under the platform game's folder, where the lazy loading guard allows it.
C. Check the objects by their shape rather than their class, which needs no engine at all but trusts a shape instead of the engine's own classes.

## What I had to decide

Whether the Phaser checks are standalone functions that import the engine, or are made from the engine module the scene already holds, as the spec writes them one argument each but the lazy loading guard forbids a static import of the engine.

## What I did meanwhile

A single maker takes the engine module and hands back the four checks, each taking the one argument the spec names. The arcade game's slice calls it once where the scene is made.

## What it costs to change later

One extra line in the scene to make the checks; nothing changes for a player.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the arcade game's slice has not yet called the checks from the scene, so the maker is proven on stand-ins only

```

<!-- /omni-outbox-settled: s1-04-phaser-helpers-from-the-module -->
