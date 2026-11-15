---
id: s1-02-excuses-flag-tests-own-file
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
excuses: [kit/bin/item-excuses.test.ts]
---

## The question, in plain words

The tests of the new way to name the exact files a question excuses needed a home. The existing test file of that command proves a locked rule, so may they live in a new file beside it?

## The decision, in plain words

Yes. They sit in a new test file of their own next to the command's tests, and the file that proves the locked rule is left exactly as it was.

## The intro, for fun

Two roommates, one sacred shelf.

## The punchline, for fun

The new tests got their own shelf.

## The options, in plain words

A. Keep the new tests in a file of their own beside the command's tests: what was built.
B. Fold them into the file that proves the locked rule, with its owner's yes.

## What I had to decide

`omni item new --excuses <path>` is tested through `main()`, as every command is. `kit/bin/item.test.ts` is in s1's territory, but it proves N-PRODUCT-3, and the testing form keeps a law's proof file its owner's: tests of other behaviour go in a file of their own. The plan names no other test file for the command.

## What I did meanwhile

Wrote `kit/bin/item-excuses.test.ts` beside it, outside s1's territory; this item names it in its excuses field. `kit/bin/item.test.ts` is untouched.

## What it costs to change later

Moving the tests is a file rename, or folding them into the proof file once its owner agrees.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the owner of the locked rule would rather keep every test of the command in one file
