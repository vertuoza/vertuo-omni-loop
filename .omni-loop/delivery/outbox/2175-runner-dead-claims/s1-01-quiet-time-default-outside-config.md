---
id: s1-01-quiet-time-default-outside-config
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Where should the 240-minute wait before a quiet claim can be taken over live when a repository does not set it?

## The decision, in plain words

The kit applies 240 minutes itself when the setting is left out, so a repository's settings read exactly as before and the setting only shows once someone sets it.

## The intro, for fun

Every setting wants a default, and this one found two places to keep it.

## The punchline, for fun

We picked the one that leaves everyone else's settings untouched.

## The options, in plain words

A. A. The kit applies 240 minutes itself when the setting is left out, as it already does for the hook size limit.
B. B. The settings fill in 240 for every repository, and the two tests that pin the full list of limits are updated.

## What I had to decide

Keep the default in the board (A), or fill it into every parsed config (B) and update the tests that pin the full list of limits.

## What I did meanwhile

A config that leaves `limits.claimDeadMinutes` out reads 240 minutes on the board, the Engineering board and in `omni board`; `omni config limits.claimDeadMinutes` prints nothing until a repository sets it.

## What it costs to change later

B is one line in `kit/lib/config.ts` plus the expected limits in `kit/lib/config.test.ts` and `kit/lib/schema/config.test.ts`, which this slice may not touch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a later skill wants to print the quiet time through `omni config`: none in this PRD does (author).
