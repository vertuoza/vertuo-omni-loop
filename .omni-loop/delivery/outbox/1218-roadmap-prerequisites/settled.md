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
