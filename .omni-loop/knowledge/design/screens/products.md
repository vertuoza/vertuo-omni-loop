---
screen: products
status: draft
kind: page
mock: products.html
implements: [apps/galaxy/app/app/products/page.tsx, apps/galaxy/src/products/ProductsHome.tsx, apps/galaxy/src/products/products-home.model.ts]
reads: [apps/galaxy/src/products/products.css, apps/galaxy/src/products/products.service.ts, apps/galaxy/src/products/products.controller.ts, apps/galaxy/src/products/ProductsScreen.tsx, apps/galaxy/app/app/layout.tsx, apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/Sidebar.tsx, apps/galaxy/src/nav/AppBar.tsx, apps/galaxy/src/nav/Bell.tsx]
routes: [/app/products]
supersedes: null
---

## Purpose

What the workspace builds, at a glance: each product, how much is in it, and what waits on the person
reading, so they open the right product first.

## Regions

- **The heading:** `Products`, alone; no boxed intro.
- **The totals:** four figures across, two by two on a phone: products, repositories (each once),
  PRDs, and waiting on you, the last in the signal when it is not zero.
- **The tiles,** one per product in the workspace's order, all of one height: the name (a link to the
  product home), one line `<n> PRDs · <n> repositories`, the repositories in mono with their shared
  owner said once, a shared one tagged SHARED, six shown and the rest counted (`+7`), cut at three
  lines; a foot with `<n> waiting on you` (or `Nothing waiting`) and Open. A tile something waits in
  has a signal edge on its left.
- **Archived (n),** under the tiles, for a workspace owner only: a closed `<details>`, absent when n is 0,
  listing each archived product with its name, `archived <ago> by <name>` and a quiet Restore, as
  Removed (n) does in Settings › Repositories (PRD 2188). Archived products are never in the grid.
- **Repositories in no product,** below the tiles, each with Add to a product.

## States

- No product: the totals and tiles give way to `No products yet. Products are optional…` and a link
  to Settings › Products; the unlinked repositories still list.
- A product with no repository: `No repository yet` on its line, `Add a repository` in its foot.
- An archived product: out of the grid for everyone; under Archived (n) for an owner; a member sees
  no Archived line. Restore puts it back in the grid as it was.
- Signed out, no workspace, no database, unreadable: the situation notices of `ProductsScreen.tsx`.

## Words

`Products`, `products`, `repositories`, `PRDs`, `waiting on you`, `Nothing waiting`, `No repository
yet`, `Add a repository`, `Open`, `SHARED`, `Repositories in no product`, `Add to a product`, `Archived (<n>)`, `archived <ago> by
<name>`, `Restore`.

## Refusals

- No card stretches to the tallest one: a long repository list is counted, never grown.
- No boxed intro sentence above the totals.
- No archived product in the grid, and no Archived line or Restore for a member.

## Open questions

- One primary action: the Open of the product waiting most leads, in the signal. Is that the page's
  one primary, or should nothing lead when a person reads the page only to scan?
- Should the order of the tiles follow what waits on you? It keeps the workspace's order today.
- Do the totals leave out the archived products? The PRD 2232 mockup draws them left out; the spec
  says only that they leave the grid.
- Is `<name>` in `archived <ago> by <name>` the member's login or their display name?

## Source

/omni:visual-fix #1598, pick D by @pierrederval on 2026-10-11: .omni-loop/delivery/visual/1598-products-page/before-after.html
/omni:brainstorm, PRD 2232: .omni-loop/delivery/inbox/2232-archive-product/before-after.html
