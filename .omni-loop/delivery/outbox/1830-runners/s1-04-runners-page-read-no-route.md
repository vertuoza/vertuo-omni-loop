---
id: s1-04-runners-page-read-no-route
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The Runners page needs the runners and jobs, but the spec lists six routes and none of them reads that list. How does the page read it?

## The decision, in plain words

I kept to the six routes. The page's read is a function the page's server code calls directly, which marks lost jobs first, as the spec asks of each page read.

## The intro, for fun

Six doors were drawn on the plan, and the page needed a window.

## The punchline, for fun

So the page reads from inside the house instead.

## The options, in plain words

A. A server-side read the page calls, no seventh route
B. Add a seventh route that lists the runners and jobs, for the page to ask every few seconds

## What I had to decide

Whether the Runners page reads through a seventh route or through a server-side read.

## What I did meanwhile

runners.service.ts has board(viewer, workspace): the workspace's runners with their state, its queued and running jobs then the last 50 ended, and the viewer's owner flag and fleet, a member only. The page's server code reaches it as runnersDeps().service, from runners.live.ts. No GET /api/runners route was added; the page's 5-second refresh re-renders the server page (s3's choice).

## What it costs to change later

A constant: adding a GET route later is one controller function and one route file over the same service call.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the page reads its rows every 5 seconds but names no route for it (author).
