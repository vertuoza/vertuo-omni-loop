---
id: s3-02-drifted-title-wording
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The spec's table and its acceptance criteria word the red check's line two ways: the table ends it with 'or approve again', the criteria say it ends with the restore command. Which wording should the line carry?

## The decision, in plain words

The red check's line follows the spec's table word for word: it names the changed file, then says to run the restore command, or approve again.

## The intro, for fun

Two parts of the same spec described the same red line slightly differently.

## The punchline, for fun

The table won the coin toss, and the command is still right there in the line.

## The options, in plain words

A. A. The spec table's wording: '… · run omni approval restore <n>, or approve again'.
B. B. End with the command: '… · approve again, or run omni approval restore <n>'.

## What I had to decide

Keep the table's wording, or end the title with the restore command.

## What I did meanwhile

The failure title reads '≠ <file> · content · run omni approval restore <n>, or approve again'; the summary starts with the command.

## What it costs to change later

One constant in apps/omni-app/src/approved-check/verdict.ts and two test strings.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The two wordings in the spec were not reconciled by a person; the pick is the author's.
