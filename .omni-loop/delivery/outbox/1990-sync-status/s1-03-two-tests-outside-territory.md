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
