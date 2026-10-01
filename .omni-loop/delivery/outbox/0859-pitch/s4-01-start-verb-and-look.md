---
id: s4-01-start-verb-and-look
prd: 859
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The spec names four pitch commands; checking the four refusals and finding the product's look needed a fifth step at the start. Should it be its own command, and what happens when the look cannot be read?

## The decision, in plain words

A start command runs the four refusals, reads the product's look from the Omni page and opens the run's folder. When the look cannot be read, the pitch goes on in the arcade look and says so in one line.

## The intro, for fun

Four commands were invited to the pitch, and someone still had to open the door.

## The punchline, for fun

So a fifth one turned up early, checked every ticket and switched the lights on.

## The options, in plain words

A. A start command for the refusals, the look and the run folder; an unreadable look falls back to arcade (built).
B. A start command, but an unreadable look stops the pitch with one line.
C. No start command: each verb checks the refusals itself, and the skill reads the look on its own.

## What I had to decide

Keep omni pitch start (refusals, look, run folder) and the arcade fallback, or fold the refusals into each verb and stop when the look cannot be read.

## What I did meanwhile

omni pitch start <n> --for <audience> refuses with one line, or makes the run folder, writes pitch.json with the PRD, audience, look and commit, and prints them. The terminal's link to the Omni page gained readPitchLook, beside the other pitch calls. A look it cannot read is arcade, with one line on stderr.

## What it costs to change later

Folding the refusals into the other verbs later is moving one function call; removing the fallback is one line. Nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the slide, music, video and push verbs only, and does not say what happens when the product's look cannot be read.
- (author) The plan's territory for s4 does not name the terminal's shared link to the Omni page, where the look call sits beside the pitch calls s3 added.
