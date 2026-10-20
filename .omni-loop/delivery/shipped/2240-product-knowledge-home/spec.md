---
prd: 2240
title: A product's Knowledge home — six sections, sortable lists, a page per item
blocked-by: none
spec: file
phase0: server
---

## Problem

What agents read about a product is spread over three pages, and the one built for it reads badly.

- **The Knowledge tab** (`/app/products/<id>/knowledge`, PRD 1795) shows Legal and Glossary entries as
  rows of always-open inputs: a statement or a source law is cut off after a few words, the section
  gives no count, and nothing says who wrote an entry or when. Every save reloads the page.
- **Settings › Business** holds, per product behind a row of product tabs, the Constituents (PRD 1007),
  the Personas, the business picks (what you sell, customer size, trade, rivals), the claim lists and the
  draft-from-repos tool, under a Region shared by every product.
- **Settings › Products › <product>** holds the Pitch settings (PRD 859), and nothing else of its own.

A person who wants to know "what do agents know about this product" visits three places, and cannot
sort, count or read what they find.

## Solution

The product's Knowledge tab becomes the one home of everything agents read about the product, and the
other two places give it up entirely.

**A sub-menu** under the product's tab row, drawn by `SectionTabs` as a second row, in this order:
Constituents · Personas · Legal · Glossary · Pitch · Settings. Each list section shows its count of
active items. `/knowledge` opens Constituents.

**Four list sections,** each a table sortable by every column through the address
(`?sort=<column>&dir=asc|desc`), default newest first:

| Section | Address | Columns | A row opens |
|---|---|---|---|
| Constituents | `/knowledge/constituents` | Kind (Statement / Never) · Text · Created by · Created · Updated | `/knowledge/constituents/<displayId>` (`statement`, `never-3`) |
| Personas | `/knowledge/personas` | Name · Stance · Trade · Created by · Created | `/knowledge/personas/<id>` |
| Legal | `/knowledge/legal` | Code · Statement · Source law · Owner · Created by · Created | `/knowledge/legal/<code>` (`L-GDPR-1`) |
| Glossary | `/knowledge/glossary` | Term · Meaning · Created by · Created | `/knowledge/glossary/<entry>` |

A text cell shows one line and ends in "…". Retired, removed or deleted items leave the default list and
show behind a `Retired · n` filter (`?show=retired`). Proposals waiting on Legal or Glossary sit above
their list, with Approve and Reject for the section's owner or delegate. The owner and delegate line, and
the naming control for a workspace owner, sit at the top of Legal and Glossary as today. The add form
sits under the list.

**A page per item:** the full text, read-first; Edit opens the item's form, and Retire, Remove or Delete
as the item allows today; the item's history where one is kept (Constituents and Legal/Glossary events).
`← <Section>` returns to the list with its sort kept.

**Two form sections:**

