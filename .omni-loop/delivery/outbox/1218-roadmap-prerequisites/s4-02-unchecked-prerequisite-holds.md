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
