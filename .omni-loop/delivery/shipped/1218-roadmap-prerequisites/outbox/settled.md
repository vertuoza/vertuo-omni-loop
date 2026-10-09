# Settled outbox items — PRD 1218

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-base-catalog-names-in-the-grade -->

## s1-01-base-catalog-names-in-the-grade — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-base-catalog-names-in-the-grade
prd: 1218
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The check that reads a roadmap must know which ready-made checks and fixes exist, before the code that runs them is written. Where should that list of names live?

## The decision, in plain words

The list of ready-made check and fix names lives with the roadmap check for now, and the code that runs them, built next, reads its names from there, so the two can never disagree.

## The intro, for fun

Two lists of the same names is how a checklist starts lying to you.

## The punchline, for fun

So there is one list, and everyone reads it.

## The options, in plain words

A. A. Keep the names in the grade module; the catalog imports them (built).
B. B. Move them into the catalog folder in s2 and have the grade import them from there.
C. C. Let the grade take the names as an input from its caller, so it knows nothing of the catalog.

## What I had to decide

Whether the names of the base checks and base fixes stay in the grade module, or move into the catalog folder once it exists.

## What I did meanwhile

The grade exports PREREQUISITE_BASE_CHECKS and PREREQUISITE_BASE_FIXES; slice s2 keys its catalog by them. Prerequisite ids also count against PRD row and question ids for the duplicate-id rule, so a blocks cell is never ambiguous.

## What it costs to change later

Moving the names later is a constant moved from one module to another and one import changed: no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the catalog's folder (prereqs/) but not where the grade reads the names from; s1 had to know them before that folder exists. (author)

```

<!-- /omni-outbox-settled: s1-01-base-catalog-names-in-the-grade -->

<!-- omni-outbox-settled: s2-01-install-check-and-fix-limit -->

## s2-01-install-check-and-fix-limit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-install-check-and-fix-limit
prd: 1218
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

How should the agent tell that a repository's code libraries are installed, and how long may it spend installing them itself?

## The decision, in plain words

The check only looks for the folder of installed libraries, so it is quick. When it is missing, the agent installs them from the locked list, and may spend up to ten minutes doing it, longer than the thirty seconds a check gets.

## The intro, for fun

Installing everything just to check it installs is like baking a cake to see if the oven works.

## The punchline, for fun

So we peek inside the oven, and only bake when it is empty.

## The options, in plain words

A. A. The check looks for the installed folder; the fix installs within 10 minutes (built).
B. B. The check runs a full frozen install every time, with a longer limit of its own.
C. C. The check looks for the folder and also compares the lockfile with what was installed.

## What I had to decide

Whether the install check runs a full install from the lockfile (slow, but proves a private package is reachable) or only looks for the installed dependencies folder; and what time limit the install fix gets.

## What I did meanwhile

The base install check is ok when there is no package.json or when node_modules exists; its fix runs the package manager's frozen install (pnpm or yarn install --frozen-lockfile, npm ci) with a 10-minute limit (FIX_LIMIT_MS), while checks keep the 30-second limit. Reaching a private registry is the registry check's job (npm ping on every registry .npmrc names).

## What it costs to change later

A constant and one check function in kit/lib/roadmap/prereqs: no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the install check proves the dependencies install from a clean lockfile, which takes minutes, against a 30-second limit per check; it does not say how long a fix may run.

```

<!-- /omni-outbox-settled: s2-01-install-check-and-fix-limit -->

<!-- omni-outbox-settled: s2-02-tick-from-any-commenter -->

## s2-02-tick-from-any-commenter — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-tick-from-any-commenter
prd: 1218
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When someone marks a hand-done prerequisite as done with a comment on the roadmap, whose comments should count?

## The decision, in plain words

Any comment carrying the done marker counts, whoever wrote it. The roadmap page only lets workspace members post it, and a tick on GitHub is visible to everyone who can see the roadmap.

## The intro, for fun

A checklist anyone can tick is either very friendly or very optimistic.

## The punchline, for fun

On a private repository, it is mostly friendly.

## The options, in plain words

A. A. Any marked comment counts (built).
B. B. Only a comment by someone with write access to the repository counts.
C. C. Only a comment posted through the Omni page or the tick command counts.

## What I had to decide

Whether a tick comment on the roadmap issue counts whatever its author, or only when its author can write to the repository.

## What I did meanwhile

readTicks reads every comment of the roadmap issue whose first line is the fixed marker <!-- omni-roadmap-tick: <id> -->, without looking at its author; the runner reads ticks for person rows only, so a tick never frees a row a check verifies.

