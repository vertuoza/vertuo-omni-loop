---
id: s6-02-galaxy-contract-checks-nothing
prd: 976
slice: s6
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The check meant to keep the galaxy map's published description in step with the code behind it turns out to compare the code with itself. Should this work repair it, or leave it for a change of its own?

## The decision, in plain words

It is left as it was, and reported here. Repairing it shows the description and the code already disagree on three experience functions, which is a change of its own.

## The intro, for fun

A guard was set to watch the door, and turned to watch a mirror instead.

## The punchline, for fun

It has reported no stranger since the day it was hired.

## The options, in plain words

A. Leave the check as it is and report it; repair it in a change of its own.
B. Repair it here, and make the published description of the three experience functions match the code.
C. Drop the hand-written description and its check, and publish the code's own description instead.

## What I had to decide

Clearing the lint parse error on packages/galaxy/src/index.d.ts showed why the project service missed it: TypeScript drops a .d.ts that sits beside its .ts, and `import type * as Contract from './index.d.ts'` in contract.test.ts resolves to index.ts. A declaration changed on purpose (levelFor taking a string) still typechecks, so the contract test proves nothing. Renamed to contract.d.ts it becomes real, and `pnpm typecheck` then fails: experience, playerXp and borrowedXp are declared over LedgerEvent (type: string) while the sources take the game's GameEvent.

## What I did meanwhile

index.d.ts and contract.test.ts are unchanged. eslint.config.ts reads index.d.ts with the root tsconfig's options (allowDefaultProject), so `pnpm lint` parses it and finds nothing. The drift is not fixed: no output changes either way, but the fix touches the arcade's contract (a settled PRD 725 item) and its callers in apps/galaxy/src/data, another slice's ground.

## What it costs to change later

A constant to undo here. The repair is a small typed change: rename the declaration file, then declare the three functions over the game's event type, or have them take LedgerEvent through one marked cast as buildGalaxy does.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Settled item s24 of PRD 725 chose index.d.ts as the arcade's contract; it does not say what the three experience functions should accept.
