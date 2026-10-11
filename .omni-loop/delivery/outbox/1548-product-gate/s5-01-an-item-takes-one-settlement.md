---
id: s5-01-an-item-takes-one-settlement
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Once a question of a product PRD has an answer, or was adopted when it was raised, can anyone record a second answer for it later, for instance to object to an adoption?

## The decision, in plain words

A question takes one answer and the server refuses any second one, as the spec asks; an objection to an adopted question has no place on the server yet.

## The intro, for fun

Every question gets one answer, and the server writes it in pen.

## The punchline, for fun

Second thoughts will need a fresh page we have not printed yet.

## The options, in plain words

A. A. One settlement per item, refused in the RPCs (built).
B. B. Let a drifted objection follow an adoption, and nothing else.
C. C. Let any later answer append, the latest one in force, as the git ledger reads.

## What I had to decide

Confirm that outbox_settle() and outbox_item_adopt() refuse an item that already has a settlement, even though the git ledger lets an objection append a drifted entry after an adoption.

## What I did meanwhile

The settlements table holds no uniqueness constraint: the refusal lives in the two RPCs, under the item's row lock, so allowing a later objection is a change to a function body, not to stored data. supabase/checks/outbox_items.sql proves a second settle is refused for an agreed and for an adopted item.

## What it costs to change later

Allowing an objection after an adoption is one condition in outbox_settle() and its check; no migration of rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Acceptance 9 says an item already settled cannot be settled again; the git outbox lets an objection append a drifted entry for an adopted item, and the spec does not say whether a product PRD keeps that path.
