---
id: s2-03-answers-settle-the-stop
prd: 2255
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a person answers the questions a stopped fix asked, may that answer let the fix cross the line it stopped at, such as a change to stored data or to something other code depends on?

## The decision, in plain words

Yes, for that one decision only: the answer counts as the behaviour wanted and the fix goes on, and a person still reviews and merges the pull request. Any other line crossed later stops the fix again and asks again.

## The intro, for fun

A fix waits at a door until someone tells it which way to turn.

## The punchline, for fun

It still has to show its work to the reviewer.

## The options, in plain words

A. Let the answer settle the decision the stop named, whatever line it crossed, and let the reviewer judge the pull request.
B. Keep stopping at a stored shape or a shared contract whatever the answer, so Design it first is the only way forward for those.
C. Ask a second time, naming the line, before crossing a stored shape or a shared contract.

## What I had to decide

PRD 2255 says the resume carries on from its triage with the answers as the behaviour wanted, and that the fix plan, the red test, the fix and the pull requests run as written. It does not say what the boundary check does with a line the answer itself crosses (a `risk.storedShape` or `risk.sharedContract` path). Both skills now say the answers settle the decision the stop named, and that one only; any other crossing is a new stop.

## What I did meanwhile

Wrote that in each skill's `## Resuming with answers`, and pinned its phrases in `kit/test/need-human-skills.test.ts`. A resume still opens pull requests and merges none.

## What it costs to change later

Two sentences in two skill files and the phrases pinned by the kit test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the product owner wants an answer to be enough for a stored-shape or shared-contract change, or wants those to go through the brainstorm line whatever the answer
