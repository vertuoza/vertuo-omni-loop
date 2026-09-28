---
id: s4-02-retro-reads-less-than-the-harvest
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

To give the judge the knowledge base and the earlier lessons, should the retro copy the whole delivery folder at the merge, as the knowledge harvest does, or only what it needs?

## The decision, in plain words

It copies only the settings and the knowledge folder, and reads the earlier retro records one by one from a single listing of the shipped folder. The delivery folder is several megabytes and hundreds of files that the judge never reads.

## The intro, for fun

Asked for last year's lessons, the retro was about to carry the whole library home.

## The punchline, for fun

It took the index and one shelf instead.

## The options, in plain words

A. Copy only the settings and the knowledge folder, and read each earlier retro record from one listing; the option built.
B. Copy every loop folder as the harvest does, and read the records from that copy.

## What I had to decide

The spec says the new step reads the knowledge folder and the shipped retro.json files "through the harvest's tree reader", which snapshots every loop folder, the delivery folder included (about 250 files and 5 MB on this repository at PRD 438's merge).

## What I did meanwhile

`gatherKnowledge` calls the harvest's `withTreeAt` with the config's delivery, playbook and glossary paths set to null, so only the config and the knowledge folders are snapshotted, and builds the summary with the kit's `knowledgeSummary`. The retro.json files are found with one recursive tree listing of the shipped folder and read blob by blob.

## What it costs to change later

A constant: passing the config unchanged to the tree reader and reading the files from its snapshot instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the spec's wording meant the whole snapshot or only the reader: it gives no size budget for the step.
