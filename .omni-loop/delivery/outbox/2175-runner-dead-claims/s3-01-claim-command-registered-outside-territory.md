---
id: s3-01-claim-command-registered-outside-territory
prd: 2175
slice: s3
rank: medium
bears-on: none
raised: 2026-10-19
wave: 2
---

## The question, in plain words

The new command that decides whether a stale claim is reused could only be switched on by adding one line to the kit's list of commands, a file the plan did not give this slice. Was that line allowed?

## The decision, in plain words

I added the one line to the list of commands, so the command runs and the checks that every command a skill names exists stay green; nothing else in that file changed.

## The intro, for fun

The new command was built, tested and ready, but its name was missing from the guest list at the door.

## The punchline, for fun

So it wrote its own name on the list, in one line, and left a note saying so.

## The options, in plain words

A. A. Keep the one line in the list of commands, outside the planned ground, as built.
B. B. Treat the planned ground as wrong and add the list of commands to it in the plan, with the same code.

## What I had to decide

Keep the one-line registration of `claim` in `kit/bin/commands/index.ts` (A), or treat the plan's territory as wrong and widen it to that file (B).

## What I did meanwhile

`kit/bin/commands/index.ts` imports `claim` from `./claim.ts` and lists it in `COMMAND_TABLE`, beside `check`. `kit/bin/omni.ts` (in the territory) names its PRD by position, and `kit/lib/help/entries.ts` has its entry. Without the line, `kit/test/plugin.test.ts`'s unknown-command guard fails on the wave skill's `omni claim check`, and that law-proof file stays unchanged.

## What it costs to change later

A constant: one import and one key in `kit/bin/commands/index.ts`. Widening the territory is a plan edit and nothing in the code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the command is registered in `kit/bin/omni.ts`, but the command table lives in `kit/bin/commands/index.ts`; whether the planner meant that file is not written down.
