---
id: s1-02-arcade-page-test-follows-the-move
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The game's page tests had to follow the game to its new address, but their file sits outside the area this piece of work was given: is it fine that it was changed?

## The decision, in plain words

Yes: only the line that says which page the tests open was changed, so the same tests now check the game at its new address.

## The intro, for fun

The game packed its bags for a new address and its inspectors had to follow.

## The punchline, for fun

They only changed the address on their clipboard.

## The options, in plain words

A. Change only the line in the existing test file that names the page: what is built.
B. Move the test file beside the game's new page: the test runner never looks there, so the page would lose its tests.
C. Copy the tests next to the front page's tests: two places would describe the game's page.

## What I had to decide

Whether moving the arcade page's existing tests to the new route may touch their file, which is outside the slice's territory.

## What I did meanwhile

apps/galaxy/src/arcade/page.test.ts imports app/play/page.tsx instead of app/page.tsx (the import and its comment, nothing else); its 13 tests pass unchanged.

## What it costs to change later

None to undo: the file must point at the moved page either way, or the tests would check HOME and fail.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan asks for the tests to move with the page but did not list their file in the territory (author)
