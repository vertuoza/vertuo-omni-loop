---
id: s1-03-ended-job-report-refused
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

A runner may report on a job that already ended, for example one marked lost while the runner was silent. What should the app answer?

## The decision, in plain words

The app refuses the report with a conflict, saying the job has ended and why, and the runner is expected to stop that run. A runner coming back from silence finds its own jobs marked lost before its return counts.

## The intro, for fun

A runner comes back from a long coffee and says it is still on it.

## The punchline, for fun

The app says the job was handed in as lost, please put the pen down.

## The options, in plain words

A. Refuse with 409 and the reason; the runner stops the run
B. Answer 200 with cancel true, so the runner kills the run as for a cancel
C. Accept the late report and overwrite the lost status

## What I had to decide

The answer to a report on an ended job, and the order of the lost-runner sweep and the caller's own check-in.

## What I did meanwhile

POST /api/runners/jobs/<id> answers 409 {error: 'This job has ended: <status>[, <reason>]. Stop it.'} for a done, failed or cancelled job, and for a status that goes back. Each next and job update runs runners_mark_lost() before it records the caller's check-in, so a runner silent over 90 s loses its own claimed and running jobs on its next call, as the spec's 'on the next next' reads. s2's runner should treat a 409 on a report as a stop.

## What it costs to change later

A constant on both sides: the status code and the order of two calls in the service, and the matching branch in the runner.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names status updates after cancel and after runner lost as cases to test, not the answer (author).
