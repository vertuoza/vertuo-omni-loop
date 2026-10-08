---
id: s3-01-prerequisites-in-the-roadmap-push
prd: 1218
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When the computer sends a roadmap to its page, how should the checklist of prerequisites and the latest check of them travel with it?

## The decision, in plain words

The checklist and the latest check on this computer ride along only when the roadmap has a checklist, so an older roadmap is sent exactly as before. A plain send carries this computer's latest check, or none when it never checked.

## The intro, for fun

A checklist nobody can see is just a diary.

## The punchline, for fun

So it travels with the roadmap, but only when there is one.

## The options, in plain words

A. Two optional fields, only with a Prerequisites table; a plain push sends this machine's last result or null (built).
B. Always send both fields, empty for a roadmap without a table.
C. Send the prerequisites result through its own call, apart from the roadmap push.

## What I had to decide

The shape of the prerequisites in the body omni roadmap push sends to the app, which the next slice's API validation and storage read.

## What I did meanwhile

roadmapPushBody adds two fields only when the roadmap has a Prerequisites table: prerequisites (each row as parsed, blocks 'all' or row ids, repos [] outside a plan repository, its card or null) and prerequisiteResult ({ machine, checkedAt, rows: [{ id, state, detail }] }, or null). omni roadmap prereqs sends the run it just made; omni roadmap push alone sends this machine's last kept result, null when this machine has none, so the app should keep a stored result when it receives null.

## What it costs to change later

A field renamed or reshaped in one kit module and the API's schema of the next slice, before either ships: no stored shape exists yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the push carries every row, its state, the machine and the time, but not the field names or whether a push without a fresh result should clear the stored one.
