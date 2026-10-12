---
id: s3-01-route-test-outside-territory
prd: 1679
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

Adding the new budgets check to the App changes how many background jobs it serves, and a test outside this slice's area counts them. Should this slice have updated that test?

## The decision, in plain words

I updated the count in that test so it names the new budgets check, and changed nothing else in it.

## The intro, for fun

One new job joined the App, and the head count noticed.

## The punchline, for fun

The roll call now has one more name on it.

## The options, in plain words

A. A. Keep the edit: the route test names the budgets check and counts 9 functions and 14 registrations.
B. B. Move the edit into a follow-up change owned by whoever owns the outbox check's folder.

## What I had to decide

Whether a slice that adds an App function may touch the test that lists every function, though it sits outside its declared area.

## What I did meanwhile

The test lists the budgets check among the functions the App serves; every other line of it is unchanged.

## What it costs to change later

Undoing it is reverting four lines of one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan did not list the route test in s3's territory, though adding a function in functions.ts always changes it
