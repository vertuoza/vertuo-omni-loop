---
id: s3-01-roadmap-status-words
prd: 2011
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

The spec says a product roadmap reads building, held or drifted as a PRD does, but a PRD's page has no such three words. Which words does the roadmap's page show?

## The decision, in plain words

The roadmap page shows its approval as a PRD does (waiting for approval, approved, drifted, voided) and, beside it, one status word: held until it is approved, building once approved with a PRD under way, drifted once its approval no longer holds, approved otherwise.

## The intro, for fun

Three words were promised, and the dictionary had only the idea of them.

## The punchline, for fun

Held, building, drifted: now they mean something.

## The options, in plain words

A. A. Status word derived from the approval and the PRDs' states, shown beside the approval's words (as built)
B. B. Approval's own words only, with no status word
C. C. A status word kept on the roadmap by the loop's ticks

## What I had to decide

Read held as not approved, building as approved with a PRD of it under way, and drifted as a drifted or voided approval.

## What I did meanwhile

The status word is one small function with its own tests, shown beside the approval's own words, so changing it touches nothing else.

## What it costs to change later

One function and its tests, and a line of the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the three words but not their meaning.
