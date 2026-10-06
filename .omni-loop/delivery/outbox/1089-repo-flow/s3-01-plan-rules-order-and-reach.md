---
id: s3-01-plan-rules-order-and-reach
prd: 1089
slice: s3
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

When a part of the code must come first, or must be waited for by everything else, how does the plan check read 'first' across landings, and which slices does it apply the rules to?

## The decision, in plain words

A part that comes first must sit strictly before every other slice, a later landing counting as after; a slice in a later landing already waits for it; the file limit counts the paths a slice lists; and in a plan spanning several repositories, every row is checked against this repository's own rules until a later slice reads each target's.

## The intro, for fun

Being first sounds simple until two slices both stand in wave one.

## The punchline, for fun

Sharing the front of the queue counts as cutting in line.

## The options, in plain words

A. A. Keep it: strictly before, landing then wave; a later landing satisfies blocks all; the limit counts listed paths; every row meets this repository's flow for now.
B. B. Let a first part share its wave with the rest, only refusing a slice outside it in an earlier wave.
C. C. Compare waves only within one landing, ignoring the landing order for wave first and blocks all.

## What I had to decide

Whether a part that must come first may share its wave with others, and whether landings count in that order.

## What I did meanwhile

Built the plan rules that way in the plan check, with a test for each rule and its green counterpart, the spec's kernel and migrations example included.

## What it costs to change later

A constant change in the plan rules module and its tests: letting a first part share its wave, ignoring landings, or skipping target rows is a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the area's slices sit in a wave before every other slice, but not whether a shared wave is allowed, nor how landings order them.
- (author) Whether the file limit should count files rather than the path prefixes a territory lists: a plan names prefixes, so the check counts those.
- (author) Target rows of a plan repository's plan meet the plan repository's own areas until the slice that reads each target's flow lands.
