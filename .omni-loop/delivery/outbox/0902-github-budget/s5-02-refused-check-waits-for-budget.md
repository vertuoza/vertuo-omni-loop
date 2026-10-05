---
id: s5-02-refused-check-waits-for-budget
prd: 902
slice: s5
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

When the shared GitHub budget is paused or too low, what should the outbox check do with a pull request it cannot read yet?

## The decision, in plain words

It writes one line to the log, posts nothing, and asks to be tried again when the budget says it may, never sooner. If it is still refused after its usual retries, the existing failure path takes over once GitHub answers again.

## The intro, for fun

The kitchen is closed until three; do you stand at the door knocking?

## The punchline, for fun

We leave a note and come back at three.

## The options, in plain words

A. A. Log one line and retry at the time the budget gives (built).
B. B. Log one line and end the run quietly, without retrying; the next push or re-run evaluates again.
C. C. Treat a refusal like any other error: retried on the usual schedule, then failed.

## What I had to decide

Whether a refused outbox check waits for the budget and retries at the time the budget gives, or gives up at once.

## What I did meanwhile

A refused step logs one line naming the pull request and the time GitHub resumes, and is retried at that time; the check run is not created or changed meanwhile.

## What it costs to change later

A constant change in the outbox check: retry later, or stop without retrying. No data is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The other five jobs of the app are not taught this: a refused call there is an ordinary error, retried on the job's usual schedule, which the budget refuses again unsent.
- (author) A check whose retries all fall inside a long pause ends in the failure handler, which is itself refused while the pause lasts; the check run may then be left as it was until the next push.
