---
id: s1-06-token-hand-back
prd: 1628
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

A new token has to reach the page that asked for it, shown once, without sitting in the address bar. The spec does not say how.

## The decision, in plain words

The sign-in keeps the token for that browser for five minutes, where no script can read it, and the profile page asks for it once. The terminal gets it on its own computer, as a sign-in code is today.

## The intro, for fun

A brand-new secret has to cross the browser without leaving footprints.

## The punchline, for fun

It waits five minutes in a sealed envelope, then the envelope burns.

## The options, in plain words

A. A. Kept five minutes for that browser, read once by the profile page; the terminal gets it on its own computer (built)
B. B. Shown on a page of the sign-in itself, never sent back to the profile page

## What I had to decide

Keep the five-minute, read-once hand-back for the profile page, or choose another way to show the token once.

## What I did meanwhile

The profile page (slice s4) shows the token by asking for it once on its return; the terminal command (slice s3) reads it on its own computer.

## What it costs to change later

Contained in galaxy's sign-in and one route; the two slices that read it follow whatever is chosen.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The token travels to the terminal in the address of its own computer, which the browser may keep in its history (author)
