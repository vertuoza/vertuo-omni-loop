---
id: s1-02-poll-answer-codes
prd: 1660
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

When the terminal asks whether the sign-in was approved, should every answer come back as a plain success, or should waiting, too fast, expired and refused each carry their own web status?

## The decision, in plain words

Each carries its own web status, and the answer's words say the same thing. The terminal reads the words, so either way it works; the statuses only help whoever reads the server's logs.

## The intro, for fun

The terminal keeps asking: are we there yet?

## The punchline, for fun

The page now answers in two languages at once, just in case.

## The options, in plain words

A. A. A web status per answer, the body's status field the same: 200, 429, 410, 403.
B. B. 200 for every answer the terminal expects; only malformed bodies and failures carry an error status.

## What I had to decide

Keep a status per answer (A), or answer 200 for every outcome the terminal expects (B).

## What I did meanwhile

Built as A: pending and approved answer 200, slow_down 429, expired 410, denied 403; the body's status field is the contract the kit reads (src/ask/device.contract.ts).

## What it costs to change later

B is a one-line table change in the controller and its test, before s4's kit reads it; after, a kit that branches on the HTTP status would have to change too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names 404, 410 and 429 in its test seams without saying which answer each is; 404 is read here as the route missing on an older page (the kit's fallback), never an answer of these routes. (author)
