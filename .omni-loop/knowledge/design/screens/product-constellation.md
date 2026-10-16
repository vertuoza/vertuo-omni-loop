---
screen: product-constellation
status: draft
kind: page
mock: product-constellation.html
implements: ["apps/galaxy/app/app/products/[id]/[tab]/page.tsx", apps/galaxy/src/product-home/ConstellationTab.tsx, apps/galaxy/src/product-home/constellation.css, apps/galaxy/src/product-home/tabs.ts]
reads: [apps/galaxy/src/product-home/constellation.ts, apps/galaxy/src/product-home/product-home.service.ts, apps/galaxy/src/product-home/product-home.repository.ts, apps/galaxy/src/product-home/ProductHome.tsx]
routes: [/app/products/<id>/constellation]
supersedes: null
---

## Purpose

A product's Constellation tab: how the product looks now, read only. Its repositories are stars, the
`consumes` edges its owners declared are lines, and the Ledger's states are drawn on them (PRD 2129).

## Regions

- The product's name and tab row, Constellation second.
- The lede, and the `as of HH:MM UTC` stamp.
- The filter row: `Everything`, then one chip per PRD on the Ledger, newest first.
- The sky: one star per linked repository, its ring for its state, the halo when it is also in
  another product, `DOCKED` and a tether to each open phase-0 pull request when its phase 0 is `pr`;
  one curved edge per `consumes` entry, labelled with what crosses it now.
- The legend under the sky.
- The side card: *Now in <product>* with nothing selected, or the selected star's card. Its one
  primary action is the PRD that waits on you (nothing selected) or `Ledger rows →` (a star).

## States

- Everything, or one PRD lit (`?prd=`), the rest faded.
- A star selected (`?star=`), or none.
- No repository linked: no sky, one line and its link.
- Repositories but no edges: the stars alone and one line with its link.
- Reduced motion: the on-you ring holds still, no dots on the edges.
- Below 600 px: the sky scrolls inside its own frame, the card drops under it.

## Words

`How the product looks now.`, `read only`, `Everything`, `<consumer> → <provider> · <k> PRDs in flight`,
`nothing in flight`, `DOCKED`, `◇ <repo>#<n> · phase 0`, `also in <product>`, `Now in <product>`,
`waits on you`, `building`, `drifted`, `docked`, `consumed by`, `consumes`, `Ledger rows →`, `Its links →`.

## Refusals

- Nothing is picked, created or changed here: links are changed on Repositories & approvers.
- No edge is drawn that no owner declared.
- No colour of its own: the sky is `--ask-sunk`, the states are the Ledger's colours.

## Open questions

- How a product of more than 16 repositories stays readable.

## Source

/omni:brainstorm, PRD 2129: .omni-loop/delivery/shipped/2129-constellation-tab/before-after.html
