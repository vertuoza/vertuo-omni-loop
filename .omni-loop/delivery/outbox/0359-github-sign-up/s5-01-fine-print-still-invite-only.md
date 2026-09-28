---
id: s5-01-fine-print-still-invite-only
prd: 359
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The front page's order form still says Omni Loop is invite-only while in beta, but the sign-up button now lets anyone with GitHub in. Should the fine print change?

## The decision, in plain words

The fine print was left as it is: the spec asks only for the button to work, and nobody has said what the new line should be.

## The intro, for fun

The door now opens for anyone, and the sign beside it still says members only.

## The punchline, for fun

The sign stays until someone picks the new words.

## The options, in plain words

A. A: keep 'Invite-only while in beta.' (built)
B. B: drop the invite-only clause, keeping 'Omni Loop runs on Claude Code.'
C. C: replace it with a line about installing Omni Loop on your GitHub org

## What I had to decide

Whether to change the order form's fine print, which says invite-only, now that sign-up is open.

## What I did meanwhile

Kept 'Omni Loop runs on Claude Code. Invite-only while in beta.' under the enabled button in apps/galaxy/src/home/spreads/OrderForm.tsx; its test still pins that line.

## What it costs to change later

A constant: one sentence and the test line that pins it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the plan do not mention the fine print; whether the beta is still meant to feel invite-only is a product call