## What it costs to change later

Filtering by author later is one more field read from the comment and a permission lookup in the command: no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the page's tick is for a signed-in member, but says nothing of who may post the same comment on GitHub directly.

```

<!-- /omni-outbox-settled: s2-02-tick-from-any-commenter -->

<!-- omni-outbox-settled: s3-01-prerequisites-in-the-roadmap-push -->

## s3-01-prerequisites-in-the-roadmap-push — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-prerequisites-in-the-roadmap-push
prd: 1218
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When the computer sends a roadmap to its page, how should the checklist of prerequisites and the latest check of them travel with it?

## The decision, in plain words

The checklist and the latest check on this computer ride along only when the roadmap has a checklist, so an older roadmap is sent exactly as before. A plain send carries this computer's latest check, or none when it never checked.

## The intro, for fun

A checklist nobody can see is just a diary.

## The punchline, for fun

So it travels with the roadmap, but only when there is one.

## The options, in plain words

A. Two optional fields, only with a Prerequisites table; a plain push sends this machine's last result or null (built).
B. Always send both fields, empty for a roadmap without a table.
C. Send the prerequisites result through its own call, apart from the roadmap push.

## What I had to decide

The shape of the prerequisites in the body omni roadmap push sends to the app, which the next slice's API validation and storage read.

## What I did meanwhile

roadmapPushBody adds two fields only when the roadmap has a Prerequisites table: prerequisites (each row as parsed, blocks 'all' or row ids, repos [] outside a plan repository, its card or null) and prerequisiteResult ({ machine, checkedAt, rows: [{ id, state, detail }] }, or null). omni roadmap prereqs sends the run it just made; omni roadmap push alone sends this machine's last kept result, null when this machine has none, so the app should keep a stored result when it receives null.

## What it costs to change later

A field renamed or reshaped in one kit module and the API's schema of the next slice, before either ships: no stored shape exists yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the push carries every row, its state, the machine and the time, but not the field names or whether a push without a fresh result should clear the stored one.

```

<!-- /omni-outbox-settled: s3-01-prerequisites-in-the-roadmap-push -->

<!-- omni-outbox-settled: s3-02-ticks-unread-when-github-is-down -->

## s3-02-ticks-unread-when-github-is-down — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-ticks-unread-when-github-is-down
prd: 1218
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When the check of a roadmap's prerequisites cannot reach GitHub to see which items a person marked as done, what should it do?

## The decision, in plain words

It carries on and treats every item a person must mark as not done yet, saying so in one line, so the loop never moves on something it could not confirm.

## The intro, for fun

If you cannot read the sign-off sheet, nobody signed it.

## The punchline, for fun

Better a short wait than a false all-clear.

## The options, in plain words

A. Carry on with no tick, one line on stderr (built).
B. Stop with one line and exit 1, checking nothing.
C. Reuse the ticks of this machine's last result.

## What I had to decide

How omni roadmap prereqs behaves when the roadmap issue's comments, where the ticks live, cannot be read.

## What I did meanwhile

The command prints one line on stderr (the ticks could not be read, every person row waits) and runs the rest; every person row waits, so the exit is 1 while one exists. It does not stop with an error, so the checks of the machine still run and are kept.

## What it costs to change later

One branch of the command: stop with exit 1 instead, or keep the last result's ticks. No stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a check that cannot run is not ok, but says nothing of the ticks when GitHub cannot be read.

```

<!-- /omni-outbox-settled: s3-02-ticks-unread-when-github-is-down -->

<!-- omni-outbox-settled: s4-01-hold-links-the-roadmap-issue -->

## s4-01-hold-links-the-roadmap-issue — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-hold-links-the-roadmap-issue
prd: 1218
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When the loop pauses a piece of work because a setup step is missing, where should the link next to that pause take you?

## The decision, in plain words

It takes you to the roadmap's discussion on GitHub for now, because the loop cannot know the web address of the roadmap's page without asking the app on every round.

## The intro, for fun

Every pause deserves a signpost, even if it points down the old road.

## The punchline, for fun

The shiny new tab will have to wait until its address is known.

## The options, in plain words

A. A. Link the roadmap issue until the page's address is known here (built).
B. B. Have the roadmap push keep the page's address locally, and link its Prerequisites tab.
C. C. Let the app open a roadmap page by repository and roadmap number, and link that with the tab.

## What I had to decide

The spec asks the hold line to carry the Prerequisites tab's link. The roadmap page is addressed by the app's own id, which `omni next` never sees (only `omni roadmap push` gets it back). The gate takes a `prerequisitesLink` and falls back to the roadmap issue's link; the command passes null today.

## What I did meanwhile

Each prerequisite hold links the roadmap issue on GitHub, where `omni roadmap tick` posts and the answers live. The gate already accepts the tab's link, so filling it is one line in the command.

## What it costs to change later

A constant: once the page link is known locally (kept by `omni roadmap push` beside the last result, or the page addressed by repository and roadmap number), the command passes `<page>?tab=prerequisites` instead of null.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3's push keeps the page's id anywhere this machine can read (author)
- Whether the app will open a roadmap page by repository and number (author)

```

