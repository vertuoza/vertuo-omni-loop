---
id: s2-01-malformed-ids-read-as-absent
prd: 1049
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the GitHub App reads an identifier that is not a real one, such as pull request number zero or a slice branch whose name holds no slice, should it keep passing that value along or treat it as missing?

## The decision, in plain words

The App now treats such a value as missing: an event naming no real pull request is ignored, a link line naming PRD zero names no PRD, and a branch with no real slice in its name counts as no slice in the retro.

## The intro, for fun

Somebody somewhere might one day open pull request number zero.

## The punchline, for fun

The App now politely pretends it never heard of it.

## The options, in plain words

A. Read a malformed identifier as absent where it enters the App (built).
B. Fail loudly on it, so the run errors and names the value.
C. Keep passing it along unchecked, as before, until a later slice tightens the readers.

## What I had to decide

Whether a malformed identifier reaching the GitHub App (a pull request number of zero or a fraction in a webhook delivery, a link line naming #0, a slice branch whose slice part is not s<n>) is refused where it enters and read as absent, or still passed along as before.

## What I did meanwhile

Each one is read as absent where it enters: the delivery sends no event, the stage event carries no PRD, the canon marker is ignored, and the retro groups that pull request by its number instead of by a slice. GitHub never sends such numbers, and every slice branch the loop cuts is named s<n>, so nothing real changes.

## What it costs to change later

Reading them as before is a few lines in the webhook schema, the stage reader and the two slice readers of the retro; no stored data or migration is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says runtime behaviour does not change and that a value a schema now refuses fails loudly where it is read; it does not say whether the App's lenient readers (the webhook router, the stage forward, the retro) fail or skip. They always skipped what they could not read, so they skip here too.
