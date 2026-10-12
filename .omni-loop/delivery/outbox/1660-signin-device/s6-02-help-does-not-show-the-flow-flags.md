---
id: s6-02-help-does-not-show-the-flow-flags
prd: 1660
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The built-in help still shows signing in and making a token without the two new switches that force the browser on this machine or the printed link. Who adds them, and when?

## The decision, in plain words

Left as it is in this piece of work, because the help text lives outside it. The commands themselves and the kit's guide name both switches, so only the help screen lags.

## The intro, for fun

Two new switches arrived, and the help screen did not get the memo.

## The punchline, for fun

The commands know them; the manual will catch up.

## The options, in plain words

A. A. Leave the help screen for a follow-up
B. B. Add both switches to the help screen before shipping

## What I had to decide

Leave the help screen for a follow-up (A), or add both switches to it before this feature ships (B). Decided by: Jev (hardToRevert 0.66) · agent said false

## What I did meanwhile

Built as A: omni signin and omni setup-token take --device and --loopback and say so in their usage lines, and the kit README's sign-in paragraph names both; the help entries are unchanged.

## What it costs to change later

B is two usage lines and a sentence each in the help entries, at any time: nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) kit/lib/help/entries.ts is outside every slice's territory in this plan, so no slice could change it.
