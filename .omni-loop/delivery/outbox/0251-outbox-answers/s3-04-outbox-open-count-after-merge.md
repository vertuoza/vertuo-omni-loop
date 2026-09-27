---
id: s3-04-outbox-open-count-after-merge
prd: 251
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Once a plan's pull request is merged or closed, should the list of plans still show how many of its questions were open?

## The decision, in plain words

No: a merged or closed plan shows no open questions, because whatever was still open was adopted when it merged.

## The intro, for fun

A shipped plan with a question badge looks like homework handed in late.

## The punchline, for fun

The badge retires the day the plan does.

## The options, in plain words

A. Show no open questions once merged or closed (as built).
B. Keep counting what was open at the last check, whatever the state.

## What I had to decide

The spec says the list's open count is the number of open items in the dossier's outbox, 0 when it has none. The last send of a merged pull request still lists the items that were open just before the merge.

## What I did meanwhile

dossier_list() counts the stored outbox's open items only while its state is open, and 0 once it is merged or closed.

## What it costs to change later

One condition in dossier_list(): a follow-up migration replaces the function. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether someone wants closed-but-unmerged plans to keep showing their open questions.
