---
id: s2-01-tier-tests-beside-the-commands
prd: 1934
slice: s2
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The spec asked for the new tier tests in two test files that also prove existing rules. Should they live there, or beside the commands people run?

## The decision, in plain words

I put the tests beside the plan check and board commands instead, so the files that prove existing rules stay untouched and no rule review is triggered.

## The intro, for fun

Two test files guard old rules like museum pieces, so the new tests found another room.

## The punchline, for fun

Same checks, different shelf, and no alarm went off.

## The options, in plain words

A. A. Keep the tier tests in the command and parser test files, as built.
B. B. Move them into the lib test files the spec named, with a high item accounting for the law-proof change.

## What I had to decide

Where the slice's tests for the tier column live: in the two rule-proving test files the spec named, or in the command tests and the parser tests.

## What I did meanwhile

The tier column is proven by kit/lib/inbox/territory.test.ts (parsing, unknownTiers), kit/bin/plan.test.ts (plan check passes deep, build, light, blank and em dash, refuses fast by slice and value) and kit/bin/board.test.ts (board --json gives each slice its tier or null). kit/lib/inbox/plan-grade.test.ts and kit/lib/board.test.ts are unchanged: omni check coverage reads any edit to them as a change to a law's proof, which only a high item can account for.

## What it costs to change later

A constant: moving the tests into the lib test files later is a copy and an account, no code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the coverage check should treat an added test in a rule-proving file as a law change at all is a question for the check, not this slice (author).
