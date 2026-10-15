---
id: s2-01-signin-expired-means-unrenewable
prd: 1990
slice: s2
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When the Omni page sign-in on a computer is past its expiry date but can still be renewed automatically, should it count as signed in?

## The decision, in plain words

It counts as signed in, because the kit renews it on its next call; only a sign-in past its expiry with nothing to renew it counts as expired.

## The intro, for fun

A key past its date can still open the door, if it brings a spare.

## The punchline, for fun

Only the key with no spare gets the orange note.

## The options, in plain words

A. A. Expired only when nothing can renew it (as built)
B. B. Expired as soon as the access token's expiry has passed

## What I had to decide

Pick A to keep the renewable sign-in green, or B to flag every sign-in past its hourly expiry.

## What I did meanwhile

A sign-in with an expiry date in the past and a refresh token reads as signed in; one with no refresh token reads as not signed in.

## What it costs to change later

Switching to B is one condition in the sign-in check and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the spec's "not expired" meant the access token's own hourly expiry (author)
