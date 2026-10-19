---
id: s1-01-dead-claim-defaults-outside-config
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Where should the defaults of the two new settings live, the released label's name and the 240-minute quiet time, when a repository does not set them?

## The decision, in plain words

The kit applies them itself when a setting is left out, so every repository's settings read exactly as before; the catch is that asking the kit to print either setting answers that it is not set until a repository sets it.

## The intro, for fun

Two new settings walked in, and every seat at the table already had a name card.

## The punchline, for fun

So they wait by the door, and the kit tells them apart by heart.

## The options, in plain words

A. The kit applies both defaults itself when a setting is left out, as it already does for the hook size limit.
B. Every repository's settings carry both defaults, the new label is created at setup with the others, and the tests that pin those lists are updated.

## What I had to decide

Keep the defaults in the kit's code (A), or write them into every repository's parsed settings (B) and update the tests that pin the full lists of labels and limits.

## What I did meanwhile

A config that leaves `labels.released` or `limits.claimDeadMinutes` out reads `omni:released` and 240 minutes on the board, the Engineering board and `omni board`, through `releasedLabel()` and `deadClaimRules()`. `omni config labels.released` and `omni config limits.claimDeadMinutes` exit 2 until a repository sets them, so s2 and s3 read the label through `releasedLabel()` in code, or name the default in the skill text.

## What it costs to change later

B is two schema defaults in `kit/lib/config.ts`, plus `kit/lib/init/labels.ts` (a style for the label, which `omni init` would then create) and the tests that pin the label and limit lists: `kit/lib/config.test.ts`, `kit/lib/schema/config.test.ts`, `kit/lib/init/labels.test.ts`, `kit/bin/init.test.ts`, `kit/bin/update.test.ts`. None is in this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3's wave skill text must read the released label through `omni config`: the plan does not say how it reads it (author).
