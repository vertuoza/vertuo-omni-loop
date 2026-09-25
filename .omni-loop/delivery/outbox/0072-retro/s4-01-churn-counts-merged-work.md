---
id: s4-01-churn-counts-merged-work
prd: 72
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the retro adds up the lines written across every change and compares them with what stayed in the end, but not which changes count, nor whether the first writing of some lines counts as one of the three times they were rewritten. How should they be counted?

## The decision, in plain words

The retro counts the changes of every piece of work merged into the feature, in the order it was merged, and leaves out work that was never merged. Some lines count as rewritten again and again when three changes wrote them, the first writing included; lines only added beside them do not rewrite them.

## The intro, for fun

Counting how often code was rewritten starts with a harder question: which drafts count as drafts?

## The punchline, for fun

Only the ones that made it to the fridge door, and the very first draft counts too.

## The options, in plain words

A. Merged work only, in the order it was merged, the first writing counted among the three, the option built.
B. The same, counting only the rewrites after the first writing, so some lines need four changes in all.
C. Also count work that was never merged, since that code was written and thrown away too.

## What I had to decide

Which commits `kinds/churn.mjs` reads and in which order, what "the final diff" is, and whether "a range rewritten in 3 or more commits" (`THRESHOLDS.churnRangeCommits`) counts the commit that first wrote it. The spec ("The facts, and what makes a finding") says churn counts "per file, lines added across all commits minus lines added in the final diff; per line range, the commits that rewrote it, line numbers followed through each commit's hunks"; its units table says `gather` reads "sub-PRs, their commits with patches". Neither names the commits, their order or the first write.

## What I did meanwhile

`gather` reads the commits of every pull request merged into the feature branch (the sub-PRs, and a rework or settle PR into it), skips a commit with two parents (a merge of the feature branch into a slice branch, whose diff repeats merged work), and never reads a pull request that was not merged, which the section names as not counted. The final diff is the feature PR's own files. `detect` walks the pull requests by merge time and each one's commits as GitHub lists them. Each line keeps every commit that wrote it, the first included; a block that replaces lines passes their commits on; a line only inserted carries its own commit. Commits made on the feature branch itself (a wave's adoption, the ship) are not read.

## What it costs to change later

A filter and a comparison in `kinds/churn.mjs`, and the fixture's expectations: counting only the rewrites after the first write is `churnRangeCommits` read as one more; counting work never merged is one filter. Retros already merged keep the counts they were made with.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether "rewritten in 3 or more commits" meant three rewrites after the first write, or three commits in all.
- (author) Two slices of one wave changing the same file are walked one after the other, as merged, though each was written against the file before the other merged; line numbers in such a file are approximate.