- **Pitch** (`/knowledge/pitch`): today's Pitch editor (`PitchSection`), moved whole.
- **Settings** (`/knowledge/settings`): what fits nowhere else. Region (marked "shared by every
  product": a change changes it for every product), the picks, the claim lists, the "To check" list and
  the draft-from-repos tool, moved whole.

**What leaves the old places, with nothing left behind:**

- Settings › Business loses its product tabs, Constituents, Personas, Region, picks, claims, To check and
  draft bar. It keeps Add a product, Agent questions and Connect an agent.
- The Settings › Products tab is removed from `SETTINGS_TABS`. `/app/settings/products/<id>` redirects
  (308) to `/app/products/<id>/knowledge/pitch`, and `/app/settings/products` to `/app/products`.

**The data:** one migration widens `product_knowledge_of()` so each Legal and Glossary entry carries
`createdBy` (`{user, login}`), `createdAt` and `updatedAt`, read from the columns `product_legal` and
`product_glossary` already hold; the zod contract gains those fields. Constituents and Personas already
read `created_by` and `created_at`. Every write keeps its endpoint and RPC; after a save the page calls
`router.refresh()` in place of `window.location.reload()`, so the sort stays.

**One shared list:** the dashboard board's sort header (`src/dashboard/board/sort.ts`, `SortHeader` in
`Board.tsx`) is generalised into `SortableList`: a table whose headers are links carrying `aria-sort`,
with pure rules (`sortOf`, `sortRows`): an empty value sorts last whatever the direction, ties fall back
to newest first, an unknown column falls back to the default. The board moves onto it.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | route | `/app/products/<id>/knowledge/<section>` and `/<section>/<item>` | no written convention: follows `apps/galaxy/app/app/products/[id]/knowledge/graph/page.tsx` |
| vertuo-omni-loop | query string | `?sort=`, `&dir=` | no written convention: follows `apps/galaxy/src/dashboard/board/sort.ts` |
| vertuo-omni-loop | module | `knowledge-sections.ts`, `KnowledgeNav.tsx` in `src/product-knowledge/` | no written convention: follows `apps/galaxy/src/product-home/tabs.ts` |
| vertuo-omni-loop | component | `SortableList` in `src/nav/` | no written convention: follows `apps/galaxy/src/nav/SectionTabs.tsx` |
| vertuo-omni-loop | contract fields | `createdBy`, `createdAt`, `updatedAt` | no written convention: follows `apps/galaxy/src/product-knowledge/product-knowledge.contract.ts` (`proposedBy`, `proposedAt`) |
| vertuo-omni-loop | migration | `<timestamp>_product_knowledge_authors.sql` | `node scripts/migration-order.ts` (briefing › Never: newest on `main`) |

## Decisions

- **The design was approved section by section** in chat on 2026-10-20 (structure and addresses,
  components and data flow, errors and testing).
- **Approach:** an address per section and per item, sorted on the server through the address, over a
  single client page sorted in the browser: every view is shareable and Back works, as the board and the
  Engineering page already do.
