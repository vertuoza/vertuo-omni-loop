# Settled outbox items — PRD 2896

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-level-notes-wording -->

## s1-01-level-notes-wording — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-level-notes-wording
prd: 2896
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The drawer greys out the higher levels for a member who is not an owner, and the screen did not say what to write beside them. Is the wording right?

## The decision, in plain words

A short line under the choice says why a level is greyed out, naming the owner or the three roles it needs. Switching a needed role off while Works alone is chosen moves the choice to Own branch.

## The intro, for fun

Some doors need a key, and this one at least says whose.

## The punchline, for fun

A greyed-out choice with no reason is just a riddle.

## The options, in plain words

A. A. Keep the two lines as built.
B. B. Show no line: the disabled choice speaks for itself.

## What I had to decide

Read the two lines on the New virtual fleet drawer and keep or reword them in the fleet-new screen.

## What I did meanwhile

The lines ship as written; changing a word later is a one-line edit.

## What it costs to change later

A reword costs one constant in the drawer and one line in the screen file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The screen left the wording beside the disabled levels open (author).

```

<!-- /omni-outbox-settled: s1-01-level-notes-wording -->

<!-- omni-outbox-settled: s2-01-level-inherited-by-the-database -->

## s2-01-level-inherited-by-the-database — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-level-inherited-by-the-database
prd: 2896
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

A mission's brief may leave its level out. Who fills it in with the fleet's level: the skill that writes the brief, or the database when the brief is stored?

## The decision, in plain words

The database fills it in from the fleet when the brief names none, so a mission is never left without a level. The skill writes the level when it is told one, and otherwise the brief reads Reviews with you until the database stores it.

## The intro, for fun

A form left blank still gets a name on the door.

## The punchline, for fun

Better a default written down than a guess made later.

## The options, in plain words

A. A. The database fills the level in from the fleet (built).
B. B. The skill reads the fleet's level and writes it, with a new command and route.

## What I had to decide

Whether the skill must read the fleet's level itself, which needs a new way for the kit to read a fleet from the Omni page.

## What I did meanwhile

The database trigger takes the fleet's level when the brief has none, and the Missions tab shows the level the database stored.

## What it costs to change later

Reading the level in the skill later costs one command and one route; the trigger can stay as the fallback.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The kit has no command that reads a fleet from the Omni page, and the territory names none (author).

```

<!-- /omni-outbox-settled: s2-01-level-inherited-by-the-database -->

<!-- omni-outbox-settled: s2-02-prds-on-branch-read-from-events -->

## s2-02-prds-on-branch-read-from-events — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-prds-on-branch-read-from-events
prd: 2896
slice: s2
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

Lowering a mission to Reviews with you is refused while PRDs sit on its branch. Where does the count of those PRDs come from before the branch exists?

## The decision, in plain words

The count reads the mission's join, drop and landing events, so it is zero today and the refusal starts to apply once the next slices record those events. The branch name in the message is the mission's number and its title in words.

## The intro, for fun

A guard posted before the door is built still stands in the right place.

## The punchline, for fun

The count is zero until someone actually joins the branch.

## The options, in plain words

A. A. Count from the join, drop and landing events (built).
B. B. Count the PRDs whose pull request targets the mission branch.

## What I had to decide

Whether to count PRDs another way, such as a stored branch name, once the branch is cut.

## What I did meanwhile

The refusal is written and tested on events a test records; no real mission can trip it yet.

## What it costs to change later

Changing where the count is read costs one function in the missions repository and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The event names prd-joined, prd-dropped and landed are the spec's; the database accepts them only once the branch slices add them (author).

```

<!-- /omni-outbox-settled: s2-02-prds-on-branch-read-from-events -->

<!-- omni-outbox-settled: s3-01-app-checks-on-mission-branch-prs -->

## s3-01-app-checks-on-mission-branch-prs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-app-checks-on-mission-branch-prs
prd: 2896
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The spec says the app's own checks (outbox, budgets, business laws) run on a pull request into a mission branch as on one into main. Which slice changes the webhook that decides this?

## The decision, in plain words

Only the checks workflow runs for pull requests into a mission branch in this slice. The app's own checks still skip them, because the webhook that picks pull requests lies outside every slice's territory.

## The intro, for fun

The guard at the main gate does not yet know the side door has a number.

## The punchline, for fun

Until someone tells the webhook, the side door is checked by the workflow alone.

## The options, in plain words

A. A. Leave the webhook; a later slice adds mission branches to its filter (built).
B. B. Add the filter now, in this slice, outside its territory.

## What I had to decide

Which later slice adds the mission branches to the webhook's list of pull requests that get the app's checks.

## What I did meanwhile

The checks workflow runs on pull requests into mission branches; the webhook is left as it is.

## What it costs to change later

Changing the webhook later costs one small filter and its tests, in a slice whose territory lists the webhook.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No slice's territory names the webhook file (author).

```

<!-- /omni-outbox-settled: s3-01-app-checks-on-mission-branch-prs -->

<!-- omni-outbox-settled: s3-02-branch-cut-by-the-first-run -->

## s3-02-branch-cut-by-the-first-run — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-branch-cut-by-the-first-run
prd: 2896
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The spec says Start refuses when the repository does not allow rebase merges. Start is a page and a route outside this slice, so where is the setting checked?

## The decision, in plain words

The mission's first run after Start cuts the branch and checks the setting. With rebase merges off it cuts nothing, sends no PRD, and the mission waits naming the setting.

## The intro, for fun

A door with no lock still needs someone to check it before the party.

## The punchline, for fun

Better a polite wait than a branch nobody can land.

## The options, in plain words

A. A. The mission's first run cuts the branch and checks the setting; the mission waits naming it (built).
B. B. The Start route checks the setting and refuses at once, the run only cuts.

## What I had to decide

Whether Start itself, in the page's route, should also refuse on the setting.

## What I did meanwhile

The mission's job asks GitHub through the app, cuts the branch from the default branch once, and leaves an existing branch untouched.

## What it costs to change later

Refusing in the route as well costs one call to GitHub in the Start route and one test; the run's check can stay as the second guard.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The territory names no file of the Start route (author).

```

<!-- /omni-outbox-settled: s3-02-branch-cut-by-the-first-run -->
