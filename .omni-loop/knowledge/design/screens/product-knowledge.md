---
screen: product-knowledge
status: draft
kind: page
mock: product-knowledge.html
implements: ["apps/galaxy/app/app/products/[id]/knowledge/page.tsx", "apps/galaxy/app/app/products/[id]/knowledge/[section]/page.tsx", apps/galaxy/src/product-knowledge/KnowledgeTab.tsx, apps/galaxy/src/product-knowledge/KnowledgeTabPage.tsx, apps/galaxy/src/product-knowledge/KnowledgeNav.tsx, apps/galaxy/src/product-knowledge/knowledge-sections.ts, apps/galaxy/src/nav/SortableList.tsx]
reads: [apps/galaxy/src/product-knowledge/product-knowledge.controller.ts, apps/galaxy/src/product-home/tabs.ts, apps/galaxy/src/products/products.css, apps/galaxy/src/nav/SectionTabs.tsx, apps/galaxy/src/business/PersonasSection.tsx, apps/galaxy/src/business/ConstituentsPanel.tsx, apps/galaxy/src/products/pitch-form.tsx, apps/galaxy/src/business/BusinessView.tsx]
routes: [/app/products/<id>/knowledge, /app/products/<id>/knowledge/<section>]
supersedes: null
---

## Purpose

The one home of everything agents read about a product (PRD 1795, made the product's knowledge home by
PRD 2240): its Constituents, Personas, Legal entries, Glossary, Pitch settings and the business settings
that fit nowhere else. The product home's Knowledge tab, after Questions.

## Regions

- **The heading:** the product's name, `← Products`, one line, and the link to the knowledge graph.
- **The tabs:** the product home's, `Knowledge` current.
- **The sub-menu:** a second row, `Constituents · Personas · Legal · Glossary · Pitch · Settings`, each
  list section with its count of active items; the current one marked. `/knowledge` opens Constituents.
- **A list section** (Constituents, Personas, Legal, Glossary): a table, every header a sort link
  (`?sort=&dir=`), the one in use marked `aria-sort`; text cells one line, ending in "…"; each row's
  first cell links to the item's page (`product-knowledge-item`). Above it, `Active · n` and
  `Retired · n` filters; for Legal and Glossary the owner and delegate line, the naming control and
  open proposals. Under it, the add action.
- **Pitch:** the Pitch editor, as it was on Settings › Products.
- **Settings:** Region (shared by every product), the picks, the claim lists, To check and the draft
  from repos, as they were on Settings › Business.

## States

- **Owner or delegate of Legal or Glossary:** Approve and Reject on proposals; `Add an entry`.
- **Any other member:** `Propose` in place of Add; no Approve or Reject.
- **Empty list:** `No <item> yet.`
- **An item with no author** (made before PRD 2240): `—` in Created by and Created, sorted last.
- **Signed out, no workspace, no database, unreadable, no such product:** the product home's notices.

## Words

Knowledge · Constituents · Personas · Legal · Glossary · Pitch · Settings · Active · Retired · Code ·
Statement · Source law · Term · Meaning · Kind · Text · Name · Stance · Trade · Owner · Created by ·
Created · Updated · Add an entry · Propose · Approve · Reject · shared by every product.

## Refusals

- A Legal entry is retired, a term removed, never deleted: no Delete on Legal or Glossary.
- A member who may only propose never sees a control that changes an entry directly.
- A proposal is never listed as an entry until approved.
- No knowledge of a product is edited anywhere else in the app.

## Open questions

- Should the Settings section split Region from the picks once it grows?
- Do lists need a search box once a section holds more than a few dozen items?

## Source

- PRD 1795 s2, drawn from the source by hand (no `/omni:pixel-perfect mock` run).
- /omni:brainstorm, PRD 2240: .omni-loop/delivery/inbox/2240-product-knowledge-home/before-after.html
