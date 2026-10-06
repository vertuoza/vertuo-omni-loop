# Settled outbox items — PRD 728

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-region-full-name -->

## s1-01-region-full-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-region-full-name
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When the game names the repository where a slice was built, should it write the owner and the name, or only the name?

## The decision, in plain words

It writes both, the owner and the name, so two repositories with the same name under different owners never mix.

## The intro, for fun

Two repositories walk into a ledger with the same first name.

## The punchline, for fun

Surnames were handed out at the door.

## The options, in plain words

A. Owner and name, the option built: never ambiguous across owners.
B. The bare name only, as before: shorter ids and labels, ambiguous if two owners hold the same repository name.

## What I had to decide

Whether a region in an event id and in the region column is owner/name or the bare name. The spec writes it as the region repo without saying which.

## What I did meanwhile

Full owner/name everywhere: ids read zone:vertuoza/vertuo-ai-domain:vertuoza/vertuo-omni-loop#12:s1:secured. Sectors still match a bare name, so the existing sector rows keep working.

## What it costs to change later

Nothing is written until the rollout's first run. After it, the ids are permanent: changing to bare names then would mean a second id per zone for the same fact, so the choice should be settled before the game is switched back on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the arcade's labels read well with the owner in front of every region name (s4 draws them)

```

<!-- /omni-outbox-settled: s1-01-region-full-name -->

<!-- omni-outbox-settled: s1-02-game-since-default -->

## s1-02-game-since-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-game-since-default
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

A workspace created after this change: when does its game start?

## The decision, in plain words

At the moment it is created. Every workspace that already exists starts at the moment the change is applied, as the spec asks.

## The intro, for fun

The starting pistol fires once for everyone already on the track.

## The punchline, for fun

Late runners get their own pistol.

## The options, in plain words

A. A new workspace starts when it is created, the option built.
B. A new workspace has no start and counts everything its repositories ever delivered.

## What I had to decide

What the new game start moment holds for a workspace made after the migration. The spec only says the migration sets it to the moment it is applied.

## What I did meanwhile

The column is required, defaulting to now: existing workspaces get the migration's moment, a new one its creation moment.

## What it costs to change later

A migration that drops the default, or makes the column optional, if a new workspace should instead replay its repositories' history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a workspace created later should count PRDs delivered before it was created

```

<!-- /omni-outbox-settled: s1-02-game-since-default -->

<!-- omni-outbox-settled: s1-03-unreadable-repository-empty -->

## s1-03-unreadable-repository-empty — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-unreadable-repository-empty
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

If the game cannot read one of the tracked repositories, should the whole scoring run stop, or skip that repository and score the others?

## The decision, in plain words

It skips that repository and scores the others. Nothing wrong gets written: the skipped repository's events are only written later, once it can be read.

## The intro, for fun

One locked door on a street of open houses.

## The punchline, for fun

The postman keeps delivering to the neighbours.

## The options, in plain words

A. Skip it and score the others, the option built.
B. Stop the whole run, so a missing access is noticed at once.

## What I had to decide

Whether a failed list of a tracked repository's PRD issues stops the poll. Before, the one plan repository was read or the poll failed.

## What I did meanwhile

A repository the game cannot read reads as empty; the other repositories still land. A missing access therefore shows as missing points, not as a failed run.

## What it costs to change later

One line: make that read hard again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner should see which repositories were skipped (the run does not log it today)

```

<!-- /omni-outbox-settled: s1-03-unreadable-repository-empty -->

<!-- omni-outbox-settled: s1-04-settled-by-who -->

## s1-04-settled-by-who — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-settled-by-who
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Who earns the points for an answered question when the record says nobody, or says a session answered on behalf of a person?

## The decision, in plain words

Nobody earns them when the record says nobody. When a session answered on behalf of a person, that person earns them.

## The intro, for fun

The answer was signed by a robot, on behalf of a human.

## The punchline, for fun

The human gets the medal; the robot gets a thank-you note.

## The options, in plain words

A. Pay the person the session answered for, the option built.
B. Pay nobody for an answer a session gave.

## What I had to decide

How the approver line of a settled question maps to the person who is paid. The spec says the approver's login is paid, and the records hold two shapes it does not cover.

## What I did meanwhile

The word nobody pays no one (those questions settle with a verdict that pays nothing anyway). A line naming a session delegated by someone pays that someone.

## What it costs to change later

One rule in the reader.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a delegated answer should pay the person, or nobody since a session gave it

```

