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
