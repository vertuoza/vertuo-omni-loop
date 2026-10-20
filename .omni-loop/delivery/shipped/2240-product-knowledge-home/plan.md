# Plan: A product's Knowledge home

PRD #2240, specified in `spec.md` beside this plan. Built on the feature branch
`feat/product-knowledge-home` into `main`, whose PR says `Closes #2240`; each slice is a sub-PR from
`feat/product-knowledge-home--<slice>` into the feature branch, saying `Part of #2240`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `product_knowledge_of()` gives each Legal and Glossary entry `createdBy`, `createdAt` and `updatedAt`, and the contract, the repository and the demo read them | `supabase/migrations/` `supabase/checks/product_knowledge.sql` `apps/galaxy/src/product-knowledge/product-knowledge.contract.ts` `apps/galaxy/src/product-knowledge/product-knowledge.repository` `apps/galaxy/src/product-knowledge/product-knowledge.service` `apps/galaxy/src/product-knowledge/KnowledgeTab.tsx` | — | 1 | deep |
| s2 | One shared `SortableList`: headers that sort through the address with `aria-sort`, empty values last, ties newest first, an unknown column falling back; the dashboard board sorts with it | `apps/galaxy/src/nav/SortableList` `apps/galaxy/src/nav/sortable-list` `apps/galaxy/src/dashboard/board/` | — | 1 | build |
| s3 | The Knowledge sub-menu (Constituents · Personas · Legal · Glossary · Pitch · Settings, with counts), Legal and Glossary as sortable lists with who and when, a Retired filter, a page per entry, and saves that keep the address | `apps/galaxy/src/product-knowledge/` `apps/galaxy/app/app/products/[id]/knowledge/` | s1, s2 | 2 | build |
| s4 | Constituents and Personas as Knowledge sections: sortable lists, a page per item, their forms and history moved whole; Settings › Business no longer shows them | `apps/galaxy/src/product-knowledge/constituents/` `apps/galaxy/src/product-knowledge/personas/` `apps/galaxy/app/app/products/[id]/knowledge/constituents/` `apps/galaxy/app/app/products/[id]/knowledge/personas/` `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` | s3 | 3 | build |
| s5 | Pitch as a Knowledge section; Settings has no Products tab; `/app/settings/products/<id>` and `/app/settings/products` redirect | `apps/galaxy/src/product-knowledge/pitch/` `apps/galaxy/app/app/products/[id]/knowledge/pitch/` `apps/galaxy/src/products/ProductPage.tsx` `apps/galaxy/src/products/ProductsScreen.tsx` `apps/galaxy/src/products/ProductsView.tsx` `apps/galaxy/app/app/settings/products/` `apps/galaxy/src/nav/section-tabs` | s3 | 3 | build |
| s6 | Settings as a Knowledge section: Region (shared by every product), the picks, the claim lists, To check and the draft from repos, moved whole; Settings › Business keeps only Add a product, Agent questions and Connect an agent | `apps/galaxy/src/product-knowledge/settings/` `apps/galaxy/app/app/products/[id]/knowledge/settings/` `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` | s4 | 4 | build |

**Shared ground.**

- `apps/galaxy/src/product-knowledge/` and `apps/galaxy/app/app/products/[id]/knowledge/`: s3 owns
  them whole and builds the frame (the sections table `knowledge-sections.ts`, the sub-menu, the
  header) with all six entries; s4, s5 and s6 each add only their own sub-folder under both. s3 is
  in wave 2, s4 and s5 in wave 3, s6 in wave 4. s4 and s5 own disjoint sub-folders.
- `apps/galaxy/src/product-knowledge/product-knowledge.contract.ts`, `.repository*`, `.service*`
  and `KnowledgeTab.tsx`: s1 widens them (wave 1), s3 reads them (wave 2).
