---
id: s3-01-decide-route-home
prd: 812
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

Where should the code that answers a terminal's Jev question live, and may this slice touch a few files the plan did not list for it?

## The decision, in plain words

We put the answering code beside the decisions it serves, so its tests run with everything else, and we touched four files outside the plan's list: the terminal's connection to the page, a count of commands in the help, and two page tests that expected this decision to be still coming.

## The intro, for fun

Some rooms were not on the floor plan, but the pipes had to run through them.

## The punchline, for fun

Nothing moved in those rooms except the pipes.

## The options, in plain words

A. Keep it as built: the answering code beside the decisions, and the four small outside edits.
B. Move the answering code to its own folder next to the decisions, and widen the plan's list to cover it.
C. Teach the test runner to look under the app's routes folder too, and move the test there as the plan wrote.

## What I had to decide

The plan names app/api/decide/[decision]/route.test.ts, but vitest.config.mjs only includes apps/*/src/**, so a test there never runs. The route's logic (decideRoute) and its live deps sit in apps/galaxy/src/jev/decisions/decide-route.ts and decide-live.ts, the only src path in this slice's territory; app/api/decide/[decision]/route.ts stays one line. Outside the territory: kit/lib/ask/client.mjs gains a decide() call (the client's call and token refresh are private, and a hand-rolled fetch would lose the refresh); kit/lib/help/entries.test.mjs counts 38 commands; apps/galaxy/src/jev/settings/decision.test.ts and render.test.ts use bug-risk as the coming decision now that outbox-risk is registered.

## What I did meanwhile

Built it that way; all tests green, and the Next route is a one-line wrapper like every other API route.

## What it costs to change later

A file move and an import path each: no stored shape, no contract change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant these paths to be read this loosely (author)
