---
id: s8-01-route-test-counts-the-harvest
prd: 82
slice: s8
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

Adding the new harvest job to the app meant changing a test that belongs to the pull request check, which this piece of work was not meant to touch. Should that test change, or should the new job be served somewhere else?

## The decision, in plain words

The test changed in the smallest way: it now expects the three jobs the app serves instead of two. Nothing else in the pull request check or its tests changed.

## The intro, for fun

The guest list for the app's front door was printed before the third guest was invited.

## The punchline, for fun

So one name was added to the list, and the door stayed the same.

## The options, in plain words

A. A. Change the one test so it expects the three jobs (built).
B. B. Serve the harvest from a separate address of its own, leaving that test untouched.
C. C. Move the test into the app's shared test folder and rewrite it there.

## What I had to decide

The spec says the knowledge-harvest function is registered in api/inngest.mjs, and the plan says the outbox check's tests pass unchanged. apps/omni-app/src/outbox-check/inngest-route.test.mjs asserts that the route serves exactly [outboxCheck, retro] and reports four functions, so both cannot hold, and that file is outside s8's territory.

## What I did meanwhile

Registered knowledgeHarvest in apps/omni-app/api/inngest.mjs and edited inngest-route.test.mjs in three places: the import, the list of served functions (now outboxCheck, retro, knowledgeHarvest) with the harvest's id, and function_count from 4 to 6 (each function plus its failure handler). No other outbox-check test changed.

## What it costs to change later

Low: reverting is three lines in one test file. Serving the harvest from its own route instead would be a new file under api/ and a second Inngest sync URL.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's 'the outbox check's tests pass unchanged' may have meant the check's behaviour tests only; the spec does not say whether the route test counts.
