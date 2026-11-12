---
id: s3-03-ship-tests-outside-territory
prd: 2739
slice: s3
rank: high
bears-on: N-PRODUCT-12
raised: 2026-11-12
wave: 2
---

## The question, in plain words

Shipping now reads the pull request's review first, so three older tests that ship a PRD needed a stand-in for that read, one of them in a file that proves a rule: was it right to change them?

## The decision, in plain words

The three tests now hand shipping an empty stand-in, so they keep checking what they checked and never reach the network; the new tests of a later reply live in a file of their own.

## The intro, for fun

Three old tests learned that shipping now looks over its shoulder.

## The punchline, for fun

They got a stand-in, so nobody calls the outside world.

## The options, in plain words

A. Hand the three tests an empty stand-in for the read, and keep the new tests in a file of their own.
B. Move the shipping test out of the rule's proof file into the shipping tests.
C. Leave the old tests as they were, and let them fail until someone decides.

## What I had to decide

`omni ship` became a command that reads the loop (`withoutContext`, `loopReadsFor`), so `main(['ship', '42'])` with no `reads` would try the Omni page with the machine's own sign-in, and fail on CI. Outside s3's territory: `kit/bin/omni.test.ts` ("ship names each rewritten file at its new path"), one of the files that enforce N-PRODUCT-12 (omni runs, and does not refuse, where no kit is installed), and `kit/test/profiles.test.ts` (checks clean, settles, ships) now pass `reads: fakeLoopReads()`, a PRD with no pull request, which the gate reads as nothing to judge. The N-PRODUCT-12 tests themselves are unchanged, and `omni ship 9` (a PRD not in the inbox) reads nothing, so the session-record test of that file is unchanged too. The `later` tests of `omni care reply` went into a new `kit/bin/care-later.test.ts` instead of `kit/bin/care.test.ts`, which enforces BR-PRODUCT-72 and stays untouched (testing form: a law's file stays its owner's).

## What I did meanwhile

Changed the two files, one argument each plus an import, added the new test file, and ran all three suites green.

## What it costs to change later

A constant: reverting the lines restores the files, with the network risk back; the new test file can move into `kit/bin/care.test.ts` if its owner prefers.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner of N-PRODUCT-12 accepts an unrelated test of its proof file taking a stand-in argument.
