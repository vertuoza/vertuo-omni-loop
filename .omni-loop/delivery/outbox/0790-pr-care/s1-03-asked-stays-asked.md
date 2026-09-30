---
id: s1-03-asked-stays-asked
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Once PR care hands a review comment to the PM, what happens when more people reply in that thread?

## The decision, in plain words

The comment stays with the PM: PR care never picks it up again, whatever is said after. A comment PR care fixed or declined becomes the PM's the moment a reviewer answers or reopens it.

## The intro, for fun

Some conversations are above everyone's pay grade.

## The punchline, for fun

Those ones go to the PM and stay there.

## The options, in plain words

A. An asked thread stays with the PM for good, the option built.
B. PR care reads the PM's reply in an asked thread and acts on it in the next round.

## What I had to decide

How a review thread whose last care reply says asked reads when later comments arrive, and whether a reopened thread counts as the reviewer's last word.

## What I did meanwhile

A thread whose last care marker is asked stays asked with nothing to do; a fixed or pushed-back thread with a later non-care comment, or unresolved again, reads as asked and the round posts an asked reply.

## What it costs to change later

A few lines in kit/lib/care/state.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how the PM's own answer in the thread should be carried out (author)
