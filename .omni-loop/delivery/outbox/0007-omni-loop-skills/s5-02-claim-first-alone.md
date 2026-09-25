---
id: s5-02-claim-first-alone
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a person runs the slice builder by hand, should it first put up a draft pull request to show the slice is taken?

## The decision, in plain words

Yes: running alone, it opens the draft claim before building, so the rule that every slice is claimed first holds however the slice is started.

## The options, in plain words

A. Open the draft claim first when running alone, the option built.
B. Never claim from do-work; the claim is only ever the wave's job.
C. Claim only when the person asks for it.

## What I had to decide

Whether do-work, run alone, opens the draft sub-PR (the claim) through /omni:pr before building. Upstream left the claim to the wave; the spec's rule 6 says claim first for every skill.

## What I did meanwhile

Built it: step 1 of do-work opens the draft claim through /omni:pr when running alone and none exists; under --in-wave the wave has already claimed.

## What it costs to change later

One sentence in the skill; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a hand run is ever meant to stay private until pushed (author).
