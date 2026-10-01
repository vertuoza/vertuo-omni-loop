---
id: s1-01-constituents-check-in-ci
prd: 871
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The new database check for constituents only runs on pull requests if the database workflow lists it, and that workflow sits outside this slice's area. Should the slice add it there?

## The decision, in plain words

I added one step to the database workflow so every pull request runs the constituents check, beside the business and Jev checks.

## The intro, for fun

A brand new safety check that nobody runs is just a very tidy file.

## The punchline, for fun

So it got a seat on the bus with the other checks.

## The options, in plain words

A. A. Keep the step in the database workflow, added by this slice.
B. B. Drop the step here and add it in a follow-up change.
C. C. Run the constituents check from inside the business check instead.

## What I had to decide

Keep the extra step in the database workflow, or move it to a separate change.

## What I did meanwhile

Every pull request touching the database runs the constituents check.

## What it costs to change later

Removing the step is a one-line change; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no owner for the database workflow file; I took it as the slice that writes the check. (author)
