---
id: s5-02-tests-outside-territory
prd: 413
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Teaching two commands about the new link changed what two existing tests expect. Should this part of the work update those tests itself, though they sit outside its planned ground?

## The decision, in plain words

Yes. It updated the status skill's test to allow the link lookup, and added the link to the built-in help with its test, as the earlier adopted decision asked, and changed nothing else there.

## The intro, for fun

Two old tests noticed the new link and raised a hand.

## The punchline, for fun

We answered them in the same breath.

## The options, in plain words

A. A. This slice updates the help text and the test its change breaks (built).
B. B. Leave them for a follow-up slice that owns those files.

## What I had to decide

Whether this slice may change the help text and the status skill's test, which belong to no slice of this PRD.

## What I did meanwhile

The help lists the link verb, the status skill's test allows it, and the full run is green apart from the one failure that already exists on the default branch.

## What it costs to change later

Reverting is two small edits; no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the help skill and the skills folder, not the help text file or the plugin's shared test, so whether they were meant to be covered is not written down.
