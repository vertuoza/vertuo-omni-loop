---
screen: product-knowledge-item
status: draft
kind: page
mock: product-knowledge-item.html
implements: ["apps/galaxy/app/app/products/[id]/knowledge/[section]/[item]/page.tsx", apps/galaxy/src/product-knowledge/KnowledgeItem.tsx]
reads: [apps/galaxy/src/product-knowledge/product-knowledge.controller.ts, apps/galaxy/src/business/PersonasSection.tsx, apps/galaxy/src/business/ConstituentsPanel.tsx]
routes: [/app/products/<id>/knowledge/<section>/<item>]
supersedes: null
---

## Purpose

One knowledge item of a product, read whole: a Constituent, a Persona, a Legal entry or a Glossary term
(PRD 2240). The page a row of the Knowledge lists opens.

## Regions

- **Back:** `← <Section>`, to the list with its sort kept.
- **The item:** its id or name, then each field in full, its owner where it has one, Created by, Created
  and Updated; the item's actions beside its id.
- **History:** the item's events, folded, where they are kept (Constituents, Legal, Glossary).

## States

- **May change it:** `Edit` (primary) opens the item's form in place; `Retire` (Legal), `Remove`
  (Glossary, Never line) or `Delete` (Persona).
- **May only propose:** `Propose an edit` and `Propose to retire` or `Propose to remove`.
- **Retired or removed:** the fields read-only, marked retired, with when and by whom.
- **No such item:** the 404 page, with a link to its list.
- **No author** (made before PRD 2240): `—`.

## Words

Edit · Retire · Remove · Delete · Propose an edit · Propose to retire · Propose to remove · Owner ·
Created by · Created · Updated · History · retired · removed.

## Refusals

- The page never shows a control the reader's role does not allow.
- A Legal entry or a term is never deleted.

## Open questions

- Should a Persona's page show the PRDs whose voice it spoke in?

## Source

- /omni:brainstorm, PRD 2240: .omni-loop/delivery/inbox/2240-product-knowledge-home/before-after.html
