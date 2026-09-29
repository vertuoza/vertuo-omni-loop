---
id: s5-03-target-install-red
prd: 563
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 4
---

## The question, in plain words

When another repository's own checks fail only because its tools are not installed on this computer, should the build install them, or leave that repository's online checks to decide?

## The decision, in plain words

It never installs anything in another repository. It names the missing install as a step for a person and lets that repository's online checks decide.

## The intro, for fun

The checks want their toolbox, and the build promised not to touch the shed.

## The punchline, for fun

It leaves a note on the door and lets the online checks do the inspection.

## The options, in plain words

A. A. Never install in another repository; name it for a person and let the online checks decide, the option built.
B. B. Run the repository's own install once before its checks, as its configuration names it.

## What I had to decide

What finishing a target (/omni:ultra-yolo step 4) does when the target's committed preflight is red for want of an install, since the spec allows only that preflight to run in a target.

## What I did meanwhile

No install runs in a target. The red step is named as a human step, the target feature PR is still marked ready, and its CI is the check that holds or frees the plan PR.

## What it costs to change later

One sentence in the ultra-yolo skill: allowing an install would have to name which install command runs, something a target's config would then declare.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lets only a target's committed preflight run and does not say what happens when that preflight needs its dependencies installed first.
