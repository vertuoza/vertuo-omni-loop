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

<!-- omni-outbox-settled: s2-01-signin-expired-means-unrenewable -->

## s2-01-signin-expired-means-unrenewable — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-signin-expired-means-unrenewable
prd: 1990
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When the Omni page sign-in on a computer is past its expiry date but can still be renewed automatically, should it count as signed in?

## The decision, in plain words

It counts as signed in, because the kit renews it on its next call; only a sign-in past its expiry with nothing to renew it counts as expired.

## The intro, for fun

A key past its date can still open the door, if it brings a spare.

## The punchline, for fun

Only the key with no spare gets the orange note.

## The options, in plain words

A. A. Expired only when nothing can renew it (as built)
B. B. Expired as soon as the access token's expiry has passed

## What I had to decide

Pick A to keep the renewable sign-in green, or B to flag every sign-in past its hourly expiry.

## What I did meanwhile

A sign-in with an expiry date in the past and a refresh token reads as signed in; one with no refresh token reads as not signed in.

## What it costs to change later

Switching to B is one condition in the sign-in check and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the spec's "not expired" meant the access token's own hourly expiry (author)

```

<!-- /omni-outbox-settled: s2-01-signin-expired-means-unrenewable -->

<!-- omni-outbox-settled: s3-01-knowledge-page-edges -->

## s3-01-knowledge-page-edges — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-knowledge-page-edges
prd: 1990
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Three edges of the knowledge and page checks were not settled: a plan repository whose targets come from a product page, the knowledge files changed inside a skill's own working copy, and a sign-in whose short-lived key ran out but can be renewed. What should the sync status say for each?

## The decision, in plain words

A product's target list is skipped because reading it needs the page, and knowledge changes in a skill's working copy are not counted. A sign-in that can still be renewed counts as signed in until the page itself refuses it.

## The intro, for fun

Three small corner cases walked into the sync check and each asked to be counted.

## The punchline, for fun

For now none of them nags anyone; one line of code each undoes that.

## The options, in plain words

A. A. As built: skip a product's target list, skip knowledge edits in a skill's working copy, count a renewable sign-in as signed in.
B. B. Count them: read the product's cached target list, judge skill working copies too, and call an expired key not signed in even when it can be renewed.

## What I had to decide

Confirm the three choices, or say which should count as a finding instead.

## What I did meanwhile

The checks stay quiet on these three, so a person is never nagged by a state the spec did not name.

## What it costs to change later

Each is one condition in the knowledge and page gatherers; changing one touches no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a product's targets should be read from its cached list in the knowledge check (author)
- Whether knowledge edits in a skill's working copy should count (author)

```

<!-- /omni-outbox-settled: s3-01-knowledge-page-edges -->

<!-- omni-outbox-settled: s4-01-fix-pulls-a-fresh-main-too -->

## s4-01-fix-pulls-a-fresh-main-too — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-fix-pulls-a-fresh-main-too
prd: 1990
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When a person asks the sync tool to fix their checkout and their main branch is only a few hours behind, should it pull those commits too, or leave them since the status still reads green?

## The decision, in plain words

It pulls them: whenever main is behind and the checkout is clean, the fix brings it up to date, whatever the colour. The status line only turns red after a day, but a pull asked for is never wasted.

## The intro, for fun

Main is a few commits behind, yet the light is still green.

## The punchline, for fun

Asked to tidy up, the fix picks up the crumbs as well.

## The options, in plain words

