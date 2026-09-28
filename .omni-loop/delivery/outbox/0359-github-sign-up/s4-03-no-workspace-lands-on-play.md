---
id: s4-03-no-workspace-lands-on-play
prd: 359
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The design says a person who signs in and belongs to no workspace goes straight to the sign-up page. Should the sign-in itself send them there, or should the game's own screen point them to it?

## The decision, in plain words

The sign-in still sends everyone to the game. A person with no workspace sees the game's 'wrong cartridge' screen, which points them to the sign-up page, one click away.

## The intro, for fun

The front door opens onto the arcade even for people who have no ticket yet.

## The punchline, for fun

The machine they reach kindly tells them where the ticket booth is.

## The options, in plain words

A. A: keep landing on the game, whose outsider screen points at sign-up (built)
B. B: have the sign-in send a person in no workspace to the sign-up page directly, in a rework slice

## What I had to decide

Whether the arcade sign-in callback redirects a person in no workspace to /signup, as the spec's diagram shows.

## What I did meanwhile

apps/galaxy/app/auth/callback (s2's territory, not s4's) still redirects every arcade sign-in to /play; s3's outsider screen links to /signup. This slice's afterSignIn completes requests but does not choose the redirect.

## What it costs to change later

A constant: one membership read and one branch in the callback's redirect.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives the callback route to s2 and the outsider screen to s3, and names no slice for the redirect the spec's diagram draws
