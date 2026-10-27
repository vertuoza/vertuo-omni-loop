---
screen: business-settings
status: draft
kind: page
mock: business-settings.html
implements: [apps/galaxy/app/app/settings/business/page.tsx, apps/galaxy/src/business/BusinessScreen.tsx, apps/galaxy/src/business/BusinessView.tsx, apps/galaxy/src/business/BusinessPage.tsx, apps/galaxy/src/nav/section-tabs.ts]
reads: [apps/galaxy/src/agent-connect/questions, apps/galaxy/src/agent-connect/tokens]
routes: [/app/settings/business]
supersedes: null
---

## Purpose

The workspace's business, as Settings shows it once each product's knowledge lives on its Knowledge
tab (PRD 2240): adding a product, the questions agents asked, and connecting an agent.

## Regions

- **The Settings tabs:** Fleets · Repositories · Business · API keys · Jev · Playbook; no Products tab.
- **Products:** `+ Add a product`.
- **Agent questions.**
- **Connect an agent.**

## States

- **No product yet:** `+ Add a product` only.

## Words

Business · Products · Add a product · Agent questions · Connect an agent · Connect.

## Refusals

- No product's knowledge (Region, Constituents, Personas, picks, claims, Pitch) is shown or edited here.

## Open questions

- Does `+ Add a product` belong on the Products page under Work instead?

## Source

- /omni:brainstorm, PRD 2240: .omni-loop/delivery/shipped/2240-product-knowledge-home/before-after.html
