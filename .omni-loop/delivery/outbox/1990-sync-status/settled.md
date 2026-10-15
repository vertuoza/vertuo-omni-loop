# Settled outbox items — PRD 1990

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-behind-kit-red-before-level -->

## s1-01-behind-kit-red-before-level — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-behind-kit-red-before-level
prd: 1990
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

When this computer's Omni or its plugins are behind the latest release, should that count as red before the team's setting caps it, so a lead who asks for red gets red?

## The decision, in plain words

Being behind counts as red, and the default setting caps it to orange, so nothing changes for anyone who keeps the defaults; a lead who sets the kit check to red makes the whole team see red until they update.

## The intro, for fun

The spec said orange, and the lead's story said red.

## The punchline, for fun

So the colour now listens to the lead.

## The options, in plain words

A. Behind kit and plugins count red, capped to orange by default: the lead's red setting works.
B. Keep them orange as section 5 reads: levels.kit: red then shows orange, and the user story is dropped.
C. Also count a target repository's older kit red before the level.

## What I had to decide

Spec section 5 says a repository kit or a plugin older than the latest release is an orange finding, and section 6 says a level only ever lowers a colour. Read together, setting sync.levels.kit to red could never show red, which breaks the user story where a lead sets sync.levels.kit: red and the team sees red until they update. I made those two findings (repo kit and plugin versions) red before the level; with the default level, orange, they show orange exactly as section 5 and the acceptance criteria say. A target repository's older kit, a missing kit and a missing plugin stay orange.

## What I did meanwhile

kit/lib/sync/status.ts raises repoKitFindings and pluginFindings as red; status.test.ts proves orange under the defaults and red under levels.kit: red.

## What it costs to change later

A constant per finding: flipping them back to orange is a two-line change and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a target repository's older kit should also turn red under levels.kit: red was not asked (author).

```

<!-- /omni-outbox-settled: s1-01-behind-kit-red-before-level -->

<!-- omni-outbox-settled: s1-02-sync-record-shape -->

## s1-02-sync-record-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-sync-record-shape
prd: 1990
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

What should the saved sync result hold, so the session's start and the status line can show the same block without checking again?

## The decision, in plain words

The saved result keeps two more things than the spec lists, the newcomer's checklist and the fix line, and keeps each finding of a check on its own, so any later reader prints the same block from the saved copy alone.

## The intro, for fun

The spec listed five fields, and the block needed seven.

## The punchline, for fun

A copy that can't be printed is only half a copy.

## The options, in plain words

A. Keep the two extra fields and one entry per finding, so every reader prints from the saved copy alone.
B. Keep exactly the five fields of the spec, one entry per check, and rebuild the checklist and fix line by checking again.
C. Keep the five fields, and store the printed block as text beside them.

## What I had to decide

Spec section 4 lists checkedAt, status, headline, setupDoneAt and findings, one entry per check. Slice s5 must print the whole block from the cache, and the block also shows the newcomer's four steps and the fix line, which the five fields cannot rebuild. I added setup (the steps while blue, null otherwise) and fix (the fix line's text, null when none). A check with several findings (on another branch and with changed files) keeps one entry per finding, each with its check; a check with nothing to say keeps one green entry, and a check whose level is off keeps one entry reading off. The printed block shows a check's findings that are not green, each on its own line, else its green one. Status is stored as blue, red, orange or green, and the green check line reads in sync.

## What I did meanwhile

kit/lib/sync/schema.ts defines the record; kit/lib/sync/render.ts prints it; omni sync --json prints it as the cache holds it.

## What it costs to change later

The file lives only in the local folder no one commits, and a file of another shape reads as absent and is rewritten: changing the shape later costs one run, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Slices s5 and s6 read this shape; if a person picks another one, they follow it (author).

```

<!-- /omni-outbox-settled: s1-02-sync-record-shape -->

<!-- omni-outbox-settled: s1-03-two-tests-outside-territory -->

## s1-03-two-tests-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-two-tests-outside-territory
prd: 1990
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

This slice had to touch two existing tests outside the files it was given, and left one file outside them alone: is that the right call?

## The decision, in plain words

Two existing tests were changed by one line each so they keep proving what they proved, and the global command's list of what may run without the kit was left untouched, so in a folder without the kit the global command still refuses the new check instead of printing its one line.

## The intro, for fun

The plan drew a fence, and two tests stood just outside it.

## The punchline, for fun

One line each, and they still guard the same gate.

## The options, in plain words

A. Change the two tests by one line each, and leave the global launcher refusing omni sync outside a kitted repository.
B. Also add sync to the launcher's list, so the global command prints the not-installed line and exits 0 everywhere.
C. Write no commented sync block in the config omni init writes, so the init test stays untouched.

## What I had to decide

kit/lib/help/entries.test.ts counts the commands (58); a new command makes it 59, so that count moved, which the spec's test seams name. kit/bin/init.test.ts refused any knowledge: in the config omni init writes, to prove init writes no knowledge keys; the commented sync block holds the line '#     knowledge: orange', so the test now refuses it only on lines that are not comments. Left alone, outside the territory: kit/lib/launch/launch.ts, whose list of commands that run with no kit does not name sync, so the global omni outside a kitted repository refuses omni sync with its own line, exit 2, where spec section 1 says it prints 'sync: the loop is not installed here' and exits 0. Through the repository's own bin and through main(), it prints that line and exits 0.

## What I did meanwhile

Both test edits are one line each; omni sync prints the not-installed line and exits 0 wherever main() runs it.

## What it costs to change later

Each is a one-line change; adding sync to the launcher's list is one word in kit/lib/launch/launch.ts and one test there.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the global launcher should let omni sync run outside a kitted repository was not settled by the plan (author).

```

<!-- /omni-outbox-settled: s1-03-two-tests-outside-territory -->

<!-- omni-outbox-settled: s1-04-worktree-behind-no-fix -->

## s1-04-worktree-behind-no-fix — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-worktree-behind-no-fix
prd: 1990
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

When a working copy a skill made is a day behind, what fix should the check offer?

## The decision, in plain words

It shows red with no fix to run, because the automatic fix only ever touches the main branch of the main copy, and a skill's copy belongs to the skill that made it.

## The intro, for fun

Red with no button to press feels a little rude.

## The punchline, for fun

But pressing it would have touched someone else's work.

## The options, in plain words

A. Red with no fix in a skill's working copy.
B. Red, and offer merging the main branch in by hand as its fix.
C. Orange at most in a skill's working copy, since the skill owns it.

## What I had to decide

Spec section 5 runs only the behind rule in a linked worktree, and section 7's fixes switch and fast-forward the default branch of the main checkout only. A red behind finding in a linked worktree therefore carries no fix, and the fix line does not name it; the wording names the branch against the remote ('feat/x--s1 is 3 behind origin/main, the oldest 3 d old'). In the main checkout on another branch the same finding offers omni sync --fix, which switches first. Also decided here: omni sync --quiet does nothing while another run holds the lock beside the cache, and --background starts none then, so a session start and the status line never stack runs.

## What I did meanwhile

kit/lib/sync/status.ts gives the linked worktree's red finding no fix; kit/bin/commands/sync.ts skips a quiet run while the lock is held.

## What it costs to change later

A constant: a fix text can be added to that finding in one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a skill's worktree that is a day behind should be red at all, or only orange, was not asked (author).

```

<!-- /omni-outbox-settled: s1-04-worktree-behind-no-fix -->
