---
screen: product-knowledge
status: draft
kind: page
mock: product-knowledge.html
implements: ["apps/galaxy/app/app/products/[id]/knowledge/page.tsx", apps/galaxy/src/product-knowledge/KnowledgeTab.tsx, apps/galaxy/src/product-knowledge/KnowledgeTabPage.tsx]
reads: [apps/galaxy/src/product-knowledge/product-knowledge.controller.ts, apps/galaxy/src/product-home/tabs.ts, apps/galaxy/src/products/products.css, apps/galaxy/src/nav/SectionTabs.tsx]
routes: [/app/products/<id>/knowledge]
supersedes: null
---

## Purpose

What the law requires of a product, and the product's own words, in one place every repository of the
product reads (PRD 1795). The product home's Knowledge tab, after Questions: a Legal section and a
Glossary section. Each names who answers for it, lists its entries and its open proposals, and shows the
controls the reader's role allows.

## Regions

- **The heading:** the product's name, `← Products`, and one line saying what the tab holds.
- **The tabs:** the product home's, `Knowledge` after `Questions`, the current one marked.
- **The Legal section:** `Owner: @anna · Delegate: @dev` (or `not named`), then one row per active entry:
  its id (`L-INVOICING-1`), its owner, its statement and its source law as fields, and the row's buttons.
  Under the rows, `Open proposals`, then the add form (code, statement, source law), then `Kept`: retired
  entries as text.
- **The Glossary section:** the same shape; a row holds the term, its meaning and the words to avoid
  (comma separated); removed terms are kept as text.
- **The naming control,** a workspace owner only, in each section: an Owner and a Delegate picker among
  the workspace's members, and `Name owner and delegate`.

## States

- **The kind's owner or delegate:** rows end in `Edit` and `Retire` (Legal) or `Remove` (Glossary); each
  open proposal has `Approve` and `Reject`; the add form ends in `Add`.
- **Any other member:** rows end in `Propose an edit` and `Propose to retire` (or `Propose to remove`);
  the add form ends in `Propose`; no `Approve`, no `Reject`.
- **A workspace owner:** the naming control, beside whatever their role as owner or delegate gives.
- **No owner and no delegate named:** the section says `While none is named, the workspace’s owners
  decide.`
- **Empty:** `No Legal entry yet.` or `No term yet.`
- **A change refused:** the database's words under the sections, in the refusal colour.
- **Signed out, no workspace, no database, unreadable, no such product:** the situation notices of the
  product home.

## Words

Knowledge · Legal · Glossary · Owner · Delegate · not named · Open proposals · Statement · Source law ·
Code · Term · Meaning · Avoid · Edit · Retire · Remove · Add · Propose · Propose an edit · Propose to
retire · Propose to remove · Approve · Reject · Kept · retired · removed · Name owner and delegate.

## Refusals

- A Legal entry is retired, never deleted; a term is removed, never deleted: the page has no Delete.
- A member who may only propose never sees a control that changes an entry directly.
- A proposal is never shown as an entry until its owner approves it.

## Open questions

- A row edits in place with its fields always open. Is a read-first row with an Edit toggle better once a
  product holds dozens of entries?
- A change reloads the page. Should the row update in place and keep the reader's scroll?
- The entry's owner is the person who added it; the page has no control to hand an entry to another
  member. Is that needed?

## Source

- PRD 1795 s2, drawn from the source by hand (no `/omni:pixel-perfect mock` run).
- .omni-loop/delivery/shipped/1795-product-knowledge-page/spec.md
