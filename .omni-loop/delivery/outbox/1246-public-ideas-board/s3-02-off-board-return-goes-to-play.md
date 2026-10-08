---
id: s3-02-off-board-return-goes-to-play
prd: 1246
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When a sign-in to vote comes back asking to return to an address that is not an ideas board, where should the person land?

## The decision, in plain words

The address is refused: nothing is signed in or voted, and the person lands on the game's start page, as other sign-ins that go wrong already do.

## The intro, for fun

A return ticket with a scribbled-over destination does not get you a free ride.

## The punchline, for fun

It gets you the station's main hall, where every lost traveller already waits.

## The options, in plain words

A. Refuse it and land on /play, with nothing signed in and nothing voted.
B. Refuse it and land on the home page at /.
C. Still sign the person in, and land on /play with a line saying the board address was not recognised.

## What I had to decide

What the auth callback does with a voter's return whose board is not an owner/name pair: refuse it, and send the person to which page.

## What I did meanwhile

Off the allowlist, the callback exchanges no code, counts no vote and redirects to /play. Only /ideas/<owner>/<repo>, read with the board route's own rule, is ever a landing.

## What it costs to change later

One constant in the voter callback; the allowlist itself stays.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan asks that the callback refuse a return path off the allowlist, but does not say where the refused person goes.
