---
id: s3-01-relay-refuses-taken-id
prd: 563
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

When a question written in another repository is brought home and one with the same name is already waiting there, should the new one be renamed or turned away?

## The decision, in plain words

It is turned away and left where it was, with the reason printed, so nothing already waiting is overwritten and nothing is silently renamed.

## The intro, for fun

Two questions, one name, one inbox: someone has to wait outside.

## The punchline, for fun

The newcomer waits, politely, with a note explaining why.

## The options, in plain words

A. Refuse the item and leave it in the folder with its reason, the option built.
B. Renumber it to the next free number and move it.
C. Overwrite the item already in the outbox.

## What I had to decide

What the relay does with an item whose id is already taken in the plan repository's outbox (an open file, or an id the settled ledger carries).

## What I did meanwhile

The relay refuses it: the file stays in the scratch folder, is named on stderr with the reason, and the exit is 2 while the other files still move. It never overwrites and never renumbers. Ids should not collide in practice, since item new --out already counts the outbox's spent ids.

## What it costs to change later

One branch in the relay module: renumbering instead would be a small change there plus rewriting the item's id line, and any account naming the old id.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether two slices of one wave, raising items in separate scratch folders at the same time, can ever pick the same number; they carry different slice ids, so they should not.