<!-- /omni-outbox-settled: s4-01-hold-links-the-roadmap-issue -->

<!-- omni-outbox-settled: s4-02-unchecked-prerequisite-holds -->

## s4-02-unchecked-prerequisite-holds — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-unchecked-prerequisite-holds
prd: 1218
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

If this computer has never checked the setup list yet, should the loop wait before building the work that depends on it?

## The decision, in plain words

Yes: anything blocked by a setup step this computer has not checked waits, and the pause says which command checks it.

## The intro, for fun

Nobody has looked under the hood yet, so nobody drives off.

## The punchline, for fun

One quick check and the engine is free to roar.

## The options, in plain words

A. A. A row never checked on this machine holds what it blocks, and says how to check it (built).
B. B. A row never checked lets the work run, as if the roadmap had no prerequisites.

## What I had to decide

The spec says a row that is not ok, fixed or ticked holds the PRDs it blocks, and that a check that did not run is not ok. It does not say what `omni next` does when this machine has no last result at all, or a row is missing from it (added after the last run).

## What I did meanwhile

Such a row holds what it blocks, with `waits on prerequisite <id> (<category>): <need> — not checked on this machine yet: omni roadmap prereqs <n> --fix`. A person row ticked on the issue frees its PRDs even without a result. The drive runs `prereqs --fix` on its first tick, so this only shows when that was skipped.

## What it costs to change later

A constant: one branch of the gate decides whether a missing result holds or frees.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the author prefers a fresh roadmap to start building before its first prerequisites check (author)

```

<!-- /omni-outbox-settled: s4-02-unchecked-prerequisite-holds -->

<!-- omni-outbox-settled: s5-02-database-types-by-hand -->

## s5-02-database-types-by-hand — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-database-types-by-hand
prd: 1218
slice: s5
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

The app's list of database tables had to learn the new prerequisites table, but that file was not in this step's planned area. Was it right to update it here?

## The decision, in plain words

The list was updated here, by hand, in the exact form the generator writes, so the app builds. The database check in the pipeline compares it with what the migrations generate and fails if it differs.

## The intro, for fun

The new room was built, so the floor plan by the door needed a new box too.

## The punchline, for fun

The inspector compares the drawing with the walls on the next visit anyway.

## The options, in plain words

A. Keep the hand-written entry, checked by the pipeline's database job (built).
B. Regenerate the file with the database tool before the feature merges.

## What I had to decide

Whether the hand-written entry stays, or is regenerated with the database tool before the feature merges.

## What I did meanwhile

The app type-checks with the new table; the pipeline's database job proves the entry matches the migrations.

## What it costs to change later

Regenerating it is one command against a local database, then one commit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No local database with the latest migrations was free on this machine, so the entry was written by hand, not generated. (author)

```

<!-- /omni-outbox-settled: s5-02-database-types-by-hand -->

<!-- omni-outbox-settled: s8-01-skill-tests-outside-territory -->

## s8-01-skill-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-skill-tests-outside-territory
prd: 1218
slice: s8
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

The new steps in the roadmap and drive instructions, and the new guide section, needed tests, but the files that test them were not on this slice's list of files it may change. Should the tests go there anyway?

## The decision, in plain words

The tests were added to the two existing test files that already check these instructions and the guide, next to the earlier roadmap tests, so a later change cannot quietly drop the new steps.

## The intro, for fun

A rule with no test is a wish written in nice words.

## The punchline, for fun

So the wish got a test, two files over.

## The options, in plain words

A. A. Add the tests to the existing plugin and guide test files (built).
B. B. Leave the new steps untested and rely on review.
C. C. Move the tests into a new file inside the slice's own folders.

## What I had to decide

Whether a slice that only changes instructions and the guide may add its tests to the shared test files that already check them.

## What I did meanwhile

