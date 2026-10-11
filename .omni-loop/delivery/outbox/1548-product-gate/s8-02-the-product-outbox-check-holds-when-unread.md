---
id: s8-02-the-product-outbox-check-holds-when-unread
prd: 1548
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

What does the outbox check on a product PRD's pull request show when the server cannot be read, when the PRD named is not one of this repository's product, or when the check itself fails?

## The decision, in plain words

An unreadable server shows held, not failed, as the approval check does, while a PRD this repository's product does not have, or a run that failed after its retries, shows red with the reason, since this check is the gate. Its details open the product's Questions tab, and it posts no comment.

## The intro, for fun

Every gate needs a plan for the day the keyholder is out to lunch.

## The punchline, for fun

Ours waits politely at the door instead of slamming it shut.

## The options, in plain words

A. Held when unread, red for an unknown PRD or a failed run (built).
B. Red whenever the server cannot be read.
C. Skipped when the server cannot be read, so it neither passes nor blocks.

## What I had to decide

How the product PRD's outbox check reads when the server is out of reach, when the PRD is not this repository's, and when its own run fails.

## What I did meanwhile

Built as described; a repository's own PRD and a plan repository's target pull request read exactly as before.

## What it costs to change later

Each reading is one line of the check's verdict, changed without touching any stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the open and the clear readings only; the held, unknown and failed readings follow the approval check's settled answers rather than anything said of the outbox check itself.
