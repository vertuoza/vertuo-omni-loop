---
id: s23-01-galaxy-contract-kept-beside-typed-sources
prd: 725
slice: s23
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

Should the arcade keep reading the galaxy package through its hand-written description, or read the typed code itself now that the code carries its own types?

## The decision, in plain words

The hand-written description stays as what the arcade reads, but its shapes now live in one shared place the code also uses, and a check fails the build when the code and the description drift apart.

## The intro, for fun

Two maps of the same galaxy, and somebody has to decide which one the pilots fly by.

## The punchline, for fun

For now the old map stays on the wall, stapled to the new one so they cannot disagree.

## The options, in plain words

A. Keep the hand-written description as what the arcade reads, its shapes shared with the code and a check that fails when they drift (built).
B. Let the arcade read the typed code directly and drop the description, as the design package already does; the arcade then checks the game's code too.
C. Keep the description but have it copy every signature from the code automatically, dropping the drift check.

## What I had to decide

Whether packages/galaxy keeps index.d.ts as the arcade's contract (types re-exported from types.ts, held to the sources by contract.test.ts), or points its package types at index.ts as packages/design does, which pulls the game's typed sources into the arcade's type check.

## What I did meanwhile

index.d.ts re-exports every shape from the new types.ts and declares the functions; contract.test.ts makes tsc check each source export against its declaration. LedgerEvent keeps type: string for the arcade, so buildGalaxy hands its rows to the game's score() through one marked cast.

## What it costs to change later

A constant: change the package.json types entry to ./src/index.ts and delete index.d.ts and contract.test.ts; no data or behaviour moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not tried: whether the arcade's tsc stays green when it compiles game/ under its own looser config; option B needs that run.
- (author) The declared XP functions take LedgerEvent while the game's take GameEvent; the contract check accepts them because declared functions compare bivariantly, so that one seam is not held strictly.
