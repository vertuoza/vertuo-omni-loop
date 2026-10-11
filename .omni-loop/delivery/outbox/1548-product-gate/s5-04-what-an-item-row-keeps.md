---
id: s5-04-what-an-item-row-keeps
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Besides the question's text, what does the server keep about each question of a product PRD, and about each answer?

## The decision, in plain words

Each question keeps its name, its slice, its rank, what it bears on, when and in which wave it was raised, and the repository it came from. Each answer keeps its verdict, why, the words given, where and by whom, and who a question is for is read from its rank.

## The intro, for fun

A filing cabinet is only as good as the labels on its drawers.

## The punchline, for fun

We labelled seven drawers and left the rest in the folder itself.

## The options, in plain words

A. A. Front matter as columns, the repository, and the body as written (built).
B. B. Also store who the item is for as its own column.
C. C. Store only the body and parse it on every read.

## What I had to decide

Confirm the typed columns: outbox_items (item, slice, rank, bears_on, raised, wave, repository, body, raised_by) and outbox_settlements (verdict, basis, answer, channel questions or terminal, settled_by, settler_login), with no column for who an item is for.

## What I did meanwhile

The typed columns copy the item's front matter as the kit's one parser reads it; the body keeps the markdown as written, so the plain-words sections and the options stay in it. An adoption carries no answer and no channel, and settled_by is whoever raised it. The Questions tab (s9) can read who an item is for from its rank.

## What it costs to change later

A new column later is an additive migration; renaming or dropping one before any product PRD exists is a follow-up migration with no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the PRD, the repository and who it is for on the Questions tab, but not which of them the rows store; the git ledger's 'Approved by' is a login string, here it is the caller's account.
