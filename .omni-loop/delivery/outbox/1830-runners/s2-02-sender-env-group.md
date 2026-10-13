---
id: s2-02-sender-env-group
prd: 1830
slice: s2
rank: high
bears-on: ADR-0057
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The pull request skill has to know who sent a job from the app, and the kit may only read settings through its one settings module, which sat outside this slice's area. Where should that be read?

## The decision, in plain words

Two settings, the sender and the runner's name, were added to the kit's settings module as one group set by the runner, never by a person, and a small command prints the sender line the pull request skill copies.

## The intro, for fun

The note saying who sent the parcel had to pass through the front desk.

## The punchline, for fun

The front desk was in another building, so we borrowed a pen.

## The options, in plain words

A. A. The group in the env module, and omni runner sender printing the line.
B. B. /omni:pr reads the two variables with printenv itself, and the kit reads nothing.
C. C. The runner writes the sender line into the job's prompt instead of the environment.

## What I had to decide

How /omni:pr learns OMNI_SENT_BY and OMNI_RUNNER, when the environment may only be read through kit/lib/env/read.ts (ADR-0057), a file outside s2's territory.

## What I did meanwhile

kit/lib/env/read.ts gains the RUNNER_SENDER group (both members optional, so a half-set pair stops no command and writes no line), listed in PLATFORM_VARIABLES, read as vars.runnerSender; kit/lib/env/read.test.ts covers it. omni runner sender prints the line, and /omni:pr's SKILL.md runs it before opening a pull request.

## What it costs to change later

Moving the read elsewhere is a few lines in the env module and the command; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) None beyond the territory: ADR-0057 already settles that the environment is read in the env module.
