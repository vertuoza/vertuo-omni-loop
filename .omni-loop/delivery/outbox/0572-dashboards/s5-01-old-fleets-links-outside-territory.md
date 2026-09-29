---
id: s5-01-old-fleets-links-outside-territory
prd: 572
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

When the fleets page moved under Settings, should the old links to it that live outside this piece of work be changed too, or left to the redirect?

## The decision, in plain words

I changed them: the arcade's owner hint now points straight at the new Settings page, and two shared page checks now expect the new menu. The old address still redirects, so nothing breaks either way.

## The intro, for fun

The fleets packed up and moved to Settings, but a few old signposts still pointed at the empty house.

## The punchline, for fun

We repainted the signposts and left a forwarding note on the old door, just in case.

## The options, in plain words

A. Change the old links and shared checks outside the territory to the new path (what I built).
B. Leave the arcade's link on the old path and rely on the permanent redirect; change only the shared checks, which fail otherwise.
C. Move the arcade's link into a shared constant owned by the fleets folder, so the next move is one edit.

## What I had to decide

Whether the arcade's link and the shared page checks outside this slice's territory should follow the move to the new fleets path, as the plan's done-when asks for every link in the app's source.

## What I did meanwhile

The arcade's owner hint (src/arcade/scenes/raise.tsx and its three scene tests, plus a comment in src/data/arcade.ts and src/arcade/ArcadeApp.tsx) now names /app/settings/fleets; src/switch/switch.test.ts and src/switch/headers.test.ts now expect the Dashboard, Work and Settings groups and the new paths. /app/fleets still answers with a permanent redirect.

## What it costs to change later

One constant and a handful of test expectations; the redirect keeps any old link working, so reverting is a one-line change with no data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice did not list src/arcade, src/data or src/switch, while its done-when asks that every link to the old path in the app's source move; I read the done-when as the intent.