- `apps/galaxy/src/business/` and `apps/galaxy/app/app/settings/business/`, with their tests
  (`render.test.ts`, `personas-render.test.ts`, `constituents-render.test.ts`, `check-render.test.ts`):
  s4 takes Constituents and Personas out (wave 3), s6 takes Region, the picks, the claims, To check
  and the draft bar out (wave 4). Each moved component keeps its file and its tests; only where it
  is drawn changes (the voice's objection).
- `apps/galaxy/src/nav/`: s2 adds `SortableList*` and `sortable-list*` (wave 1), s5 changes
  `section-tabs*` (wave 3); the prefixes are disjoint.

## Per slice: done when

### s1 (deep: a migration on a read function every Knowledge page uses) (`ui: yes`)

- A new migration, dated after the newest on `main` (`node scripts/migration-order.ts`), replaces
  `product_knowledge_of()` so each Legal and Glossary entry carries `createdBy` (`{user, login}` or
  null), `createdAt` and `updatedAt`, read from `product_legal` and `product_glossary`.
- `supabase/checks/product_knowledge.sql` asserts the three fields for a Legal and a Glossary entry.
- The zod contract parses them; the repository's and service's tests cover an entry with and without
  an author.
- The demo tab (`demoKnowledgeTab()`) gives its entries authors and dates.
- The Knowledge tab as it is today still renders and all its tests pass.

### s2 (`ui: yes`)

- `sortOf(params, columns, default)` and `sortRows(rows, sort)` are pure and tested: every column,
  both directions, empty values last whichever the direction, ties newest first, an unknown column
  or direction falling back to the default.
- `SortableList` renders a table whose headers are links keeping the rest of the query, the column
  in use marked `aria-sort`; a render test proves it.
- The dashboard board sorts through it, and its `sort.test.ts` and `render.test.ts` pass with the
  same behaviour.

### s3 (`ui: yes`)

- `/app/products/<id>/knowledge` shows the sub-menu Constituents · Personas · Legal · Glossary ·
  Pitch · Settings in that order, list sections with their count, and opens on Constituents.
- `/knowledge/legal` and `/knowledge/glossary` are `SortableList`s with the spec's columns; every
  header sorts both ways through the address; an entry with no author shows "—" and sorts last.
- `Active · n` and `Retired · n` filters (`?show=retired`); open proposals, the owner and delegate
  line and the naming control sit above the list; the add form below it.
- `/knowledge/legal/<code>` and `/knowledge/glossary/<entry>` show the whole entry, with Edit,
  Retire or Remove, or the propose controls, as the reader's role allows, and its history;
  `← Legal` returns with the sort kept; an unknown item is the 404 page.
- A save calls `router.refresh()`, not `window.location.reload()`, and stays on the same address.
- The `product-knowledge` and `product-knowledge-item` draft screens hold.

### s4 (`ui: yes`)

- `/knowledge/constituents` lists Statement and Never lines (Kind · Text · Created by · Created ·
  Updated), sortable; `/knowledge/constituents/<statement | never-n>` shows the line whole with its
  edit, remove and history from `ConstituentsPanel`.
- `/knowledge/personas` lists personas (Name · Stance · Trade · Created by · Created), sortable;
  `/knowledge/personas/<id>` shows the persona whole with its edit drawer and delete.
- Settings › Business renders neither Constituents nor Personas; a render test proves it.
- Every existing test of `ConstituentsPanel` and `PersonasSection` passes unchanged.

### s5 (`ui: yes`)

- `/knowledge/pitch` renders `PitchSection` for the product and saves as before (BR-PRODUCT-70:
  editable by whoever may edit the business).
- `SETTINGS_TABS` has no Products tab; its test says so.
- `/app/settings/products/<id>` answers 308 to `/app/products/<id>/knowledge/pitch`, and
  `/app/settings/products` 308 to `/app/products`; a test proves each.
- Every existing pitch-form test passes unchanged.

### s6 (`ui: yes`)

- `/knowledge/settings` shows Region marked "shared by every product" (a change changes it for every
  product), the picks, the claim lists, To check and the draft from repos, working as they did on
  Settings › Business.
- Settings › Business shows only Add a product, Agent questions and Connect an agent, with no
  product tabs; the `business-settings` draft screen holds; a render test proves it.
- Every existing test of the picks, the claims, To check and the draft passes unchanged.
