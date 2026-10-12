---
id: s3-01-gh-bridge-callers
prd: 1665
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The board is now built from the Omni page, but three other commands build the same board and are moved by later slices. Until then, where should those three read the board from?

## The decision, in plain words

Those three keep reading the board the old way, through a small bridge, so they behave exactly as today, while the board command itself reads only the Omni page. The later slices switch the three over and delete the bridge.

## The intro, for fun

Three passengers still hold paper tickets on the day the train goes digital.

## The punchline, for fun

They board as before, and the next two stops swap their tickets.

## The options, in plain words

A. Keep the three on the gh bridge until s4 and s5 move them, as built.
B. Move the three to the Omni page now, rewriting their board fixtures in s4's and s5's test files.
C. Keep a second copy of the board builder that reads the old way, beside the new one.

## What I had to decide

Whether omni next, omni care and the status line's refresh, which call buildBoard and belong to s4 and s5, keep their gh reads through a transitional BoardReads adapter (kit/lib/loop-reads/gh-bridge.ts) until s4 and s5 hand them the Omni page's LoopReads. Building it meant small edits outside s3's territory: buildBoard is now async, so kit/bin/commands/next.ts (boardFacts, readFacts), kit/bin/commands/care.ts (waveClaims, runState, run) and kit/bin/commands/statusline.ts (refreshPrdBoard, which checks lockHeld before reading since refreshBoard takes a sync build) await it; GhPrListSchema and GhPrCommitsSchema moved from kit/bin/schema.ts (and their cases from kit/bin/schema.test.ts) into the bridge, the only reader left.

## What I did meanwhile

Built the bridge with the very gh calls the board ran (same args, same environment), mapping each pull request to a LoopChange; what gh throws holds that repository only. next.test.ts, care.test.ts and statusline.test.ts pass unchanged.

## What it costs to change later

s4 and s5 replace one ghBoardReads(...) call each with boardReads(omniLoopReads(...)); s6's guard test then deletes gh-bridge.ts and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The status line's refresh now reads the board before it takes its lock (it skips when the lock is held), so two refreshes that start in the same instant can both read; before, the second waited on the lock and read nothing.
- (author) Whether s4 and s5 would rather have had the callers moved straight to the Omni page here, with their tests, was not asked.
