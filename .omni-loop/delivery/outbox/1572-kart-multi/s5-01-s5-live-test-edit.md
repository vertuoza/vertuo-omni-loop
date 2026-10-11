---
id: s5-01-s5-live-test-edit
prd: 1572
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

An earlier test said a race against other players sends nothing to the score at the finish; this step makes it send the time, so that test had to change although its file is outside this step's list. Is that edit fine?

## The decision, in plain words

Rewrote that one test to say the time is sent once at the finish, and put all the new tests in a new file inside this step's own area.

## The intro, for fun

A test swore the finish line was silent; the finish line begs to differ.

## The punchline, for fun

One old promise rewritten, the rest filed in the right drawer.

## The options, in plain words

A. A. Rewrite that one old test and keep every new test in this step's own area (built).
B. B. Delete the old test and rely on the new file's tests alone.
C. C. Leave the old test failing and ask for the territory to be widened.

## What I had to decide

The old test contradicted the slice's own done condition, so it could not stay as it was.

## What I did meanwhile

The edit stays in place; the new tests live in kart/hub.finish.test.ts.

## What it costs to change later

A reviewer must read one rewritten test in a file outside the slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reviewer prefers the test moved out of live.test.ts altogether (author)
