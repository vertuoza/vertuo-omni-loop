---
screen: product-home
status: draft
kind: page
mock: product-home.html
implements: [apps/galaxy/src/product-home/ProductHome.tsx, apps/galaxy/src/product-home/product-home.css]
reads: [apps/galaxy/src/product-home/product-home.service.ts]
routes: [/app/products/<id>]
supersedes: null
---

## Purpose

A product's home: its name and its tabs, opening on the Ledger, what waits on whom across its PRDs.
For a workspace owner it is also where the product is archived, and where an archived product is read
and restored.

## Regions

- **The head card:** `← Products`, the product's name, the tab's lede. For a workspace owner, a quiet
  **Archive** beside the name; the head card holds no primary action.
- **The tabs:** Ledger, Constellation, PRDs, Ideas, Roadmap, Bug fixes, Visual fixes, Questions,
  Knowledge, Repositories & approvers.
- **The Ledger:** three counts (building, waiting on a person, drifted), then its lanes, one row per PRD.
- **The archived banner,** above the head card on an archived product: `Archived <ago> by <name>.` and
  **Restore**, the page's one primary action.

## States

- Live, read by an owner: Archive in the head card. Pressing it asks first with `window.confirm`:
  `Archive <name>? It leaves every member's list, and its repositories stop reading its Legal entries
  and glossary.`, plus `Repositories: <owner/name>, …` when it has any. Confirmed, the owner lands on
  `/app/products`; cancelled, nothing changes.
- Live, read by a member: no Archive.
- Archived, read by its owner: read-only under the banner, no Archive; Restore brings it back as it was.
- Archived, opened by a member: the products page's not-found, `No such product`.
- No such product, signed out, no workspace: the notices of `ProductHome.tsx`.

## Words

`← Products`, `Archive`, `Restore`, `Archived <ago> by <name>.`, the confirm's text above, `What waits
on whom across its PRDs.` (the Ledger's lede, cut to seven words by the PRD 2232 word pass).

## Refusals

- No custom dialog for Archive: the browser's own confirm, as PRD 2188's Remove.
- No delete: archiving erases nothing.
- No control that changes an archived product, save Restore.
- No Archive, banner or Restore for a member.

## Open questions

- Where Archive sits in the head card: the mockup puts it at the end of the name's line.
- What read-only removes on each tab of an archived product (the Questions tab's answers, the Ideas
  tab, Knowledge and Repositories & approvers edits); the mockup draws the Ledger only.
- Whether the banner sits above the head card or inside it.
- Is `<name>` in the banner the member's login or their display name?
- The Ledger's lede cut to `What waits on whom across its PRDs.` (from `…, across the product’s
  PRDs.`) to pass the word pass: the spec does not name it.

## Source

/omni:brainstorm, PRD 2232: .omni-loop/delivery/inbox/2232-archive-product/before-after.html
