---
id: s2-01-route-test-outside-territory
prd: 612
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Serving the new collector changed the list of jobs the app answers for, and an existing test that pins that list sits outside this slice's area. Was it right to update that test here?

## The decision, in plain words

We updated the existing test so it expects the new collector beside the three jobs it already listed, and changed nothing else in it.

## The intro, for fun

Adding a new job to the app made an old test count to four instead of three.

## The punchline, for fun

We taught the test to count one higher and left the rest of it alone.

## The options, in plain words

A. A: Update the existing route test in place to list the collector (what was built).
B. B: Move the served-functions assertion into the collector's own folder and leave the route test untouched.
C. C: Widen the plan's territory for this slice to include the route test, and keep the change as built.

## What I had to decide

Whether a test that pins the served functions may be updated by the slice that adds a function, although its file sits outside the slice's territory.

## What I did meanwhile

The route test expects four served functions and seven registered ones (the three failure handlers included); the whole omni-app suite is green.

## What it costs to change later

Reverting is a few lines in one test file; nothing stored or shipped depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 names the served route file but not the test that pins it (author).
