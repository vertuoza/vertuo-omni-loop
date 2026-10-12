---
id: s2-02-how-a-raise-is-matched
prd: 1679
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

When a person says yes to a bigger budget, the check has to tell which budget and which new size the yes was for. How should the question carry that, and what counts as a yes?

## The decision, in plain words

A raise question carries one fixed line naming the budget and its new size, and only an answer that agrees with the question counts as a yes. A first budget set where none existed before needs no yes.

## The intro, for fun

A yes is only useful when everyone knows what it was a yes to.

## The punchline, for fun

So the question now spells out the exact number it asks for.

## The options, in plain words

A. A. One fixed line in the question names the budget and the size, and only an agreeing answer counts (built).
B. B. The question's short name carries the budget and the size, which leaves no room for a long budget name.
C. C. Any answered question of the PRD about budgets counts, whatever size it named.

## What I had to decide

How ratchet matches a settled raise item to a target and a ceiling, which PRD a branch's raises are read from, and what counts as raised against the base. The spec says the item names the target and the new ceiling, not in what form.

## What I did meanwhile

A raise item carries the line `Budget raise: `<target>` to <bytes> bytes` (raiseLine in kit/lib/budgets/ratchet.ts, matched case-insensitively anywhere in the item); only a settled entry whose verdict is agreed counts, never adopted or drifted. omni check context reads the PRD from --prd, else from the branch name (prdOfBranch). A base with no ceilings file is an install, so its first ceilings raise nothing (D8); a target with no ceiling at the base or the head is green; removing a ceiling the base had needs a yes no item can give.

## What it costs to change later

A constant: the raise line's wording is one regex and one function; ceilings already merged never need to be matched again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a removed ceiling should be red with no way to answer it, or green: the spec's table does not name it.
