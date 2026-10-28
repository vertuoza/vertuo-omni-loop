---
id: s8-02-planned-handoff-nobody-left
prd: 2537
slice: s8
rank: medium
bears-on: none
raised: 2026-10-28
wave: 4
---

## The question, in plain words

When an account nears its usage limit but no other account can take the job over, should the runner still stop the job, or let it run until the account really runs out?

## The decision, in plain words

As the spec says, the runner stops the job and marks it failed with no tokens left, even though the account still had some work in it.

## The intro, for fun

Leaving the party early only helps if someone is there to drive you home.

## The punchline, for fun

Right now we leave anyway and wait on the curb.

## The options, in plain words

A. Stop the run and fail the job naming no tokens left, the option built, as the spec reads.
B. Leave the run going when no account can take it over or the cap is reached, so it works until its wall and only fails there.

## What I had to decide

Whether a planned usage handoff with no account to take over (or past the three account changes) stops the run and fails the job, or lets the run go on until its wall.

## What I did meanwhile

usageHandoff in kit/lib/runner/job.ts marks the account out until the reset the pressure named, finds no next account, and fails the job with no tokens left: every account is out until <reset>, the run already stopped and no note written. A runner with a single account in its file is hit by this on Claude's first allowed_warning.

## What it costs to change later

Letting the run go on is a check before the stop: the next account looked up first, the run left alone when there is none. One function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec's handoff section says none left ends the job failed, but does not say whether that holds for a planned handoff, which could still have worked until the wall
