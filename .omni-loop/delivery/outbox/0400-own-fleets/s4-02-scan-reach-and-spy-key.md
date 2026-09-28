---
id: s4-02-scan-reach-and-spy-key
prd: 400
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Where does the check for leftover company fleets look, and what about the spy mascot, whose key is the same word as one of the company's fleets?

## The decision, in plain words

The check reads the game's code: the arcade app, the shared packages and the game engine, outside the tests. The spy's key may appear only where flavour is looked up by mascot: the picture library, the sounds and the home page's card rules.

## The intro, for fun

The spy and the fleet share a name, which is exactly what a spy would want.

## The punchline, for fun

The check lets him in, but only through three doors.

## The options, in plain words

A. Game code only, with the spy's key allowed in the three mascot tables, as built.
B. The whole repository outside records and tests, and the other app's word list cleaned too.
C. Rename the spy mascot's key so the check can refuse the word everywhere, with a database change for the fleets already using it.

## What I had to decide

The reach of the leftover check, and how it treats the spy mascot's key, which the spec did not list among the mascot keys.

## What I did meanwhile

The check skips the planning records, the design notes, the other app's list of game words and the database checks, which name the company's fleets as history or test data. It fails on the retired and pirate fleet names anywhere it reads, and on the spy's key outside the three mascot tables.

## What it costs to change later

A folder list and a file list in one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec lists beaver, octopod and picsou as mascot keys but not the spy's, which the database already accepts as one
- (author) whether the other app's list of refused game words, which names the pirate fleet, should also be cleaned
