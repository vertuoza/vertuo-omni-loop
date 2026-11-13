---
prd: 2784
title: Set a product's key from its Settings
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge]
---

**Date:** 2026-11-13 · **PRD:** #2784 · **After:** PRD 1548 (the product key, `product_set_key()`),
PRD 2707 (the product's MCP server card) · **Touches:** `apps/galaxy/src/product-knowledge/settings/`

## Problem

A product's key starts each of its ids (`mobile-12`) and names its MCP address
(`/api/products/<key>/mcp`). PRD 1548 gave the database `product_set_key()`, an owner-only function
that sets the key once, but no page calls it: apps/galaxy/README.md says "an owner calls the function
in the database". A product made on the page has no key, so:

- its MCP server card shows **Off** with no **Turn on**, even to a workspace owner
  (`McpServerCard.tsx`: `canSwitch` needs `card.key !== null`), and nothing says why;
- it has no product PRD, since a product PRD's id needs the key;
- the only way out is SQL on production, which is how Vertuo Insight got `insight` on 2026-11-13.

## Solution

**A Product key card** on the product's Settings tab (`/app/products/<id>/knowledge/settings`),
drawn between the business settings and the MCP server card. It reads the product's `name` and `key`
with the MCP card's read, as the signed-in person.

| who, and the product | what the card shows |
|---|---|
| a workspace owner, no key, not archived | a text field prefilled with the key suggested from the product's name, **Set key**, and *Set once. It never changes.* |
| the same owner, after **Set key** | the confirm step: *Set the key to `<key>`?*, *PRDs: `<key>-1`, `<key>-2`…*, *MCP: `/api/products/<key>/mcp`*, *It never changes.*, with **Set for good** and **Back** |
| any other member, no key | *No key yet.* and *An owner sets it.* |
| an archived product, no key | *No key.* read-only |
| any member, a key set | `<key>` in code, and *Set once.* |

- **The suggestion** (`suggestKey(name)`, pure): the name lowercased, accents dropped, every run of
  other characters made one `-`, each part stripped of its leading digits, empty parts dropped, cut at
  40 characters on a part boundary. `Vertuo Insight` → `vertuo-insight`; `Field App 2` → `field-app`.
  When nothing is left, the field starts empty. The owner edits it freely before **Set key**.
- **The check in the field,** before the confirm step, mirrors the function's shape rule: lowercase
  kebab-case of at most 40 characters, each part starting with a letter. A key that fails it keeps
  **Set key** disabled and says the rule under the field: *Lowercase words joined by -, 40 at most.*
- **The write:** **Set for good** calls `product_set_key(p_product, p_key)` from the browser as the
  signed-in person with the publishable key, as `product_mcp_set()` is called (`mcp-port.ts`). The
  function stays the judge: owner only, live product only, shape, unique in the workspace, set once.
  Its refusal is shown under the field in a short line (the design's word pass caps a line at rest at
  seven words): a key another product holds reads *Another product has `<key>`.*; a bad shape reads
  the shape rule above; any other refusal (not an owner, an archived product) reads *Only an owner
  sets it.* On success the page refreshes and both cards read the key.
- **The demo** keeps its in-memory card: **Set for good** only moves the card.

**The MCP server card,** when the product has no key: under **Off**, the one line *Set the product's
key first.*, linked to the Product key card (`#product-key`), in place of its two Off lines, for every
member. With a key, the card is unchanged.

No database change: `product_set_key()`, `products_key_once` and `products_key_shape` already exist
and are granted to `authenticated`.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | ui | `ProductKeyCard` (`ProductKeyCard.tsx`) | no written convention: follows `apps/galaxy/src/product-knowledge/settings/McpServerCard.tsx:27` |
| vertuo-omni-loop | ui | `product-key.ts` (words, `suggestKey`, `keyShapeOk`, `keyCardFrom`) | no written convention: follows `apps/galaxy/src/product-knowledge/settings/mcp-server.ts:1` |
| vertuo-omni-loop | ui | `product-key-port.ts` (`setProductKey`) | no written convention: follows `apps/galaxy/src/product-knowledge/settings/mcp-port.ts:10` |
| vertuo-omni-loop | repository | `setKey` in `mcp-server.repository.ts` | no written convention: follows `setMcp`, `apps/galaxy/src/product-knowledge/settings/mcp-server.repository.ts:29` |
| vertuo-omni-loop | ui | anchor `#product-key` | no written convention: follows `aria-labelledby="mcp-title"`, `McpServerCard.tsx:47` |

## Decisions

- **The design's objection, accepted.** B-E DEv: "One more form to fill before I get my MCP server is
  exactly the fluff I expect from this tool. Fill the key in from the product's name so I just press
  the button." (persona:B-E DEv). Settled `accepted`: the field is prefilled by `suggestKey`.
- **A card of its own, not a field inside the MCP card:** the key names the product's PRD ids too,
  not only its MCP address.
- **A confirm step:** the key can never change, so the owner sees the exact key and what it names
  before it is written.
- **The function judges, the page only helps:** the shape check in the field is a convenience; every
  write goes to the function, and its refusal is mapped to one of three short lines.
- **Out of this PRD,** asked in the same session and kept for later: persona trades and stance,
  `omni business persona add|edit`, glossary domains in `omni business show` (the person's own
  persona work comes first), and two bugs for `/omni:bug-fix`: `omni kb legal|domains` writes
  timing out at 5 s and reporting a failure that was saved, and the session briefing printing a stale
  copy of another product's constituents.

## User stories

- As a workspace owner, I set my product's key from its Settings tab, prefilled from its name, and see
  what it will name before it is set for good.
- As a workspace owner whose product has no key, I learn from the MCP server card that the key comes
  first, and reach it in one click.
- As a member who is not an owner, I see whether the product has a key, and who sets it.

## Scope

In: the Product key card, its words and suggestion, its write through `product_set_key()`, the
product's name in the Settings read, the MCP card's no-key line, the draft screen
`product-knowledge-settings` brought up to date.

Out: any database change; changing or clearing a key (never possible); a key on the "New product"
form; a CLI command to set a key; personas; the two bugs above.

## Test seams

- **Unit (vitest):** `suggestKey` (the examples above, accents, digits, 40-character cut, empty);
  `keyShapeOk` against the same cases the migration's check refuses; `keyCardFrom` for each row of the
  card table.
- **Component (vitest, server render to markup as `McpServerCard.test.ts` does):** each state of the
  Product key card, and the MCP card's no-key line with its `#product-key` link.
- **Repository:** `setKey` calls `rpc('product_set_key', {p_product, p_key})` and maps an error to
  one of the three refusal lines, against a stubbed client, as `mcp-server.repository.test.ts` does.
- **Database:** `supabase/checks/product_prd_ids.sql` already proves the function; unchanged.
- No test calls GitHub or a live Supabase.

## Risks

- **What merging publishes:** the arcade app's next Vercel deploy shows the card to every workspace.
  Rolled back by reverting the feature PR; a key already set stays set (it is the product's for life,
  as when set in SQL).
- **A typo becomes permanent.** An owner who confirms a wrong key keeps it. Mitigated by the prefill,
  the shape check and the confirm step naming the PRD ids and the MCP address.
- **The Legal entries:** none touched: the key is not personal data, and nothing is logged.
- **The locked laws:** none touched.
- **The business laws:** BL-PRODUCTKNOWLEDGE-1 to -4 are printed for the product-knowledge domain;
  each governs Legal, Glossary, personas or knowledge packs, and the design keeps all four (the key is
  none of them).

## Acceptance criteria

- A workspace owner on a product with no key sees the Product key card with a field prefilled from the
  product's name (`Vertuo Insight` → `vertuo-insight`) and **Set key**.
- **Set key** shows the confirm step naming `<key>-1` and `/api/products/<key>/mcp`; **Back** returns
  to the field unchanged; **Set for good** sets the key, and after the refresh the card shows the key
  and the MCP card shows **Turn on**.
- A key that breaks the shape rule keeps **Set key** disabled with the rule under the field.
- A key another product of the workspace holds is refused with *Another product has `<key>`.*, and
  nothing changes.
- A member who is not an owner sees *No key yet.* and *An owner sets it.*, and no field.
- On an archived product with no key, the card reads *No key.* and offers nothing.
- With no key, the MCP server card shows **Off** and *Set the product's key first.* linking to
  `#product-key`, for every member; with a key it is as today.
- A product with a key shows it, read-only, to every member.
