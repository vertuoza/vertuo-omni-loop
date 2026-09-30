# Settled outbox items — PRD 757

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-help-entry-outside-territory -->

## s1-01-help-entry-outside-territory — adopted

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
id: s1-01-help-entry-outside-territory
prd: 757
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The list of commands the help screen shows lives in a file the plan did not give to this slice. Should the new command still get its line there now?

## The decision, in plain words

Yes: the new command got its line in the help list, and the check that counts the commands now expects one more, since the plan asks for help to list it and the check refuses a command without a line.

## The intro, for fun

The plan said to list it in help, then fenced off the help list itself.

## The punchline, for fun

So the new command came in through the side door and signed the guest book.

## The options, in plain words

A. Add the help line and the new count now, outside the part of the code the plan gave this slice (what was built).
B. Leave help alone and let a later slice add the entry; the command table check fails until it does.

## What I had to decide

Whether a help line for a new command belongs to the slice that adds the command, even when the plan's territory leaves the help list out.

## What I did meanwhile

The help screen names the heartbeat under the commands the skills run, with two sentences on what it does.

## What it costs to change later

Undoing it is deleting one entry and setting a count back: minutes, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory named kit/bin/commands/help.mjs, which prints help but holds no entry; the entries live in kit/lib/help/entries.mjs. (author)

```

<!-- /omni-outbox-settled: s1-01-help-entry-outside-territory -->

<!-- omni-outbox-settled: s2-01-heartbeat-access-check-in-ci -->

## s2-01-heartbeat-access-check-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-heartbeat-access-check-in-ci
prd: 757
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The plan asked for a test that proves who may see and change the new working records, but the place where such database tests live was not in this piece of work's area.

## The decision, in plain words

I added the database test beside the others and one line to the pull request checks that runs it, so every pull request proves the access rules for real.

## The intro, for fun

A lock nobody has tried is only a nice-looking door.

## The punchline, for fun

So we added one more key to the ring that gets tested on every pull request.

## The options, in plain words

A. Keep the database check and its workflow step, outside the slice's area, as built.
B. Drop the database check and keep only the text and fake-database tests inside the slice's area.
C. Move the check into a follow-up change that owns the tests folder and the workflow.

## What I had to decide

The slice's done-when asks for a persistence test with realistic rows (the owner upserts their row, another user cannot write it, a member reads it, a non-member reads nothing). The repository runs such tests as SQL files under supabase/checks/, one step each in .github/workflows/supabase.yml. Neither path is in s2's territory, which names only the migration, the route folder and src/working/.

## What I did meanwhile

Added supabase/checks/working_pings.sql, written like supabase/checks/dossiers.sql, and one step in .github/workflows/supabase.yml that runs it on every pull request touching supabase/. Inside the territory, src/working/migration.test.ts pins the migration's rules as text and src/working/api.test.ts proves the route against an in-memory fake of working_ping().

## What it costs to change later

Low. Removing the check is deleting one file and one workflow step; nothing reads either at runtime.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The SQL check was not run locally: no Supabase CLI or psql on this machine, so the sub-PR's supabase workflow is its first real run (author).

```

<!-- /omni-outbox-settled: s2-01-heartbeat-access-check-in-ci -->

<!-- omni-outbox-settled: s2-02-session-end-keeps-its-work -->

## s2-02-session-end-keeps-its-work — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-session-end-keeps-its-work
prd: 757
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When a terminal says it has finished, it sends no work with that last message. Should its record forget what it was working on, or keep it?

## The decision, in plain words

The last message only marks the session as finished and keeps what it was working on, so the page can still tell that this work's session ended rather than vanished.

## The intro, for fun

Leaving the room and forgetting which room you were in are two different things.

## The punchline, for fun

We chose to leave the room and remember it.

## The options, in plain words

A. The end marks the session finished and keeps its work and dossier, as built.
B. The end marks the session finished and clears its work and dossier, as the call's body reads literally.

## What I had to decide

The spec's SessionEnd call is {claudeSessionId, repo, work: null, ended: true}. Taken literally, the upsert would clear the row's work and dossier on the end. The spec does not say whether the end keeps or drops the work.

## What I did meanwhile

working_ping() with p_ended stamps ended_at and seen_at and keeps work_kind, work_number and dossier_id as they were; a later heartbeat without ended clears ended_at and sets the work again. Either way workingState reads the row as idle, so the pages behave the same today.

## What it costs to change later

Low: one branch of working_ping() in a follow-up migration; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec settles the end's body but not what the stored row keeps; the pages that read it (s4, s5) are not built yet, so no screen yet shows the difference (author).

```

<!-- /omni-outbox-settled: s2-02-session-end-keeps-its-work -->

<!-- omni-outbox-settled: s3-01-dock-plays-silent -->

## s3-01-dock-plays-silent — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-dock-plays-silent
prd: 757
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Should the little game on a PRD's page make the arcade's sounds, or stay quiet?

## The decision, in plain words

It stays quiet. A page people read and work on is not the arcade, so the game plays with no music and no sound effects.

## The intro, for fun

A space battle on a work page raises one question: do the aliens get to go pew?

## The punchline, for fun

For now they fight in polite silence, like a library with lasers.

## The options, in plain words

A. Play silent, as built.
B. Play the arcade's sounds, with the arcade's mute key M.
C. Play silent by default, with a sound button on the device.

## What I had to decide

Whether the play dock plays the arcade's march and sound effects, or plays silent.

## What I did meanwhile

Silent: the dock never calls the arcade's sound module. Turning sound on later is a few calls in one file, no stored data.

## What it costs to change later

A few lines in the dock's game file, and a way to mute it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether players miss the sound when they play on the page (author)

```

<!-- /omni-outbox-settled: s3-01-dock-plays-silent -->

<!-- omni-outbox-settled: s3-02-fold-ends-the-game -->

## s3-02-fold-ends-the-game — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-fold-ends-the-game
prd: 757
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When someone folds the little game away, should their game wait for them, or end?

## The decision, in plain words

Folding ends the game without saving its score, and opening it again starts a new one. Only a game played to its end sends a score, as in the arcade.

## The intro, for fun

Closing the game box mid-battle leaves a question hanging: do the aliens wait politely?

## The punchline, for fun

They do not. They pack up, and a fresh wave lines up for next time.

## The options, in plain words

A. Folding ends the game, as built.
B. Folding pauses the game, and opening it again resumes it.
C. Folding ends the game but first sends its score so far.

## What I had to decide

Whether folding the dock keeps the game where it was, or ends it.

## What I did meanwhile

Folding ends it; a new game starts on the next open. Keeping it instead means holding the game while folded, in one file, no stored data.

## What it costs to change later

One component keeps its game while folded instead of dropping it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether people fold the dock to glance at the page and expect to come back to the same game (author)

```

<!-- /omni-outbox-settled: s3-02-fold-ends-the-game -->
