---
id: s3-01-leftover-link-code-outside-territory
prd: 359
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The arcade no longer has a step to link GitHub, but some pieces that served it live in files this slice may not touch. Should this slice remove them, or leave them for a later tidy-up?

## The decision, in plain words

This slice leaves those pieces in place, unused by the arcade. The practice arcade, which only pretends to sign in, now also pretends to link GitHub at sign-in, so its guest can play at once like everyone else.

## The intro, for fun

The arcade tore down the old GitHub bridge, but the signposts are on the neighbour's lawn.

## The punchline, for fun

They stay up for now, pointing proudly at nothing.

## The options, in plain words

A. A: leave the unused pieces where they are, and let the practice arcade link its guest when it signs in (built)
B. B: let this slice remove the unused pieces, and have the practice arcade give its guest a GitHub name at sign-in
C. C: remove the unused pieces in a later tidy-up slice

## What I had to decide

Whether to remove the now-unused link-step code that sits outside s3's territory.

## What I did meanwhile

The arcade no longer calls the link step. Left in place, unused by the arcade: Account.linkGithub in src/arcade/types.ts and its three implementations (account-supabase.ts, account-demo.ts, account-closed.ts); the callback's next=link answer in src/data/sign-in.ts (['linked', …] / ['link_error', …]); and games/room.ts's 'LINK GITHUB TO EARN XP' visitor label, which no signed-in account reaches now. The demo account's signIn does not set a GitHub login and its save refuses a guest without one, so ArcadeApp's signIn calls account.linkGithub() once when the session it gets back has no login: the demo guest is linked at sign-in and plays at once.

## What it costs to change later

A constant: a follow-up deletes the unused method, the next=link branch and the label, and moves the demo's made-up login into its signIn.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no slice for the Account interface, sign-in.ts's next=link path or games/room.ts once the link step goes (author)
