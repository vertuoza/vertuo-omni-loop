# `kit/templates/README.md`

Source: `docs/knowledge/README.md` @ `vertuo-ai-domain@db67fd9da` (its opening and its three
layers), with the two halves and the override order from the PRD 45 spec. The front door's page:
`omni kb init` writes it as the `README.md` of the playbook folder's parent, filling its
`{config:<key>}` placeholders then (item `s2-01-front-door-page-filled-from-settings`). It is not a
form: no front matter, no slots.

## Read from config instead of hard-coded

| upstream | here |
|---|---|
| `docs/knowledge/` (the folder the page is in) | `{config:paths.knowledge}` |
| `docs/adr/` ("That lives in the decision records") | `{config:paths.adr}` |
| `docs/agents/` ("and in `docs/agents/`") | `{config:paths.playbook}` |

## Dropped (repository literals)

- `scripts/registers.mjs` ("the one parser"): the kit's parser is not the page's business.
- **One example, all the way down:** `P-PRODUCT-1`, `BR-QUOTE-1`, `from-document`,
  `apps/vertuo-ai-api/src/features/offer/quote-extraction.controller.test.ts`,
  `pnpm knowledge P-PRODUCT-1`.
- **The layout and the eleven domains:** `advisor`, `agent-session`, `credits`, `identity`,
  `erp-write`, `folder`, `prompt`, `evaluation`, `micro-feedback`, `extraction`, `erp`, the Vertuo
  domain knowledge base, and the Core Invariants `N1`…`N8`.
- **Where a new entry goes, Ids, Decision record or principle?, How a settled outbox answer becomes
  an entry:** the knowledge registers' own rules (`omni knowledge`, `omni check knowledge`); the
  record-or-principle line is the decisions form's (`where`). `pnpm check:registers`,
  `BR-TENANT-1`, `Kept id:`, `docs/delivery/outbox/README.md`, `docs/delivery/outbox/SETTLING.md`,
  `floorRank` in `scripts/outbox.mjs`.

## Changed

- "How we build … is not here" is reversed: the playbook now lives beside the registers, under the
  same front door, and the page names both halves.
- The three layers keep their one-line definitions: a principle is a person's decision about what
  the product should be; a rule says what may or may not happen and serves one principle; an
  invariant must always hold in the code.

## Added

- "Start here even when the knowledge lives elsewhere: anything kept somewhere else has a pointer
  here" (spec, "One knowledge root").
- **How a form is read:** the three layers, top wins (pointer, repository section, kit default), the
  `TODO(human)` hole, `omni kb show <form>` and `omni kb status` (spec, "How a section is resolved",
  decisions 2 to 4 and 7).