The new tests run with every other test; nothing else in those files changed.

## What it costs to change later

Undoing it is deleting two blocks of tests; nothing depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- none known (author)

```

<!-- /omni-outbox-settled: s8-01-skill-tests-outside-territory -->

<!-- omni-outbox-settled: s8-02-plan-repository-prereqs-run-here-only -->

## s8-02-plan-repository-prereqs-run-here-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s8
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-02-plan-repository-prereqs-run-here-only
prd: 1218
slice: s8
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

In a setup where one planning repository drives several code repositories, the spec says a prerequisite may concern another repository and be checked in a read-only copy of it, where nothing may run. Where should those checks run?

## The decision, in plain words

The check always runs from the planning repository. A row about another repository names it, and its check must only ask something (a package registry, GitHub), never install, build or run that repository's code.

## The intro, for fun

Read only means read only, even when a checklist asks nicely.

## The punchline, for fun

So the checklist asks from the outside.

## The options, in plain words

A. A. Check every row from the planning repository; rows about another repository only read (built).
B. B. Run read-only checks inside a fresh copy of the other repository.

## What I had to decide

Whether a prerequisite about another repository may ever run inside that repository's copy, or only ask from the planning repository.

## What I did meanwhile

Rows about another repository are checked from the planning repository with a read-only command; the install check never targets another repository.

## What it costs to change later

Running checks in the copy later is a change to two instructions, not to stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- none known (author)

```

<!-- /omni-outbox-settled: s8-02-plan-repository-prereqs-run-here-only -->

<!-- omni-outbox-settled: s6-01-unchecked-prerequisites -->

## s6-01-unchecked-prerequisites — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s6
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-unchecked-prerequisites
prd: 1218
slice: s6
rank: medium
bears-on: none
raised: 2026-10-08
wave: 5
---

## The question, in plain words

When a prerequisite has never been checked yet, how should the roadmap's Prerequisites tab show it?

## The decision, in plain words

It shows as not checked yet, counted on its own in the count line, sorted right after the ones waiting on you, with its card open so a person can act on it.

## The intro, for fun

Some items on the checklist have never been looked at, not even once.

## The punchline, for fun

Schrödinger's prerequisite: neither done nor missing until somebody runs the check.

## The options, in plain words

A. A. Show it as not checked yet, apart, its card open (built).
B. B. Count it as waiting on you, with the same look.
C. C. Hide its state and show only its need until it is checked.

## What I had to decide

Whether a prerequisite nobody has checked yet should count as waiting on you, or stay apart as not checked yet.

## What I did meanwhile

The tab shows it as not checked yet, after the rows waiting on you, with its card open.

## What it costs to change later

A label, a sort rank and one part of the count line on the page; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists four states (ok, fixed, waits on you, ticked) and says nothing of a row the last check did not report.

```

<!-- /omni-outbox-settled: s6-01-unchecked-prerequisites -->

<!-- omni-outbox-settled: s7-02-ticked-shows-until-next-check -->

## s7-02-ticked-shows-until-next-check — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s7
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-02-ticked-shows-until-next-check
prd: 1218
slice: s7
rank: medium
bears-on: none
raised: 2026-10-08
wave: 6
---

## The question, in plain words

Right after a member marks a prerequisite as done, what should the tab show for it before the agent checks again?

## The decision, in plain words

The tab shows the row as ticked by you, with a note that the next check records it. Nothing extra is saved in the app: the tick lives as a comment on the roadmap's issue, and the next check picks it up and saves it for everyone.

## The intro, for fun

You ticked the box, and the box believes you.

## The punchline, for fun

The rest of the team hears about it at the next roll call.

## The options, in plain words

A. A. Show it ticked to the member on return, and let the next check record it for everyone (built).
B. B. Also save the tick on the prerequisite's row, so every viewer sees it at once.
C. C. Read the ticks from the roadmap's issue when the tab opens.

## What I had to decide

Whether the page should save the tick itself so every viewer sees it at once, or show it only to the member who ticked it until the next check records it.

## What I did meanwhile

The member who ticked sees the row ticked on return; another viewer, or the same member after reloading the plain page, sees its last checked state until the next check runs, which reads the comment.

## What it costs to change later

Option B needs a database change to store a tick on the prerequisite row and a write from the callback; the button and the comment stay as built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the tab shows the row ticked but not for whom or for how long; this slice's territory has no database migration, so storing it was not open here.

```

<!-- /omni-outbox-settled: s7-02-ticked-shows-until-next-check -->

