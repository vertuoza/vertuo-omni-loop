---
id: s6-01-setup-token-own-copy-of-the-flows
prd: 1660
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

Making a token from the terminal now offers the same two ways back as signing in. Should it say exactly what signing in says when it ends badly, and should both share one piece of code for it?

## The decision, in plain words

It says the same sentences, naming its own command to run again, and keeps its own short copy of the steps, because the sign-in's steps are not shared and changing them was not part of this piece of work.

## The intro, for fun

The token maker borrowed the sign-in's script and changed one name in it.

## The punchline, for fun

Two actors now say the same lines, each from their own copy.

## The options, in plain words

A. A. Its own copy, same sentences, naming omni setup-token
B. B. One shared module for both commands, same sentences

## What I had to decide

Keep the token maker's own copy of the two ways back (A), or move the shared steps into one place both commands use (B). Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Built as A: omni setup-token reuses the device module and the race, and holds its own fallback, endings and no-device line, mirroring omni signin. Its endings read: the sign-in was refused in the browser; the sign-in link expired: run omni setup-token again; unreachable.

## What it costs to change later

B is moving three small helpers from the sign-in command into a shared module and pointing both commands at it, with no change to what anyone sees: a refactor of an hour, nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan keeps the sign-in command outside this slice's territory, so its unexported helpers could not be shared from here.
- (author) The spec says the token maker takes the same lines without saying whether the expired line should name omni signin or omni setup-token to run again; it names the command the person ran.
