---
id: s10-07-build-sent-again-once-questions-answered
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

Once the fleet has answered every question of a feature, how should the mission carry it on?

## The decision, in plain words

The mission sends the build again, once: with nothing left open it ships and goes to the reviewer, as any build does. After a second round of questions, a person carries it on.

## The intro, for fun

Homework checked, the student is sent back to class.

## The punchline, for fun

Twice at most, then the teacher steps in.

## The options, in plain words

A. Send the build again, once, then wait for a person (built).
B. Send the fix after the fleet's answers instead of the build.

## What I had to decide

What the mission sends once no high question of a feature is open at the level that works alone: the build again, the fix, or nothing until a person acts.

## What I did meanwhile

The build is sent again under the next run; a feature whose second run also ended on questions waits for a person once they are answered. It is also sent again when a person answered every question on the pull request.

## What it costs to change later

Sending the fix instead changes one line of the supervisor's next step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The page's own fix may also run when a person answers on the page, so a feature could be carried on twice.
- (author) The spec does not say what carries a feature on after the fleet answered.
