---
screen: product-law-variants
status: draft
kind: page
mock: product-law-variants.html
implements: [apps/galaxy/src/product-knowledge/LawVariantsSection.tsx, apps/galaxy/src/product-knowledge/law-variants-section.ts, apps/galaxy/src/product-knowledge/knowledge-sections.ts]
reads: [apps/galaxy/src/product-knowledge/business-laws-load.ts, kit/lib/knowledge/law-variants.ts]
routes: [/app/products/<id>/knowledge/law-variants]
supersedes: null
---

## Purpose

Every condition of a product (a feature flag, a setting) against every audience it declares, read from the
law home's `product/law-variants.json`, with the laws and Legal entries each one touches. Nothing is edited
here.

## Regions

- **The sub-menu:** Law variants with its count, right after Business laws.
- **Where they live:** "Read from `<home>` · newest merge".
- **The matrix:** a row per variant (its feature, its condition under it), a column per declared audience in
  the file's order, each cell `on`, `off` or `—`; then Laws, Legal and Checked (a badge, the date, the release).
- **A row's disclosure:** the on and off text and the check's note.
- **The action:** a link to the file on GitHub.

## States

- **No file:** "No law variant yet." then "Add `product/law-variants.json` in `<home>`."
- **Does not read:** a notice, "`law-variants.json` does not read at `<sha>`.", the first problem under it.
- **No law home, no pack, unreadable:** the texts Business laws says.
- **A check:** `live · <n>d` or `code · <n>d`; past the file's `staleAfterDays`, `· stale` in the warning tone;
  `not checked` muted.

## Words

Law variants · Variant · Differs for · on · off · Laws · Legal · Checked · not checked · stale · On and off.

## Refusals

- No edit, add or remove control: a variant changes in its file, through a pull request.
- No audience filter in this version.

## Open questions

- Does a product with several variants files (one per pack, #1082) need one matrix per file?

## Source

- /omni:brainstorm, PRD 3375: .omni-loop/delivery/inbox/3375-law-variants/before-after.html
