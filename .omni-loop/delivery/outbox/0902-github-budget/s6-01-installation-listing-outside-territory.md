---
id: s6-01-installation-listing-outside-territory
prd: 902
slice: s6
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

The App's way of listing the repositories it reaches went around the shared GitHub budget, and it sits in the sign-up code, outside what this slice may change. Should the slice reach in and close it?

## The decision, in plain words

I closed it: that listing now always uses the budget-aware door its caller hands it, and the one older shortcut that skipped the door is gone, since nothing used it any more.

## The intro, for fun

A side door in the sign-up hallway let one GitHub question skip the queue.

## The punchline, for fun

The door is now a wall, and the queue is one line again.

## The options, in plain words

A. A. Close the side door in the sign-up module, outside the slice's territory (built).
B. B. Leave the sign-up module untouched and list its plain listing as a known exception in the call-site test.
C. C. Leave it to a follow-up slice that owns the sign-up module.

## What I had to decide

Whether to change the sign-up module's GitHub helper, outside the slice's territory, so the repositories listing cannot go around the shared client.

## What I did meanwhile

Removed githubApp().installationRepositories (only its own test used it once Settings > Repositories read through the client), made reachedRepositories take its fetch from its caller, and moved its tests onto reachedRepositories directly.

## What it costs to change later

A constant: putting the method back is a few lines in apps/galaxy/src/signup/github-app.ts; no stored shape, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left the sign-up module out of s6 on purpose (author).
