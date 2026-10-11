---
id: s1-04-revoke-signout
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The spec says revoking a terminal token also signs out the sign-in it keeps, but revoking happens in the database, which cannot reach the sign-in service. What is enough?

## The decision, in plain words

Revoking wipes the kept sign-in from the token at once, so nothing can renew it again. The sign-in itself is not told; access already handed out stops within the hour, as the spec allows.

## The intro, for fun

The key is thrown away, but the lock was never told.

## The punchline, for fun

Nobody can open the door again, and the last guest leaves within the hour.

## The options, in plain words

A. A. Wipe the kept sign-in in the database; access already handed out lasts an hour at most (built)
B. B. Also end the sign-in at the sign-in service, revoking through galaxy's server

## What I had to decide

Accept that a revoked token's last access runs out within the hour, or ask for the sign-in to be ended at the sign-in service as well.

## What I did meanwhile

A revoked token stops at its next renewal, an hour at most; the forgotten sign-in expires on its own on the sign-in service.

## What it costs to change later

Ending it at the sign-in service too means revoking through galaxy's server instead of the database alone: a change to the profile page's revoke and an admin call.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How long an unused sign-in lives on the hosted sign-in service before it expires was not checked (author)
