---
id: s5-02-repair-fix-landing-rules
prd: 2980
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

When a repair's fix cannot go onto the mission's branch, should the work stop or wait, and what should it say?

## The decision, in plain words

A fix whose checks failed, that was closed, or that the merge refused stops the work and says why in the words the merge gave; a fix still being checked, or still a draft, waits. The files in conflict are not listed, since the merge does not name them.

## The intro, for fun

The fix knocked on the branch's door, and the door had opinions.

## The punchline, for fun

Now it leaves a note saying which opinion it was.

## The options, in plain words

A. Red, closed or refused stops the PRD with the merge's reason; a draft or running checks wait.
B. A conflicting fix is compared with the mission branch to name its files before the PRD stops.
C. A red fix waits too, until a person or a later run makes it green.

## What I had to decide

How judgeFix (apps/omni-app/src/missions/repair.ts) and land (repair-run.ts) treat a code repair's fix pull request. Merged into the mission branch: landed, the step goes again. Green, open, not a draft, into the mission branch: squash-merged through the joins' merge, never into the default branch. A failed check, a closed pull request, another base, or a merge GitHub refuses: the PRD stops, saying why. A draft, a check still running or not judged, or no check at all: it waits, read again each run. A mission at with-you has no branch of its own, so its code fix stops the PRD. The spec asks that a conflict name its files, as a landing does; GitHub's merge refusal gives a reason, not files, so the PRD names that reason. The fix's reviews and outbox are not read: it is a bug fix, not a PRD.

## What I did meanwhile

Built as decided and tested (supervisor.repair.test.ts, repair.test.ts). A fix that waits is read again every run, so one a person repairs lands on its own.

## What it costs to change later

Each rule is one line of judgeFix; naming the files would read the fix's conflict through the keeping-up compare, a change in one function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a conflicting fix stops the PRD and names its files, and the merge refusal names none.
