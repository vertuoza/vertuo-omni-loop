---
id: s1-01-agents-tests-beside-a-rule-proof
prd: 1890
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new checks for the setting that lists which coding agents a team uses were added to the test file that also proves the config refuses a bad signature. Is it fine that this file now carries more than that proof?

## The decision, in plain words

Yes: the signature rule and its checks are untouched. The file only gained checks that the new setting is read, defaults to Claude alone and refuses an unknown or repeated agent, and its list of settings names the new one.

## The intro, for fun

One test file guards how the loop signs its work, and now it also counts the agents.

## The punchline, for fun

Same guard, one more name on the clipboard.

## The options, in plain words

A. Keep the agents checks in the config's test file, beside the signature rule's proof (built).
B. Move the agents checks to a test file of their own, so only the list of settings changes in the proof file.

## What I had to decide

Whether the checks of the agents setting stay beside the signature rule's proof or move to a file of their own.

Decided by: Jev (hardToRevert 0.80) · agent said true

## What I did meanwhile

Kept the checks in the config's test file, beside the existing checks of every other setting, as PRD 1804 did for its setup command.

## What it costs to change later

Moving the checks to their own file later is a cut and paste of two tests; the list of settings in the proof file changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the person who answers prefers each new setting's checks in a file of their own; PRD 1804 kept them beside the proof and was agreed.