<!-- /omni-outbox-settled: s1-04-settled-by-who -->

<!-- omni-outbox-settled: s1-05-scripts-test-outside-territory -->

## s1-05-scripts-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-scripts-test-outside-territory
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

This part changed a test file that the plan did not hand it. Is that acceptable?

## The decision, in plain words

Yes: the test runs the scoring command this part changed, so it had to learn the new reading. Only that one test's expectations moved.

## The intro, for fun

The fence said stay in the garden; the hose reached the neighbour's tulips.

## The punchline, for fun

Only the tulips that were already thirsty.

## The options, in plain words

A. Keep the change in this slice, the option built.
B. Move it to a follow-up slice, leaving the suite red in between.

## What I had to decide

Whether the end-to-end test of the game scripts may change in this slice. The plan gives this slice the project command but not its test file.

## What I did meanwhile

The test now seeds a tracked and an untracked repository, expects the tracked one to be read and the untracked one never, and expects the new row named by its home. The other six script tests are untouched.

## What it costs to change later

None: the edit is the test of code this slice owns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no later slice lists that test file, so nobody else would have updated it

```

<!-- /omni-outbox-settled: s1-05-scripts-test-outside-territory -->

<!-- omni-outbox-settled: s2-01-game-since-at-append -->

## s2-01-game-since-at-append — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-game-since-at-append
prd: 728
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Where should the game drop the events that happened before its fresh start: when it works them out, or when it writes them down?

## The decision, in plain words

It drops them when it writes them down. The step that writes reads the workspace's start moment each time and keeps nothing older, whoever worked the events out.

## The intro, for fun

The ledger got a bouncer who checks every event's birth date at the door.

## The punchline, for fun

No date, no entry, and fake moustaches are not accepted.

## The options, in plain words

A. A. At the write, in the ledger's append, the option built: every caller is covered, one read per poll.
B. B. In the projector, with the start moment passed by the command: pure and visible, but the command must remember to pass it.
C. C. Both: the projector filters and the write refuses anything older as a last guard.

## What I had to decide

The plan puts the fresh start in the projector, but the command that runs the projector (game/cli/project.mjs) is outside this slice's territory, so the projector cannot be handed game_since without leaving the territory.

## What I did meanwhile

supabaseLedger.append (game/sources/supabase.mjs) reads workspaces.game_since at every append and drops every event whose moment is before it; an unknown workspace or a failed read appends nothing. projectEvents is unchanged.

## What it costs to change later

A constant's worth: moving the filter into projectEvents is a new option plus one line in game/cli/project.mjs. Nothing stored changes either way. The append costs one extra read of one row per poll.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person prefers the filter visible in the projector too, for the demo seed and other callers of projectEvents that never append to Supabase.

```

<!-- /omni-outbox-settled: s2-01-game-since-at-append -->

<!-- omni-outbox-settled: s4-01-old-rows-still-shown -->

## s4-01-old-rows-still-shown — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-old-rows-still-shown
prd: 728
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Should the game's pages in the app hide the points and planets recorded before the fresh start, or only the scorer on the command line?

## The decision, in plain words

Option B, taken at the wave 2 check: the app's loader reads only rows with a home, so rows from before the fresh start show no planet and add nothing to the Points column, as the spec's acceptance criteria and the fresh-start decision require. The slice had built option A; the wave check added the filter and gave the app's test fixtures a home.

## The intro, for fun

The old ledger rows were told they no longer count, but nobody told the app.

## The punchline, for fun

They are still waving from the back of the room.

## The options, in plain words

A. A. Read every row, as built: old planets and their points stay visible in the app until a filter lands.
B. B. Drop home-less rows in the loader: the app matches the scorer, the map starts empty until the first run.
C. C. Keep old planets on the map but score only rows with a home, in the economy.

## What I had to decide

