---
id: s2-03-how-a-repair-ends
prd: 2980
slice: s2
rank: medium
bears-on: none
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The spec names a repair ending fixed or not fixed, and says a lost repair spends nothing. How does a repair end when it stops the work instead, or when its runner is lost for good?

## The decision, in plain words

A repair ends one of four ways: fixed, not fixed, stopped (it handed the work to a person or reported an Omni Loop bug) or lost. A lost one gives its turn back, so the next repair of the same cause takes its place; the other three count against the three and the nine.

## The intro, for fun

Every repair gets a last line, even the ones that wandered off mid-sentence.

## The punchline, for fun

And the one that wandered off does not count against anybody.

## The options, in plain words

A. A. Four endings, where a lost repair spends nothing and a stopped one spends one: the option built.
B. B. A stopped repair spends nothing either, like a lost one.
C. C. Only the spec's two endings; a lost repair's row is deleted instead.

## What I had to decide

Whether stopped and lost are the right two words beside the spec's fixed and not fixed, and whether a stopped repair should count against the budget.

## What I did meanwhile

mission_repairs.outcome takes fixed, not fixed, stopped or lost, null while it runs; the database dates its end, and once set nothing of the row changes. The budget counts every repair but the lost ones, and a lost one's number is free again.

## What it costs to change later

A constant: the outcome's check and the budget trigger's one condition, changed in a small migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec does not say whether a person or omni-loop repair, which ends the PRD, spends one of the three
