---
id: s1-01-update-test-knows-concept-label
prd: 686
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new concept label made an older test of the kit's update step expect one more label, and the plan had not given this slice that test. Was it right to add the label to that test's list?

## The decision, in plain words

We added the new label to the list of labels that test pretends a repository already has, and changed nothing else in it.

## The intro, for fun

A new label walked in, and an old test counted the chairs again.

## The punchline, for fun

One more chair, same table, nobody had to move.

## The options, in plain words

A. Add the new label to that test's fixture list, the option built.
B. Leave that test alone and let the update step's report say one label was created, changing its expected output instead.
C. Make that test read the label list from the kit's own label table, so a new label never needs a test edit again.

## What I had to decide

Whether s1 may touch `kit/bin/update.test.mjs`, outside its territory, to keep the suite green once `labels.concept` exists.

## What I did meanwhile

Its `LOOP_LABELS` fixture gains `'omni:concept'`, so its fake `gh label list` still holds every loop label and `omni update --apply` still reports `labels   ok`. No assertion changed.

## What it costs to change later

One string in one test fixture; undone by removing it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for s1 lists `kit/bin/init.test.mjs` but not `kit/bin/update.test.mjs`, which holds its own copy of the loop label list (author)
