---
id: s4-03-signed-out-is-held
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

When this computer is not signed in to the Omni page, or no page is set up, what should the check of a server-approved PRD say?

## The decision, in plain words

It holds the PRD as if the server could not be reached, with the same line, and adds one line saying why: no page set, or sign in first. It asks nothing of the server.

## The intro, for fun

Knocking on a door you have no key for looks a lot like knocking on a door nobody answers.

## The punchline, for fun

Either way you wait on the porch, but now a note says why.

## The options, in plain words

A. A. Held as unreachable, saying why, as built
B. B. Refused, as refused (no sign-in)
C. C. A sixth state, signed out

## What I had to decide

Which of the five states a missing sign-in or a missing Omni page reads as.

## What I did meanwhile

omni approval prints server unreachable · held, not failed, exits 1, and writes the reason on stderr; prdState gives the PRD the unreachable stage.

## What it costs to change later

Changing it is one branch in the approval reader and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's table names unreachable as no answer within 5 seconds and one token refresh, and refused as a non-member approver or an error from the page; a terminal never signed in is neither.
