---
screen: bug-record
status: draft
kind: page
mock: bug-record.html
implements: ["apps/galaxy/app/bugs/[id]/page.tsx", apps/galaxy/src/fixes/TimelinePane.tsx]
reads: [apps/galaxy/src/dossier/page/DossierRoute.tsx, apps/galaxy/src/fixes/facts/]
routes: [/bugs/<id>]
supersedes: null
---

## Purpose

One bug record of a product (`mobile-B74`): the bug, and one row per fix across the product's
repositories, each with its pull request and its state. The record ships itself when the last row's
pull request merges (PRD 2011).

## Regions

- The bar: the record's id and its product.
- The title: the bug in a line.
- The Fixes rows: order, repository, pull request, state (`open`, `merged`, `closed, not merged`).
- Under them: `Ships on the last merge.`, and any unmatched merge as a chip with its pull request.
- The one primary action: open the next unmerged fix.

## States

- Every row merged: the record reads shipped.
- A row closed without merging: the record stays open, and that row says so.
- A record born in git: today's markdown Fixes table, unchanged.

## Words

`merged`, `open`, `closed, not merged`, `unmatched`, `Ships on the last merge.`

## Refusals

- Nothing on this page merges anything (N-PRODUCT-15).

## Open questions

- Where each row's reproduction and guard lines show: in the row, or in a disclosure.

## Source

/omni:brainstorm, PRD 2011: .omni-loop/delivery/shipped/2011-product-records/before-after.html
