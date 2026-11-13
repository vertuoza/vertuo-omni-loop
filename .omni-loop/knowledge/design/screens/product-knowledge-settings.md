---
screen: product-knowledge-settings
status: draft
kind: page
mock: product-knowledge-settings.html
implements: [apps/galaxy/src/product-knowledge/settings/SettingsPanel.tsx, apps/galaxy/src/product-knowledge/settings/McpServerCard.tsx, apps/galaxy/src/product-knowledge/settings/mcp-server.ts, apps/galaxy/src/product-knowledge/settings/ProductKeyCard.tsx, apps/galaxy/src/product-knowledge/settings/product-key.ts]
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
- **Product key** (PRD 2784): a card after them, `#product-key`.
  - No key, an owner: a field prefilled from the product's name, **Set key**, *Set once. It never changes.*;
    then the confirm step, *Set the key to <key>?*, *PRDs: <key>-1, <key>-2…*, *MCP: /api/products/<key>/mcp*,
    *It never changes.*, **Set for good** and **Back**. A refusal under the field: *Another product has <key>.*,
    the shape rule *Lowercase words joined by -, 40 at most.*, or *Only an owner sets it.*
  - No key, any other member: *No key yet.*, *An owner sets it.* An archived product with no key: *No key.*
  - A key: the key in code, *Set once.*
- **MCP server:** a card after the key, its state `Off` or `On`.
  - No key: *Set the product's key first.*, linked to `#product-key`, and no **Turn on**.
  - Off: *Agents can't read this product's knowledge yet.*, *Then every API key reads it.*, and **Turn on**.
  - On: *Any workspace API key reads its knowledge.*, the URL with **Copy**, **Copy for Claude Code**,
    **Copy for Cursor**, *Keys: Settings › API keys*, *No knowledge yet from <owner/name>.* for each
    repository of the product with no knowledge pack yet, and **Turn off** with *Stops agents on their next call.*

## States

- **Workspace owner:** Set key while there is none; Turn on, or Turn off, once there is one.
- **Any other member:** the state, and the URL and copy buttons when it is on; no Turn on or Turn off.
- **An archived product:** the state, read-only.

## Words

MCP server · Off · On · Turn on · Turn off · Copy · Copy for Claude Code · Copy for Cursor · API key ·
Settings › API keys · No knowledge yet from · Product key · Set key · Set for good · Back · Set once ·
It never changes · Set the product's key first.

## Refusals

- No secret is ever shown on this card: the key is made and shown only on Settings › API keys.
- Only a workspace owner sees Turn on or Turn off, or the key's field.
- A key is never changed or cleared here: the card offers nothing once a key is set.

## Open questions

- Should the card show when an agent last read it?

## Source

/omni:brainstorm, PRD 2707: .omni-loop/delivery/shipped/2707-product-mcp/before-after.html
/omni:brainstorm, PRD 2784: .omni-loop/delivery/shipped/2784-product-key-setting/before-after.html
