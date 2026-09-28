---
id: s2-01-outbox-item-id-joins-dossier
prd: 499
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

Two different PRDs can hold outbox questions with the same short name. What name should the waiting list give each one so it is never mixed up with another?

## The decision, in plain words

Each waiting outbox question is named by its PRD's page plus its own short name, so two PRDs never share a name and an alert fires once per question.

## The intro, for fun

Two PRDs walk into a bell, both wearing a name tag that says s1-01.

## The punchline, for fun

Now every tag also says which PRD it came from.

## The options, in plain words

A. Join the dossier id and the item id, so every id is unique across PRDs (built).
B. Answer the item's own id, and let the waiting list build a unique key from it and the dossier id.

## What I had to decide

Whether the waiting list names an outbox question by its PRD's page and its own name together, or by its own name alone.

## What I did meanwhile

The route answers each item's id as the dossier id and the item id joined by a colon; the dossier id and the PRD number are also given on their own.

## What it costs to change later

Changing it is one line in the route and its tests; nothing is stored, and the alerts slice only compares ids it has seen in the same browser session.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists the field id without saying whose id it is (author).
- The route also counts a PRD whose feature PR could not be read as unread, beside a failed summary or outbox, since it cannot say whether anything waits (author).
