---
id: s2-02-a-product-prd-approval-read-with-its-page
prd: 1548
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

A PRD that lives only on its product has no files in any checkout to compare with what was approved. Where does the terminal read its approval, and when is that approval no longer good?

## The decision, in plain words

The terminal reads it in the same call that finds the PRD's page, and the approval stops counting the moment someone saves a changed version of an approved file, which the server already records. Nothing on anyone's computer is compared.

## The intro, for fun

An approval with no folder to check is like a receipt with no shopping bag.

## The punchline, for fun

So we asked the shop's own till, which never forgets a change.

## The options, in plain words

A. A. Read the approval with the PRD's page, judged by the server's voids (built)
B. B. Read it from the approval route once it takes a product, and drop it from the page lookup
C. C. Also compare each pinned file with the latest version the get call returns

## What I had to decide

Confirm that omni prd mobile-12 reads the approval in force from GET /api/dossiers?product=&prd= (one call with the page, title and product) and judges it by the server's voids alone, rather than through GET /api/dossiers/approval, which does not take a product yet.

## What I did meanwhile

The dossier lookup answers approval in the approval route's shape (times in ISO 8601, a file's text only when kept), found with dossier_approval(p_product). kit/lib/approval/approval.ts gained judgeProductApproval and readProductApproval, sharing one judgment with the tree's: pending, drifted on a void, refused when the approver left, else approved. productPrdState maps it to the stage as a ◆ PRD's inbox stage is mapped. omni approval and omni wait approval still name a PRD by its number only.

## What it costs to change later

Switching to the approval route once it takes a product is one call in the prd command; the judgment stays.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The approval route (apps/galaxy/app/api/dossiers/approval/) is s3's territory and runs in parallel, so this slice could not teach it the product key; s3 or s12 should, for omni approval and omni wait approval on a product PRD.
- (author) Every change to a product PRD's files goes through dossier_push, which voids on a changed pinned hash, so a void is the only drift a product PRD can have.
