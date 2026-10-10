---
id: s8-01-waiting-on-you-counts-approvals
prd: 1364
slice: s8
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

On the Products page, what counts as an item waiting on the person reading it?

## The decision, in plain words

Each card counts the product's PRDs that wait on the reader's approval. Open outbox questions are not counted, because the page does not know yet whom each one waits on.

## The intro, for fun

Every card wears a little number, and someone has to decide what it counts.

## The punchline, for fun

For now it counts only the doors that need your key.

## The options, in plain words

A. Count the approval requests waiting on the reader, the option built.
B. Also count the open outbox questions of the PRDs the reader authored.
C. Count everything the Ledger's 'on you' lane shows, once s9 defines it.

## What I had to decide

Which items the per-product 'waiting on you' count adds up.

## What I did meanwhile

Approval requests whose latest request asks the reader with no approval since, of the product's dossiers, read through approval_requests_waiting(); outbox questions and GitHub reviews are left out.

## What it costs to change later

One line in products.service.ts and one more read in products.repository.ts to add another source.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether open outbox questions of the product's PRDs should count as waiting on their author
- (author) whether the Ledger's 'on you' lane (s9) and this count must stay identical
