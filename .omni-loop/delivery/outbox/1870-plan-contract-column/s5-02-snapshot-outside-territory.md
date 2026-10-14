---
id: s5-02-snapshot-outside-territory
prd: 1870
slice: s5
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

The step was allowed to change the command and its test file only, but the test keeps a saved copy of the command's expected output in a separate file, which had to gain the new line.

## The decision, in plain words

The saved expected output was updated with the one new line, so the existing test stays green; nothing else outside the allowed files was touched.

## The intro, for fun

The test brought a friend to the party, and the guest list only had the test's name.

## The punchline, for fun

We let the friend in; it only wanted to say one line.

## The options, in plain words

A. A. Accept the one-line update to the test's saved expected output
B. B. Rewrite that test as an explicit expectation and leave the saved file alone, with its old entry left unused

## What I had to decide

Accept the one-line change to the saved expected output, or have plans list such saved-output files with their tests from now on.

## What I did meanwhile

The saved output holds exactly the new line and nothing more.

## What it costs to change later

Undoing it means turning that test into an explicit expectation, a few lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan should have named the saved-output file with its test was not checked against earlier plans (author)
