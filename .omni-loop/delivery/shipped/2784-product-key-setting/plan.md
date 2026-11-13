# Plan: set a product's key from its Settings

PRD #2784, specified in `spec.md` beside this plan. The feature branch `feat/product-key-setting`
merges into `main` through the feature PR (`Closes #2784`). Each slice is a sub-PR from
`feat/product-key-setting--<slice>` into the feature branch (`Part of #2784`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A workspace owner sets the product's key once from the Product key card on its Settings tab: prefilled from the product's name, checked for shape, confirmed, written through `product_set_key()`, its refusal shown in a short line; other members see the key or who sets it | `apps/galaxy/src/product-knowledge/settings/product-key` `apps/galaxy/src/product-knowledge/settings/ProductKeyCard` `apps/galaxy/src/product-knowledge/settings/SettingsPanel.tsx` `apps/galaxy/src/product-knowledge/settings/mcp-server.repository` `apps/galaxy/src/product-knowledge/settings/mcp-server-load` | — | 1 | build |
| s2 | With no key, the MCP server card says *Set the product's key first.*, linked to `#product-key`, for every member, in place of its two Off lines | `apps/galaxy/src/product-knowledge/settings/McpServerCard` `apps/galaxy/src/product-knowledge/settings/mcp-server.ts` | — | 1 | light |

**Shared ground:** none. The two slices share the folder `apps/galaxy/src/product-knowledge/settings/`
but no prefix: s1 owns the new `product-key*` and `ProductKeyCard*` files, the panel, the read
(`mcp-server-load*`, which now also reads the product's `name`) and the write (`setKey` in
`mcp-server.repository*`); s2 owns the MCP card and its words (`McpServerCard*`, `mcp-server.ts`).
`apps/galaxy/src/agent-words.test.ts` reads literals of `McpServerCard.tsx` and `mcp-server.ts`
(`Copy for Claude Code`, `claude mcp add`); s2 keeps both, so neither slice edits it. The draft
screen `product-knowledge-settings` was brought up to the after by the brainstorm; neither slice
changes it.

## Per slice: done when

**s1** (`ui: yes`)
- `suggestKey('Acme Insight')` is `acme-insight`, `suggestKey('Field App 2')` is `field-app`, accents
  are dropped, the result is cut at 40 characters on a part boundary, and a name with nothing left
  gives an empty field (unit tests).
- `keyShapeOk` accepts and refuses the same keys as `products_key_shape` (unit tests on the
  migration's examples).
- `keyCardFrom` gives the five states of the spec's table: an owner with no key, the confirm step,
  any other member with no key, an archived product with no key, a key set (unit tests).
- `setKey` calls `rpc('product_set_key', {p_product, p_key})` and maps a taken key to *Another
  product has `<key>`.*, a bad shape to the shape rule, and anything else to *Only an owner sets
  it.* (repository test against a stubbed client).
- The Product key card renders each state's words and controls, with `id="product-key"`, between the
  business settings and the MCP card; **Set key** is disabled while the shape rule fails; **Back**
  returns to the field unchanged (component tests, rendered to markup).
- The Settings read also returns the product's `name`; in the demo, **Set for good** only moves the
  card.
- `pnpm typecheck`, `pnpm lint` on the changed files, and the related tests are green.

**s2** (`light: wording and one branch`, `ui: yes`)
- With `key: null`, `McpServerCard` shows **Off** and the one line *Set the product's key first.*
  linking to `#product-key`, for an owner and for any other member, and no **Turn on** (component
  test).
- With a key, the card renders exactly as before (the existing tests stay green unchanged).
- `apps/galaxy/src/agent-words.test.ts` stays green.
