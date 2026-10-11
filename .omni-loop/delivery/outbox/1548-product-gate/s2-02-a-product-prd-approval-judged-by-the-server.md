---
id: s2-02-a-product-prd-approval-judged-by-the-server
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

A PRD that lives only on its product has no files in any checkout to compare with what was approved. When does its approval stop counting, as the terminal reads it?

## The decision, in plain words

The moment someone saves a changed version of an approved file, which the server already records. Nothing on anyone's computer is compared.

## The intro, for fun

An approval with no folder to check is like a receipt with no shopping bag.

## The punchline, for fun

So we asked the shop's own till, which never forgets a change.

## The options, in plain words

A. A. Judge by the server's voids, read from the approval route (built)
B. B. Also compare each pinned file with the latest version the get call returns

## What I had to decide

Confirm that omni prd mobile-12 judges a product PRD's approval by the server's voids alone (pending, drifted on a void, refused when the approver left, else approved), read from GET /api/dossiers/approval?prd=mobile-12, with its title, page and product read from GET /api/dossiers?product=&prd=.

## What I did meanwhile

kit/lib/approval/approval.ts gained judgeProductApproval and readProductApproval, sharing one judgment with the tree's, and productPrdState maps it to the stage as a ◆ PRD's inbox stage is mapped. The kit client calls the approval route with prd=<key>-<n> and the repository it runs from, as s3 taught that route. omni approval and omni wait approval still name a PRD by its number only.

## What it costs to change later

Comparing pinned hashes with the latest versions as well is one get call per pinned kind; the judgment's shape stays.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Every change to a product PRD's files goes through dossier_push, which voids on a changed pinned hash, so a void is the only drift a product PRD can have.
- (author) omni approval and omni wait approval on a product PRD are not in this slice's done-when; s12 is their first caller.