A. A. Fast-forward whenever main is behind on a clean tree, green or red.
B. B. Fast-forward only while the main check is red, as the fix line suggests.
C. C. Fast-forward whenever behind, and have the fix line name the fast-forward while green too (a change to s1's status rules).

## What I had to decide

Whether omni sync --fix fast-forwards the default branch whenever it is behind, or only when the main check is red (its oldest missing commit older than sync.mainRedAfter).

## What I did meanwhile

kit/lib/sync/fix.ts fastForwardStep runs whenever the behind count is above zero on a clean default branch with nothing of its own; spec section 1's example prints main green at 2 behind with the fix line 'fast-forwards main', which this follows. kit/lib/sync/status.ts (s1) leaves 'fast-forwards main' off the fix line while main is green, so the fix line can say less than --fix does.

## What it costs to change later

One condition in fastForwardStep: require the main check's red finding to be open, a change of one line and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Spec section 7 says each step runs when its finding is open; whether a green 'behind' finding counts as open is not settled (author).

```

<!-- /omni-outbox-settled: s4-01-fix-pulls-a-fresh-main-too -->

<!-- omni-outbox-settled: s4-02-help-sync-names-fix-later -->

## s4-02-help-sync-names-fix-later — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-help-sync-names-fix-later
prd: 1990
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

The help page of the sync tool does not mention its new fix option yet, because another part of this work owns that page right now: who adds the line?

## The decision, in plain words

This part left the help page alone and the command's own usage line names the fix option; the sentence in the help page is left for the last, wording-only part of this work, or for the wave once its parts are merged.

## The intro, for fun

A new button arrived before its label did.

## The punchline, for fun

The label maker is busy next door until the next round.

## The options, in plain words

A. A. Leave it to s7 or to the wave: one usage line and one sentence after s5 merges.
B. B. Widen this slice's territory to the sync help entry now, against s5's ownership of the file in wave 2.

## What I had to decide

Who adds --fix to omni help sync: the wording slice (s7) or the wave after merging, since kit/lib/help/entries.ts is s5's alone in wave 2 and outside s4's territory.

## What I did meanwhile

kit/bin/commands/sync.ts USAGE reads 'usage: omni sync [--json | --quiet | --background | --fix] [--strict]'; the sync entry in kit/lib/help/entries.ts still lists '[--json | --quiet | --background] [--strict]' and its detail says nothing of --fix.

## What it costs to change later

One usage line and one sentence in the sync help entry.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s7's territory should gain kit/lib/help/entries.ts for this was not planned (author).

```

<!-- /omni-outbox-settled: s4-02-help-sync-names-fix-later -->

<!-- omni-outbox-settled: s4-03-first-sync-test-line-moved -->

## s4-03-first-sync-test-line-moved — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-03-first-sync-test-line-moved
prd: 1990
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

One check written for the first part of this work said the fix option was refused as unknown; now that it exists, is it fine that this part changed that one check, outside its own files?

## The decision, in plain words

The check now asks that the fix option be refused when combined with another output option, so it still proves a wrong mix of options is refused. Nothing else in that file changed.

## The intro, for fun

A test kept insisting the new door was a wall.

## The punchline, for fun

It now checks that you cannot walk through two doors at once.

## The options, in plain words

A. A. Keep the one-line change: --fix combined with --json is the usage error now checked.
B. B. Drop the line from the first part's test, and leave that refusal to this part's own tests.

## What I had to decide

Whether s4 may change one line of kit/bin/sync.test.ts (s1's file, in no wave-2 territory): the assertion that 'omni sync --fix' exits 2 now passes '--fix --json'.

## What I did meanwhile

kit/bin/sync.test.ts 'refuses two output flags at once, and an argument' asserts sync(root, ['--fix', '--json']) exits 2; kit/bin/sync-fix.test.ts also proves --fix refused with --json and --quiet.

## What it costs to change later

One line; reverting it alone would make the test fail against --fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not list kit/bin/sync.test.ts in s4's territory although its last assertion pinned --fix as unknown (author).

```

<!-- /omni-outbox-settled: s4-03-first-sync-test-line-moved -->

<!-- omni-outbox-settled: s5-01-session-hook-second-entry -->

## s5-01-session-hook-second-entry — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-session-hook-second-entry
prd: 1990
slice: s5
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

The sync refresh needed a place in the session-start hook list, and an older test outside this slice's files pins that list to one entry. Where should the refresh go?

## The decision, in plain words

The refresh is its own second entry next to the constituents one, and the older test that pins the list now expects both. That keeps every other hook test as it was.

## The intro, for fun

Two things want to start with the session, and the door only had one hook.

## The punchline, for fun

Now each gets its own hook, and neither waits for the other.

## The options, in plain words

A. A. The refresh is its own second start-up hook, and the older hook test expects both.
B. B. The refresh joins the first start-up hook, and two older hook tests change.

## What I had to decide

Add omni sync --background as a second SessionStart entry and update kit/bin/constituents.test.ts, one file outside the slice's territory, to expect both entries.

## What I did meanwhile

Sessions start the sync refresh in the background beside the constituents; nothing blocks.

## What it costs to change later

Moving the refresh into the constituents entry later is a two-line change in hooks.json and its three tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the territory to include kit/bin/constituents.test.ts (author)

```

<!-- /omni-outbox-settled: s5-01-session-hook-second-entry -->

<!-- omni-outbox-settled: s6-01-hud-sync-row-on-nothing -->

## s6-01-hud-sync-row-on-nothing — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-hud-sync-row-on-nothing
prd: 1990
slice: s6
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When a session is on no work at all, should the HUD band still show the sync badge on a row of its own?

## The decision, in plain words

Yes: the band now shows the sync badge as its first row even with no work, so a person sees a stale checkout before they start; with no sync record the band hides as before.

## The intro, for fun

The band used to say nothing when there was nothing to say.

## The punchline, for fun

Now it says whether the room is tidy before you walk in.

## The options, in plain words

A. A. Show the badge alone for a session on nothing, as built.
B. B. Keep the band hidden on nothing, and draw the badge only above some work.
C. C. Show the badge alone, and also say there is no work.

## What I had to decide

Whether the HUD stays hidden on a session with no work, as it was, or shows the badge alone.

## What I did meanwhile

The badge shows alone on a session with no work; one condition in the band undoes it.

## What it costs to change later

One condition in the band's rows to change; no stored data and nothing outside the HUD plugin depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the band's first row draws the sync status; it does not say what a session on nothing shows (author).

```

<!-- /omni-outbox-settled: s6-01-hud-sync-row-on-nothing -->
