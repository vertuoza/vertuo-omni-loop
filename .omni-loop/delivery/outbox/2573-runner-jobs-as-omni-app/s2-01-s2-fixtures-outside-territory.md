---
id: s2-01-s2-fixtures-outside-territory
prd: 2573
slice: s2
rank: medium
bears-on: none
raised: 2026-11-02
wave: 2
---

## The question, in plain words

Making a runner without the App claim nothing broke a few existing tests and the demo page's runners, which sit outside this slice's folders. Should I have left them for another slice?

## The decision, in plain words

I made the smallest fixes in files outside the slice's list so the suite stays green: the demo page's runners now register the App, the old-kit tests expect no job, and one registration test registers the App.

## The intro, for fun

One rule changed, and four tests noticed.

## The punchline, for fun

A small fix beside the territory beats a red suite.

## The options, in plain words

A. A. Keep the small fixes in this sub-PR, as built.
B. B. Move them to a slice of their own, and leave the suite red until it merges.
C. C. Make the demo runners and tests register the App in the territory of wave 1's slice instead.

## What I had to decide

Edited apps/galaxy/src/runners/page/demo.ts, runners.github-app.test.ts and runners.service.test.ts (one registration gets githubApp: true); the store fake's default runner now registers the App.

## What I did meanwhile

Each edit only adapts a runner to the new rule that a runner without the App claims nothing; no assertion was weakened.

## What it costs to change later

A few lines per file, easy to move into another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the owner would rather have these fixtures in an earlier slice.
