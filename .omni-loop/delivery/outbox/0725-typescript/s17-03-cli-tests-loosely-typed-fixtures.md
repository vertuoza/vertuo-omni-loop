---
id: s17-03-cli-tests-loosely-typed-fixtures
prd: 725
slice: s17
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The command line's tests are now type-checked, but some test helpers still say 'anything goes' for a fixture value. Is that fine in tests, while the real code may not?

## The decision, in plain words

Tests keep a few 'anything goes' types for fixture values, as the plan lets tests cast fixtures freely. The real code never does without a marked reason.

## The intro, for fun

The test kitchen got a health inspector, but the tasting spoons are still allowed.

## The punchline, for fun

The menu is strict; the scraps bowl is not.

## The options, in plain words

A. A: tests may use any and as on fixtures; the guard checks source files only
B. B: tests follow the source rule too, every any and as marked with ts-allow
C. C: tests may cast with as but not annotate with any

## What I had to decide

How strictly the CLI's tests are typed: about forty test lines annotate a fixture parameter or a recorded call list as any, cast a fixture with as, or assert a value with !, with no ts-allow comment, while kit/test's helper files mark theirs.

## What I did meanwhile

Test files type their fakes through shared helpers in kit/test/fixture.ts (FakeExec, realExec, FetchInit, Repo, Files, Io) and kit/test/fake-ask-server.ts (FakeAskServer, Json); what inference could not settle in a test stays any or is cast. The helper files outside *.test.ts (fixture.ts, flat-layout.ts, fake-ask-server.ts) mark every any and as with ts-allow.

## What it costs to change later

If the ratchet's guard holds tests to the source rule, about forty test lines need a real type or a ts-allow comment.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says tests may cast fixtures freely but does not say whether the ratchet's guard exempts test files from the any rule
