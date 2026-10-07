---
id: s3-01-plan-kept-in-checkout
prd: 1139
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Where does the loop keep its plan between rounds, and what happens when a round starts and no plan was made yet?

## The decision, in plain words

The plan is kept on the computer running the loop, every version of it. A round that finds no plan makes the first version itself, and naming exactly the plan's PRDs follows the plan too.

## The intro, for fun

A plan nobody can find is just a nice thought.

## The punchline, for fun

So it lives right next to the loop, versions and all.

## The options, in plain words

A. A. One local file per checkout with every version; a round with no plan makes version 1; numbers equal to the plan's PRDs follow it.
B. B. The same file, but a round with no plan refuses and asks for the plan to be made first.
C. C. Keep the plan only in the Omni app, read back on each round.

## What I had to decide

Where the frozen plan lives so each later round reads it, whether a round may make the first version on its own, and whether naming PRDs follows the kept plan or asks for one answer per PRD.

## What I did meanwhile

Every version of the plan is kept in one file in the checkout's local folder, ignored by version control, beside the other local state. Making a plan starts the file over at version 1. A round with no number and no kept plan makes version 1 from your PRDs. Numbers that are exactly the kept plan's PRDs follow it; any other numbers get one answer per PRD, as before.

## What it costs to change later

Small: one file path and two conditions in the command. The loop push slice reads the same file; moving it later means changing both readers, with nothing stored anywhere else.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the plan is saved as version 1 and kept under the local folder, but does not name the file or say which slice writes it; the loop push slice also keeps the loop's id there.
- (author) Whether a loop on one computer should resume a plan made on another is not said; the file is per checkout.
