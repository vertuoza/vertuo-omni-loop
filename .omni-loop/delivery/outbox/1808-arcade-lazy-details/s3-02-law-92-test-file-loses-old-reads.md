---
id: s3-02-law-92-test-file-loses-old-reads
prd: 1808
slice: s3
rank: high
bears-on: BR-PRODUCT-92
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The file that proves the dashboard counts only PRDs and fixes also held the checks of the old read of every planet's dossier at once, which the game no longer uses. Is it right that those old checks left the file with the read they tested, while the dashboard rule's own checks stay as they were?

## The decision, in plain words

The old read of every planet's dossier is gone, and its checks with it. The dashboard rule's checks and the demo dossiers' checks in that file are unchanged and pass.

## The intro, for fun

Spring cleaning in the dossier drawer: one old tool out, the rule's tools untouched.

## The punchline, for fun

Nothing the dashboard counts on was thrown away.

## The options, in plain words

A. A. Remove the old read's checks with the read, the rule's checks unchanged (as built)
B. B. Also add a check that the old read no longer exists

## What I had to decide

Whether removing the old read's checks from the rule's proof file is fine, as built, or whether that file should keep a check that the old read stays gone.
Decided by: Jev (hardToRevert 0.48) · agent said true

## What I did meanwhile

The dashboard rule's checks run as before and pass; the game reads one planet's dossier at a time when it is opened, through the read the planet's page already proves.

## What it costs to change later

Adding a check back is a test-only change of a few lines; bringing the old read back would undo the faster first load.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan asks for the old read to be gone but does not say what its proof file keeps.
