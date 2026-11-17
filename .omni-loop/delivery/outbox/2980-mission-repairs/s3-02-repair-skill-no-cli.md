---
id: s3-02-repair-skill-no-cli
prd: 2980
slice: s3
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

The repair skill cannot call a kit command to compute a cause's fingerprint or to scrub its public report, because none exists. Is that acceptable for now?

## The decision, in plain words

The skill has the runner compute the fingerprint and write the report by hand, and the App computes and scrubs again, so a mistake never reaches the public repository. For a PRD that spans repositories, the skill follows the multi-repository bug fix, which takes no base branch yet.

## The intro, for fun

The recipe is written down, but nobody built the kitchen gadget yet.

## The punchline, for fun

For now the cook does the sums by hand.

## The options, in plain words

A. A. The skill works by hand and the App checks again, as built.
B. B. A later slice adds the omni repair commands and the base branch for the multi-repository bug fix.

## What I had to decide

Whether to add omni repair commands (retro check, fingerprint, scrub) and a base branch to the multi-repository bug fix in a later slice.

## What I did meanwhile

The skill describes each step in words and relies on the App's second computation and second scrub, so nothing unsafe is sent.

## What it costs to change later

A later slice adds the commands and the skill swaps its words for them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives this slice the skill folder and the bug fix only, not the command table or the multi-repository bug fix.
