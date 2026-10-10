---
id: s5-01-wiring-and-env-list-outside-territory
prd: 1342
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

To switch the new law check on in the GitHub App, this part had to touch two files its plan did not give it: the place that starts the App's jobs, and the setup list of secrets in the App's guide. Is that acceptable?

## The decision, in plain words

Yes: the App now asks the Omni page whether each untested rule is worth a law, and the guide's list of secrets names the new one. Without these two small edits the feature would be built but never run, and the guide's own check would fail.

## The intro, for fun

The plan gave this part a room, and the light switch was in the hallway.

## The punchline, for fun

So it reached out, flipped it, and left a note on the door.

## The options, in plain words

A. A. Keep both edits in this slice, as built.
B. B. Move the README bullet to s9 and leave the docs check red until s9 lands.
C. C. Leave the App unwired until a later slice, so the law judge is never asked in production.

## What I had to decide

The slice's territory names apps/omni-app/src/knowledge-harvest/, apps/omni-app/src/env and apps/omni-app/.env.example (which does not exist). Wiring the judge into the served function needs one change in apps/omni-app/src/functions.ts, and the docs check (src/env-docs.test.ts) requires apps/omni-app/README.md's variable list to name LAW_JUDGE_SECRET, a file s9 owns. The spec asks that the judge secret be a documented variable checked by the app's env tests.

## What I did meanwhile

Added the knowledge harvest's lawJudge argument in src/functions.ts (built only when LAW_JUDGE_SECRET is set) and one bullet for LAW_JUDGE_SECRET in the README's env-variables list. No .env.example was created, since the app has none.

## What it costs to change later

Reverting is two small hunks; s9 may reword the README bullet freely.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s9 expected to write that README bullet itself is not settled by the plan.
