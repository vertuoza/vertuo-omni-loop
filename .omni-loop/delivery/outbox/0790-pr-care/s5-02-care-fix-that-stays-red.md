---
id: s5-02-care-fix-that-stays-red
prd: 790
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

A reviewer asks for a fix, PR care tries it, and the project's checks keep failing. What should happen to that comment?

## The decision, in plain words

PR care undoes its attempt, pushes nothing, and hands the comment to the PM with a note saying what it tried.

## The intro, for fun

The fix looked easy, then the tests disagreed three times in a row.

## The punchline, for fun

When the fix will not behave, a person gets the call.

## The options, in plain words

A. A. Revert, and hand the thread to the PM as asked (built).
B. B. Revert, and push back with the reason that the fix broke the checks.
C. C. Push the fix anyway and let the CI fix loop take it.

## What I had to decide

What a review thread judged fixed becomes when its fix cannot pass the preflight within limits.attempts tries; the spec only says each fix runs the preflight before pushing.

## What I did meanwhile

The skill reverts the attempt, pushes nothing, and replies with the asked verdict, naming what was tried; the thread stays open for the PM.

## What it costs to change later

One paragraph of kit/plugin/skills/pr-care/SKILL.md.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a pushed-back reply would suit such a thread better is not settled by the spec.
