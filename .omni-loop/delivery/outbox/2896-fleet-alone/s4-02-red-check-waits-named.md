---
id: s4-02-red-check-waits-named
prd: 2896
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 4
---

## The question, in plain words

The spec says a red check on a ready PRD goes back to the agent that looks after its pull request. Does the mission send that agent itself in this slice?

## The decision, in plain words

Not yet: a PRD with a red check stays off the mission branch, and the mission names the failing check as what it waits on. Nothing new is sent for it, and it joins once its checks are green.

## The intro, for fun

The bouncer says why you are not in, but does not fix your shoes.

## The punchline, for fun

Knowing what is red is half the repair.

## The options, in plain words

A. A. The PRD waits, naming the red check; nothing is sent (built).
B. B. The mission sends the pull request's care agent once per red head.

## What I had to decide

Keep naming the red check as what the PRD waits on, or have the mission send the pull request's care agent as a new step of its run.

## What I did meanwhile

The gate reads the pull request again on every run, a minute apart, and joins it once every check is green.

## What it costs to change later

Sending the care agent later costs one more step key and its tests in the supervisor; the database already accepts the job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The done-when of this slice asks only that the mission says what the PRD waits on; sending the care agent needs a step the run keys and the database's key shape do not have yet.
