---
id: s2-01-fix-with-answers-route
prd: 2270
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The plan's Fix with answers button has no home in its slice: the route that sends a job and the rules that queue a fix both live in another slice's files. Where should the button's server side live?

## The decision, in plain words

The button calls a new route of its own, which reuses the automatic fix's rules with one small addition, so a person pressing it queues exactly the fix the page would have queued, in their own name, even with the repository's switch off.

## The intro, for fun

A button was drawn, but the wires behind it ran through someone else's walls.

## The punchline, for fun

So it got its own door, and borrowed the key.

## The options, in plain words

A. A. A new route in this slice's own folder, reusing the continuation's rules with a small addition in the runners service (as built).
B. B. Extend the send route and its contract with an optional continuation link, as the spec words it.
C. C. Show the button only and queue the fix without a link, so no shared file changes.

## What I had to decide

Whether the send route should take the link instead of a route of its own, and whether the page may show Answered with the button while the repository's switch is on.

## What I did meanwhile

The button posts to /api/runners/jobs/<id>/fix; the answers are read again from the PRD's stored snapshot on the server, never taken from the browser.

## What it costs to change later

Switching to the send route later means moving one function and one test, and dropping one route.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 lists only the page and the runners' API routes, while the spec says the send route takes the link: that route's contract and service belong to s1 (author).
