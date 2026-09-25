---
id: s2-01-empty-product-registers
prd: 28
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Keeping the new decision record where the plan puts it makes the repository's knowledge check fail, because that check expects three product register files to exist alongside it. How should the check be kept green?

## The decision, in plain words

Three placeholder product register files were added, each saying it holds nothing yet, so the knowledge check passes without changing the kit or the repository's settings.

## The options, in plain words

A. A: Placeholder product registers, each saying it holds nothing yet (built).
B. B: Point the decision record folder outside the knowledge folder in this repository's settings and drop the placeholders.
C. C: Teach the knowledge check to skip grading when the laws come from nowhere and the folder holds only decision records.
D. D: Keep the decision record elsewhere, such as beside the PRD, and leave the knowledge folder absent.

## What I had to decide

Whether the knowledge folder should carry placeholder product registers, whether the decision records should live outside it, or whether the knowledge check should skip a folder holding only decision records.

## What I did meanwhile

The knowledge folder holds the decision record plus three placeholder product registers with no principles, rules or invariants; the knowledge check reports zero of each and passes.

## What it costs to change later

Deleting three small files and, if chosen, a one-line settings change or a small kit change with its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice names only the decision record folder, so the three register files sit outside it.
- (author) Whether a later PRD will fill the product registers is not known.
