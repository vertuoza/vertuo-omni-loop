---
id: e2e-s1-01-home-title-test-level
prd: 1954
slice: e2e-s1
rank: medium
bears-on: none
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new browser test checks that the arcade home page shows the title OMNI LOOP. Should its failure count as breaking a critical flow, or is it an ordinary check?

## The decision, in plain words

The test was written as an ordinary (standard) check, because nobody could be asked while the PRD was being built.

## The intro, for fun

A test walks into the arcade and asks how serious it is.

## The punchline, for fun

Pick a letter and its badge is settled.

## The options, in plain words

A. A. Standard, as written: the test keeps its prd-1954 tag and no critical tag.
B. B. Critical: the test is tagged critical and flow-arcade-landing, so its failure breaks the flow arcade-landing.

## What I had to decide

Does this test cover the flow arcade-landing (a visitor reaches the arcade and sees what it is), and does its failure break that flow? Recommended: A, standard, since the check only reads the page title.

## What I did meanwhile

The test stays standard, with only the tag prd-1954 and no critical tag.

## What it costs to change later

Changing it later means editing the tags of the test file `e2e/tests/arcade-home-title.e2e.ts`: adding `critical` and `flow-arcade-landing` (option B), or removing them again. Nothing else moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which flow of the first drafted list this test covers, and whether its failure breaks it (author)