- **An item opens its own page,** not a drawer (the person's pick).
- **Moved properly, no leftovers** (the person's words): the old sections are removed, not linked; only
  the old addresses redirect, so a bookmark still lands.
- **Region moves into each product's Knowledge › Settings** (the person's pick), shown as shared by
  every product; editing it there changes it for all.
- **Pitch and Settings stay forms,** not lists: each holds one set of values. (Assumed, said in the
  design, not contradicted.)
- **One PRD,** not two (the person's pick).
- **The voice objected (persona:F-E Developer):** "You're moving six sections and their write paths in
  one go. That's exactly where a regression ships quietly. I want every moved form to keep its existing
  tests passing, not get rewritten." Settled **accepted**: every moved component keeps its code and its
  tests; only the server page that draws it changes.
- **No proof video** (the person's answer). E2E validation is off in this repository.
- **The `product-knowledge` draft screen's open questions** are answered by this design: rows become
  read-first with an Edit on the item's page, and a change refreshes in place.

## User stories

- As a PM, I open my product's Knowledge tab and see, in one sub-menu, every kind of knowledge agents
  read about it, each with its count.
- As a legal owner, I sort the Legal list by Created, newest first, and see who added each entry.
- As any member, I click `L-GDPR-1` and read its whole statement and source law, then Edit it or propose
  an edit.
- As a PM, I edit the personas and the Pitch settings of a product from that product's page, not from
  Settings.
- As someone with an old bookmark to Settings › Products › <product>, I land on that product's
  Knowledge › Pitch.

## Scope

In:

- The sub-menu, the six section pages, the four item pages, `SortableList`, the board on it.
- The widened `product_knowledge_of()` and its contract.
- Removing the moved sections from Settings › Business and the Products tab from Settings, with the
  three redirects.
- The `product-knowledge` draft screen brought up to the after, and the drafts of its new pages.

Out:

- New kinds of knowledge, new fields on an item, a search box, pagination (lists are short: tens of
  items).
- Who-did-it for Pitch or the picks: `products` and `claims` keep no author per field; Settings shows
  none.
- The knowledge graph (`/knowledge/graph`): unchanged, reached from the header link as today.
- The kit's reads (`/api/constituents`, `/api/pitch-settings`): unchanged.

## Test seams

Following `omni kb show testing` (vitest, one run over the workspace; never calls GitHub):

- **Pure units:** `sortOf`/`sortRows` (every column, both directions, empty last, ties newest first,
  unknown column falls back); `knowledge-sections.ts` (order, addresses, counts); each section's row
  mapping (an item with no author reads "—").
- **Render tests** (as `personas-render.test.ts` does): each list page sorted by a column marks its
  header `aria-sort`; each item page shows the full text and its role's controls; the Business page
  renders none of the moved sections; `SETTINGS_TABS` has no Products tab.
- **Redirects:** the three old addresses answer 308 to their new address.
- **The database:** a `supabase/` check that `product_knowledge_of()` returns `createdBy`, `createdAt`
  and `updatedAt` for a Legal and a Glossary entry.
- **Every existing test** of `PersonasSection`, `ConstituentsPanel`, `PitchSection`, the picks and the
  claim lists keeps passing unchanged (the voice's objection).

## Risks

- **Publishes:** the moved screens on omni-loop.xyz once the feature PR merges, and one migration on the
  production database (an additive change to a read function). Rollback: revert the feature PR; the
  migration only adds fields to a JSON answer, so the old page ignores them and no down-migration is
  needed (`omni kb show releasing`).
- **Bookmarks:** the three redirects keep old links working; a link into a removed Business section
  (an anchor) lands on the Business page.
- **A moved form loses its wiring:** guarded by the existing tests kept unchanged.
- **The locked laws** `omni kb laws` prints for the files this design changes:
  - BR-PRODUCT-3, BR-PRODUCT-5, BR-PRODUCT-6, BR-PRODUCT-12, BR-PRODUCT-28, BR-PRODUCT-29,
    BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-63, BR-PRODUCT-64, BR-PRODUCT-94, N-PRODUCT-3, N-PRODUCT-4,
    N-PRODUCT-7, N-PRODUCT-8, N-PRODUCT-13, N-PRODUCT-14, N-PRODUCT-15, N-PRODUCT-16: printed for every
    path, none changed by this design. Changing any of them needs @pierrederval to approve the pull
    request on GitHub.
  - N-PRODUCT-17: no secret is ever sent to the browser. If broken, anyone opening the page could read a
    database key. The new section pages load on the server and send the browser only the rows they
    show. Changing it needs @pierrederval to approve the pull request on GitHub.
- **Rules it reads:** BR-PRODUCT-67 (a Statement is one line of at most 400 characters) and BR-PRODUCT-70
  (the pitch look is editable by whoever may edit the business) hold unchanged on their new pages.

## Acceptance criteria

1. `/app/products/<id>/knowledge` shows a sub-menu Constituents · Personas · Legal · Glossary · Pitch ·
   Settings, the list sections with their count, and opens on Constituents.
2. Each of the four list sections is a table whose every column header sorts it, both ways, through the
   address; the header in use carries `aria-sort`; reloading the address keeps the sort.
3. Legal and Glossary rows show who created the entry and when; an entry with no author shows "—" and
   sorts last.
4. Clicking a row opens its own page with the whole text; Edit, Retire/Remove/Delete and proposals work
   there as they do today for the reader's role; `← <Section>` returns to the list with its sort.
5. Retired or removed items are out of the default list and listed under `Retired · n`.
6. `/knowledge/pitch` edits the Pitch settings; `/knowledge/settings` edits Region (marked shared by
   every product), the picks and the claims, and runs the draft-from-repos tool.
7. Settings › Business shows only Add a product, Agent questions and Connect an agent; Settings has no
   Products tab.
8. `/app/settings/products/<id>` answers 308 to `/app/products/<id>/knowledge/pitch`, and
   `/app/settings/products` to `/app/products`.
9. A save on any section keeps the reader on the same address and sort, without a full page reload.
10. Every existing test of the moved components passes unchanged.
