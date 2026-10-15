---
id: s4-01-route-test-lists-the-sweep
prd: 1794
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

Serving the new hourly reminder means the test that lists every background job of the app has to name it too, and that test sits outside the files this step was given. May it be updated here?

## The decision, in plain words

I updated that one test so it expects the new reminder job beside the others, and changed nothing else outside this step's files.

## The intro, for fun

A new job joined the roster, and the roll call had to learn its name.

## The punchline, for fun

One more name on the list, nothing else moved.

## The options, in plain words

A. A. Keep the route test updated in this step, so the new job is served and checked together.
B. B. Leave the route test to a separate change, and accept a red test until it lands.

## What I had to decide

Answer A to keep the test as updated here, or B to move that change into a follow-up of its own.

## What I did meanwhile

The test now expects eleven jobs instead of ten; every other line of it is unchanged.

## What it costs to change later

Moving the change elsewhere later is a copy of a few lines; nothing is stored and nothing a person sees changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's file list for this step names the job list's own test file but not the route test that also counts the jobs.
