---
id: s3-02-branch-cut-by-the-first-run
prd: 2896
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

The spec says Start refuses when the repository does not allow rebase merges. Start is a page and a route outside this slice, so where is the setting checked?

## The decision, in plain words

The mission's first run after Start cuts the branch and checks the setting. With rebase merges off it cuts nothing, sends no PRD, and the mission waits naming the setting.

## The intro, for fun

A door with no lock still needs someone to check it before the party.

## The punchline, for fun

Better a polite wait than a branch nobody can land.

## The options, in plain words

A. A. The mission's first run cuts the branch and checks the setting; the mission waits naming it (built).
B. B. The Start route checks the setting and refuses at once, the run only cuts.

## What I had to decide

Whether Start itself, in the page's route, should also refuse on the setting.

## What I did meanwhile

The mission's job asks GitHub through the app, cuts the branch from the default branch once, and leaves an existing branch untouched.

## What it costs to change later

Refusing in the route as well costs one call to GitHub in the Start route and one test; the run's check can stay as the second guard.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The territory names no file of the Start route (author).
