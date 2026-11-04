---
screen: product-business-laws
status: draft
kind: page
mock: product-business-laws.html
implements: ["apps/galaxy/app/app/products/[id]/knowledge/[section]/page.tsx", apps/galaxy/src/product-knowledge/knowledge-sections.ts]
reads: [apps/galaxy/src/product-knowledge/found-domains-read.ts, kit/lib/knowledge/business-laws.ts]
routes: [/app/products/<id>/knowledge/business-laws]
supersedes: null
---

## Purpose

A product's business laws, read from its law home, with why each one exists. Nothing is edited here.

## Regions

- **The sub-menu:** Business laws with its count, after Domains.
- **Where they live:** the law home and the laws' owner.
- **The list:** each law's id and statement, its Why and its domains, filtered through `?domain=<key>`.
- **The action:** a link to the laws' files on GitHub.

## States

- **No law home:** a product with several repositories and no plan repository says to set one.
- **No pack yet:** the law home has not been read yet.
- **Empty:** the law home holds no business law.

## Words

Business laws · Law · Why · Domains · All · Open the laws on GitHub.

## Refusals

- No edit, add or retire control: a law changes by a pull request its owner approves.

## Open questions

- Does the list need search once it holds more than a few dozen laws?

## Source

- /omni:brainstorm, PRD 2632: .omni-loop/delivery/shipped/2632-business-laws/before-after.html