Whether the app's galaxy (map, planet scenes, the dashboard's Points column) drops ledger rows that carry no home, as the spec asks of every season, fleet and XP. The loader is in this slice; the scorer and XP are s2's.

## What I did meanwhile

load-galaxy reads the home column and passes it on; a row without one keeps its planet keyed by number alone and still counts in the current month's season. No filter was added, because every data and dashboard test fixture outside this slice's territory holds home-less rows and would need a home.

## What it costs to change later

One filter in the loader (home is not null) plus a home on the fixtures of the season-cache, arcade and dashboard tests. Nothing stored changes. If the rollout lands in a new month, old rows fall outside the season anyway and only the map still shows old planets.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the fresh start should also empty the map of old planets, or only zero their points

```

<!-- /omni-outbox-settled: s4-01-old-rows-still-shown -->

<!-- omni-outbox-settled: s4-02-dossiers-by-number -->

## s4-02-dossiers-by-number — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-dossiers-by-number
prd: 728
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

A planet's dossier is still looked up by its number in the main planning repository only. What should a planet from another repository show?

## The decision, in plain words

The arcade looks a dossier up by repository and number first, and by number alone only when no other planet shares that number, so a twin never shows the wrong dossier. Other repositories' planets show no dossier until the reading side names the repository too.

## The intro, for fun

Two planets numbered 88 each reached for the same folder.

## The punchline, for fun

The arcade now checks the name on the tab before handing it over.

## The options, in plain words

A. A. Key first, number only when unambiguous, as built: twins show none, other repositories show none.
B. B. Always fall back to the number: every planet shows a dossier, twins may show the wrong one.
C. C. Widen this slice to the reading side and the stored dossier list, so every repository's planets show their own dossier now.

## What I had to decide

How the planet's DOSSIER tab and START find a dossier when data/dossiers.ts (outside this slice) still reads only the plan repository's dossiers, keyed by PRD number. The same number-only match lives in dossier_list's regions and its test fake (apps/galaxy/src/dossier/store.fake.ts), which also prefix the org onto region names that now already carry it.

## What I did meanwhile

dossierOf and dossierLink take the planet: key <home>#<n> first, the number only when no other planet in the galaxy holds it. DossiersRead accepts either key, so readDossiers keeps working unchanged.

## What it costs to change later

readDossiers keying its map by <home>#<n> and reading every tracked repository's dossiers; dossier_list's regions matching the home column and no longer prefixing the org. Neither touches stored rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a follow-up slice or a bug fix should carry the readDossiers and dossier_list change

```

<!-- /omni-outbox-settled: s4-02-dossiers-by-number -->

<!-- omni-outbox-settled: s3-01-plan-repo-is-a-region -->

## s3-01-plan-repo-is-a-region — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-plan-repo-is-a-region
prd: 728
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a feature is built across several repositories, should the planning repository, which holds only documents, count as one of the planet's regions?

## The decision, in plain words

It counts, as the spec reads: the planet is one region larger, its planning pull request must also merge before the planet is terraformed, and a planning repository that belongs to no sector makes every such feature count as crossing sectors.

## The intro, for fun

A planet with a region made only of paperwork.

## The punchline, for fun

The filing cabinet gets a flag on the map too.

## The options, in plain words

A. The planning repository is a region (what was built): one more region, its feature PR waited for, and its own sector when no sector names it.
B. Only the target repositories are regions: the home still gives the spec, plan and outbox, but adds no region, no class and no sector; the terraform waits for the targets only.
C. A region, but in no sector: keep the region and the terraform wait, but leave it out of the cross-sector count.

## What I had to decide

Whether the planning repository is a region of a multi-repository planet (size, cross-sector bonus, terraform wait), or only the place its plan and answers are read from.

## What I did meanwhile

The planning repository is the planet's first region; each target repository with a Part of feature PR is one more.

## What it costs to change later

Reversing it is a filter in game/sources/github.mjs (drop the home region when every slice names another repository, and carry its blockers to the targets). Events already written keep the extra region's surveyed event and the planet's class and cross-sector flag at terraform.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a planning repository should be put in a sector so the cross-sector bonus is not always paid (author)

```

<!-- /omni-outbox-settled: s3-01-plan-repo-is-a-region -->
