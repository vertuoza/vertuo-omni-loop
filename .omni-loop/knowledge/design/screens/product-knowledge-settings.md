---
screen: product-knowledge-settings
status: draft
kind: page
mock: product-knowledge-settings.html
implements: [apps/galaxy/src/product-knowledge/settings/SettingsPanel.tsx, apps/galaxy/src/product-knowledge/settings/McpServerCard.tsx]
reads: [apps/galaxy/src/business/BusinessPage.tsx, apps/galaxy/src/product-mcp/product-mcp.service.ts]
routes: [/app/products/<id>/knowledge/settings]
supersedes: null
---

## Purpose

The Settings section of a product's knowledge home: the business settings moved from Settings › Business
(Region, the picks, the claim lists), and, from PRD 2707, the product's MCP server: whether agents may
read the product's knowledge with the workspace's API keys, and the URL they connect to.

## Regions

- **The sub-menu** of the knowledge home, `Settings` current.
- **The lede:** Region is shared by every product.
- **Region, then the picks and claims,** as they were on Settings › Business.
- **MCP server:** a card after them, its state `Off` or `On`.
  - Off: *Agents can't read this product's knowledge yet.*, *Then every API key reads it.*, and **Turn on**.
  - On: *Any workspace API key reads its knowledge.*, the URL with **Copy**, **Copy for Claude Code**,
    **Copy for Cursor**, *Keys: Settings › API keys*, *No knowledge yet from <owner/name>.* for each
    repository of the product with no knowledge pack yet, and **Turn off** with *Stops agents on their next call.*

## States

- **Workspace owner:** Turn on, or Turn off.
- **Any other member:** the state, and the URL and copy buttons when it is on; no Turn on or Turn off.
- **An archived product:** the state, read-only.

## Words

MCP server · Off · On · Turn on · Turn off · Copy · Copy for Claude Code · Copy for Cursor · API key ·
Settings › API keys · No knowledge yet from.

## Refusals

- No secret is ever shown on this card: the key is made and shown only on Settings › API keys.
- Only a workspace owner sees Turn on or Turn off.

## Open questions

- Should the card show when an agent last read it?

## Source

/omni:brainstorm, PRD 2707: .omni-loop/delivery/shipped/2707-product-mcp/before-after.html