<!-- omni-outbox-settled: s5-01-prerequisites-saved-apart -->

## s5-01-prerequisites-saved-apart — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-08T11:53:35Z
- Channel: feature pull request #1223
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1223#issuecomment-6059274379
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-08
- Slice: s5
- Wave: 4
- Stays here: how one roadmap push saves its prerequisites is an implementation detail of this PRD; the spec and the store code already say it.

### The answer, as it was given

```text
A. Save the prerequisites in a second step after the roadmap; a push without them keeps the saved ones (built).
```

### The item, as it was raised

```text
---
id: s5-01-prerequisites-saved-apart
prd: 1218
slice: s5
rank: high
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

When a roadmap is sent to the app, should its prerequisites be saved in a separate step, and should a roadmap sent without any prerequisites keep the ones saved before?

## The decision, in plain words

Prerequisites are saved in their own step right after the roadmap. A roadmap sent without prerequisites keeps the ones saved before, so a roadmap whose prerequisites section is deleted still shows the old list until a later send carries an empty one.

## The intro, for fun

Two pieces of news arrive by the same post, but in two envelopes.

## The punchline, for fun

The second envelope only gets opened when it is actually in the box.

## The options, in plain words

A. Save the prerequisites in a second step after the roadmap; a push without them keeps the saved ones (built).
B. Same second step, but a push without prerequisites clears the saved ones.
C. Fold the prerequisites into the roadmap's own save function, redefined on top of the human-work change already on main.

## What I had to decide

Whether a roadmap sent without prerequisites should keep or clear the prerequisites saved before.

## What I did meanwhile

Roadmaps sent by an older kit, or without the section, store exactly as they did; a removed section leaves its old rows on the page.

## What it costs to change later

Option B is a one-line change in the app's save step; option C rewrites the roadmap's save function in a new migration on top of the human-work change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The kit (s3) leaves the prerequisites out of a push when the roadmap has no section, so the app cannot tell a deleted section from an older kit. (author)
- The two save steps are not one transaction: if the second fails the roadmap is saved and the push answers an error; the next push repairs it. (author)

```

<!-- /omni-outbox-settled: s5-01-prerequisites-saved-apart -->

<!-- omni-outbox-settled: s7-01-tick-shares-the-send-callback -->

## s7-01-tick-shares-the-send-callback — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-08T11:53:35Z
- Channel: feature pull request #1223
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1223#issuecomment-6059274379
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: ADR-0052
- Raised: 2026-10-08
- Slice: s7
- Wave: 6
- Stays here: reusing the outbox send's GitHub callback is local to the tick and the send; ADR-0052 already holds the rule that GitHub returns only to a listed address.

### The answer, as it was given

```text
A. A. Reuse the outbox send's callback, which tells a tick from an answer by its state (built).
```

### The item, as it was raised

```text
---
id: s7-01-tick-shares-the-send-callback
prd: 1218
slice: s7
rank: high
bears-on: ADR-0052
raised: 2026-10-08
wave: 6
---

## The question, in plain words

When a member marks a prerequisite as done, GitHub must send them back to the app after they agree. Should it come back to the address the outbox answers already use, or to a new address of its own?

## The decision, in plain words

It comes back to the address the outbox answers already use, which GitHub already knows. That address now tells a tick from an answer and handles each, so nobody has to change the GitHub App's settings before the button works.

## The intro, for fun

Two parcels, one letterbox, and a postman who already knows the way.

## The punchline, for fun

The label on each parcel says which room it goes to.

## The options, in plain words

A. A. Reuse the outbox send's callback, which tells a tick from an answer by its state (built).
B. B. Give the tick its own callback address, and have a person add it to the GitHub App's settings.
C. C. Move both onto one shared callback module that dispatches by kind, owned by neither feature.

## What I had to decide

Whether Mark as done should reuse the outbox send's GitHub callback, or have its own one that a person must add to the GitHub App's callback addresses.

## What I did meanwhile

The tick works wherever the outbox send already works; the shared callback reads the authorisation's state, posts a tick for a tick's state and an outbox answer for any other, exactly as before.

## What it costs to change later

Option B is a new route of a few lines plus one callback address added in the GitHub App's settings; the tick's own code does not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice does not include the outbox send's callback route, so this touches one file outside it (the callback route), and the roadmap page's route file to pass the two new query values.
- (author) ADR-0052 says GitHub brings a person back only to a listed address; whether a second address is wanted is the team's call.

```

<!-- /omni-outbox-settled: s7-01-tick-shares-the-send-callback -->
