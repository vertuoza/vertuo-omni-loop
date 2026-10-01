---
id: s3-01-push-wiring-outside-territory
prd: 859
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

Sending a pitch needed two small additions in places the plan did not list for this step: the terminal's link to the Omni page, and the help text that lists every command. Should they stay?

## The decision, in plain words

Yes: the terminal's link to the Omni page learnt the two pitch calls, beside the proof ones, and the help lists the new push command, so the command check that every command has its help line stays green.

## The intro, for fun

The pitch was packed and ready, but the postman had no address for it.

## The punchline, for fun

Two lines in the address book later, it went out the door.

## The options, in plain words

A. A. Keep the two calls in the shared client and the help entry for omni pitch push (built).
B. B. Give the pitch push its own small client inside its own folder, and leave the help entry to the next slice, with the command count test failing until then.

## What I had to decide

Keep the two pitch calls in the terminal's shared link to the Omni page and the help line for omni pitch push, or move them somewhere the plan names.

## What I did meanwhile

kit/lib/ask/client.mjs gained requestPitchUploads and registerPitch, next to the proof calls; kit/lib/help/entries.mjs gained the pitch command's entry, and its test counts 40 commands.

## What it costs to change later

Moving them later is moving two short functions and one help entry; nothing stored changes, and the next slice adds its own help entry for the skill either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s3 names the command's files and the bundle, but not the shared client or the help table, which every new command must touch. (author)
