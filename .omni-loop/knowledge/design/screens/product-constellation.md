---
screen: product-constellation
status: draft
kind: page
mock: product-constellation.html
implements: ["apps/galaxy/app/app/products/[id]/[tab]/page.tsx", apps/galaxy/src/product-home/ConstellationTab.tsx, apps/galaxy/src/product-home/constellation.css, apps/galaxy/src/product-home/tabs.ts]
reads: [apps/galaxy/src/product-home/constellation.ts, apps/galaxy/src/product-home/layout.ts, apps/galaxy/src/product-home/product-home.service.ts, apps/galaxy/src/product-home/product-home.repository.ts, apps/galaxy/src/product-home/ProductHome.tsx]
routes: [/app/products/<id>/constellation]
supersedes: null
---

## Purpose

A product's Constellation tab: how the product looks now, read only, on the concept tour's night sky.
Its repositories are stars; a line joins two repositories that a PRD's plan targeted together, wider as
more PRDs share it and bright while one is in flight; declared `consumes` are thin arrows (PRD 2174,
reworking PRD 2129).

## Regions

- The product's name and tab row, Constellation second.
- The lede, the count (`18 repositories · 24 lines`) and the `as of HH:MM UTC` stamp. No filter row.
- The sky: a deep gradient with a faint nebula and a seeded starfield, dark in every theme; one glowing
  star per linked repository, sized by how many PRDs touch it, its state ring, the also-in halo, a dim
  core when docked; its name under it, its role only when set; plan lines and consumes arrows. Every
  star and line is a link with a `<title>`. Placed by a seeded force layout: no label overlaps.
- The legend under the sky.
- The side card: *Now in <product>* (the first 8 PRDs in flight, worst first, then how many more on the
  Ledger) with nothing selected; a star's card with its lines (`?star=`); a line's card with every PRD
  sharing it (`?pair=`). Its one primary action is the PRD that waits on you, or the first line or PRD
  of the card.

## States

- Nothing selected, a star selected, a line selected.
- No repository linked: no sky, one line and its link.
- Repositories but no line: the stars, and *No PRD's plan names two repositories yet.*
- Reduced motion: nothing twinkles, pulses or flows; at most 60 field stars twinkle otherwise.
- Below 600 px: the sky scrolls inside its own frame, the card drops under it.

## Words

`How the product looks now.`, `<n> repositories · <k> lines`, `as of HH:MM UTC`, `Now in <product>`,
`+ <k> more on the Ledger →`, `<a> ↔ <b> · <k> PRDs`, `<k> PRDs changed both.`, `in flight`,
`<k> target outside the product`, `waits on you`, `building`, `drifted`, `docked · phase 0 by PR`,
`also in another product`, `PRDs changed both`, `consumes`, `Read only.`

## Refusals

- Nothing is picked, created or changed here.
- No PRD filter.
- No line no PRD's plan or no owner declared.
- No word printed on every star (`DOCKED`, `no role`): the legend and the card say it.

## Open questions

- Whether a PRD shipped before its plan was pushed to its dossier should ever draw lines.

## Source

/omni:brainstorm, PRD 2129: .omni-loop/delivery/inbox/2129-constellation-tab/before-after.html
/omni:brainstorm, PRD 2174: .omni-loop/delivery/inbox/2174-constellation-real-scale/before-after.html
