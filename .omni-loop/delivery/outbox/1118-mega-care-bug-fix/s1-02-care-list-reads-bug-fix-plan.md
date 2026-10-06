---
id: s1-02-care-list-reads-bug-fix-plan
prd: 1118
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

How does the list of pull requests find a bug's fixes and its record, and does it list a repository whose pull request is not opened yet?

## The decision, in plain words

Each row of the bug's fix-plan table counts once, in its order, and the record is the pull request that will close the bug; a repository with no pull request yet is left off the list until one opens.

## The intro, for fun

The bug-fix skill that writes the fix plan is built later, so the list had to guess its handwriting.

## The punchline, for fun

Reading a letter before it is written takes some optimism.

## The options, in plain words

A. Any reference in each table row, in order; the record from GitHub's closing links; repositories without a pull request left out.
B. A fixed column layout for the fix plan, refused otherwise.
C. List a repository without a pull request as missing.

## What I had to decide

Whether the fix-plan table and the closing link are the right places to read a bug's pull requests, and whether a repository with no pull request yet belongs on the list.

## What I did meanwhile

Rows read by any pull request reference or link in table order; records read from the pull requests GitHub links as closing the issue; no pull request yet means not listed.

## What it costs to change later

One parser and one read in the care list: the bug-fix skill can match them, or they change with their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec fixes the fix-plan marker but not the table's columns, and does not say how the record pull request is found (author).
