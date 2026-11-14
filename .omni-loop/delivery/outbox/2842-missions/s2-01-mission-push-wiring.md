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
