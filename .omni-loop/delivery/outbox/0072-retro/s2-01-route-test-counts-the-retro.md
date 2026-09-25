---
id: s2-01-route-test-counts-the-retro
prd: 72
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The plan says the tests of the existing pull request check must pass unchanged, yet one of them says the app serves that check and nothing else. Should that test change now that the app serves the retro too?

## The decision, in plain words

That one test now says the app serves the check and the retro, each with its own failure handler. Every other test of the existing check is untouched and passes as before.

## The intro, for fun

Two jobs now share one front door, and the doorbell test still expects a single guest.

## The punchline, for fun

The test learned to count to two, and the check itself never noticed the new neighbour.

## The options, in plain words

A. Change that one test to count the retro beside the check, the option built.
B. Serve the retro from a second endpoint of its own, so the test stays as it was, at the price of a second setup step.
C. Move that test beside the endpoint it describes, in the retro's ground, and leave the check's folder with only the check's own tests.

## What I had to decide

Whether to edit `src/outbox-check/inngest-route.test.mjs`, outside this slice's territory. The spec puts the retro function's registration in `api/inngest.mjs` (Scope, In), and that test asserts `functions` equals `[outboxCheck]` and that Inngest describes 2 functions. The plan's done-when for s2 says "The `outbox-check` tests pass unchanged", and the spec's test seams say "`outbox-check` — its existing tests pass unchanged". Both cannot hold for this one test.

## What I did meanwhile

The test now asserts `functions` equals `[outboxCheck, retro]`, names `RETRO_FUNCTION_ID`, and expects 4 functions (each function and its failure handler). `outbox-check.test.mjs` and `end-to-end.test.mjs` are untouched and pass.

## What it costs to change later

A constant: the test's two expectations. Serving the retro from a second endpoint instead would keep the test unchanged but need a second Inngest app and a second sync, a human step the spec does not list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec's "existing tests pass unchanged" meant the outbox check's behaviour, which is unchanged, or every test file under its folder.
