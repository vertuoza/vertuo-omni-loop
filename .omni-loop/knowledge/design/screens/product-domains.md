---
screen: product-domains
status: draft
kind: page
mock: product-domains.html
implements: ["apps/galaxy/app/app/products/[id]/knowledge/[section]/page.tsx", apps/galaxy/src/product-knowledge/KnowledgeLists.tsx, apps/galaxy/src/product-knowledge/knowledge-sections.ts]
reads: [apps/galaxy/src/product-knowledge/found-domains.ts, apps/galaxy/src/product-knowledge/product-knowledge.service.ts]
routes: [/app/products/<id>/knowledge/domains]
supersedes: null
---

## Purpose

A product's one list of domains, and the folders its repositories hold that the list does not.

## Regions

- **The sub-menu:** Domains with its active count, and `· <k> not on the list` when any exist.
- **Who answers:** the owner and delegate line, the naming control, open proposals.
- **The list:** key, name, meaning, terms; `Active · n` and `Retired · n` filters; the add action.
- **Not on the list:** one row per folder, its repositories and its action.
- **Under it:** retired domains still in a repository, and repositories not read yet.

## States

- **Who decides:** `Add a domain`, `Add to the list`, Approve and Reject.
- **Any other member:** `Propose`, on both.
- **A folder that cannot be a key:** `Cannot be a key: rename the folder`, and no action.
- **Empty list:** `No domain yet.`, with the folders found under it.
- **Nothing found:** the Not on the list region is absent.

## Words

Domains · Key · Name · Meaning · Terms · Not on the list · Add a domain ·
Add to the list · Propose · Retired · Not read yet.

## Refusals

- No Delete: a domain is retired.
- A key never changes and is never reused.
- Nothing here blocks a repository.

## Open questions

- Does the list need search once it holds more than a few dozen domains?

## Source

- /omni:brainstorm, PRD 2583: .omni-loop/delivery/shipped/2583-product-domains/before-after.html
- /omni:brainstorm, PRD 2632: .omni-loop/delivery/inbox/2632-business-laws/before-after.html (the sub-menu gains Business laws after Domains)
