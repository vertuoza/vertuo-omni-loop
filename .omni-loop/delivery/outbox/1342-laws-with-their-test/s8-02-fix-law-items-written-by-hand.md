---
id: s8-02-fix-law-items-written-by-hand
prd: 1342
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 4
---

## The question, in plain words

When a bug fix or a visual fix changes a rule that has a test, it must leave a question for a person, but the tool that writes such questions only works for a planned feature. How should the fix write it?

## The decision, in plain words

The fix writes each question itself, following the same layout every question uses, and the existing fix check confirms it is complete before the pull request opens.

## The intro, for fun

The question-printing machine only takes feature tickets, and a fix showed up with a bug ticket.

## The punchline, for fun

So the fix writes its question by hand, in its neatest handwriting.

## The options, in plain words

A. A. Write the item by hand from the template in each fix skill (built).
B. B. Teach omni item new to write into a fix's folder, then have the skills call it.
C. C. Keep the template and add a check command that validates a fix's items before the push.

## What I had to decide

Whether the fix skills write a law item by hand in the fix's outbox, or wait for omni item new to learn a fix's folder (kit/bin/commands/item.ts, outside this slice).

## What I did meanwhile

Both fix skills carry the item's full template and the account's, ids s1-<k>-<slug>, slice s1, rank high, bears-on the law id; omni bug and omni visual grade the folder before the PR opens, and the server check grades it on the PR.

## What it costs to change later

A constant: a later slice teaches omni item new a --fix <folder> form and the two skill sections call it instead of the template.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the fix skills raise the items but not with which tool; omni item new refuses a number with no PRD folder.
