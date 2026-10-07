---
id: s3-03-harvest-follows-login
prd: 1180
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Writing the approver's name without the @ sign also changes what two other parts of the product expect, which this slice was not given. Should the slice update them, or leave the change to a later piece of work?

## The decision, in plain words

The slice updated them: two tests now expect the name without the @ sign, and the app's built copy was rebuilt so it matches the code.

## The intro, for fun

One little @ sign left the room, and two tests noticed it had gone.

## The punchline, for fun

They were told politely, and they agreed to stop looking for it.

## The options, in plain words

A. A. Update the two harvest tests and rebuild the app bundle in this slice, so the preflight is green.
B. B. Leave them out of this slice, with a red preflight, for a follow-up slice to fix.

## What I had to decide

Keep the two test updates and the rebuilt app copy in this slice, or move them out to a follow-up.

## What I did meanwhile

Two tests outside the slice's ground expect the approver without @, and the app's committed bundle is rebuilt from the changed kit code; nothing else moved.

## What it costs to change later

Reverting is three files: two one-line test expectations and a rebuild of the app bundle.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s3 names neither the harvest tests nor the app bundle; without them the preflight is red, so leaving them out was not a working option. (author)
