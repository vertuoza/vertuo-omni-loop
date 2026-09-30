---
id: s1-03-help-count-test
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Adding the new business command meant changing a test that counts every command, and that test sits outside this slice's agreed files. Is that fine?

## The decision, in plain words

We raised the expected number of commands by one in that test, and changed nothing else in it.

## The intro, for fun

A new command walked in and the head count was off by one.

## The punchline, for fun

So we counted again, out loud, and wrote down the new number.

## The options, in plain words

A. Raise the count in the help test to 35, the option built.
B. Leave the count as it is and take the business command out of the command list, which the plan does not allow.

## What I had to decide

Whether kit/lib/help/entries.test.mjs may move its command count from 34 to 35, outside s1's territory.

## What I did meanwhile

The count reads 35 in both of its assertions; the test's other checks are untouched.

## What it costs to change later

Two numbers in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for s1 lists kit/lib/help/entries.mjs but not its test (author)
