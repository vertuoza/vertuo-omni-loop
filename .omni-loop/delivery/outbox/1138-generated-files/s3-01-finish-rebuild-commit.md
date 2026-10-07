---
id: s3-01-finish-rebuild-commit
prd: 1138
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When the final check of a whole feature rebuilds the built files, what should its commit be called, and against what does it decide which ones are out of date?

## The decision, in plain words

The final check compares the feature with the main line it joins, rebuilds whatever that shows out of date, and commits it alone under a name that says it is the finish of the PRD, like the wave's own rebuild commit.

## The intro, for fun

Every feature gets one last tidy-up before it goes out the door.

## The punchline, for fun

Even the tidy-up needs a name tag.

## The options, in plain words

A. Name it the finish's rebuild of the PRD, compared with the main line it joins.
B. Reuse the wave's name with the last wave's number, compared with the feature before the merge.
C. Fold the rebuilt files into the merge commit, with no commit of their own.

## What I had to decide

Whether the finish's rebuild commit is named for the finish of the PRD, and compares against the main line rather than the feature's last state.

## What I did meanwhile

The finish rebuilds against the main line and commits as a finish rebuild of the PRD.

## What it costs to change later

A wording change in one skill step and its test: a constant.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the finish does the same as the wave but names no commit for it (author).
