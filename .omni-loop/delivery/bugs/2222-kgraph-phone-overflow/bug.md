# Bug 2222: the knowledge graph page overflows sideways on a phone once a node is opened

## Triage

- **Domain:** the product knowledge graph page, `apps/galaxy/src/knowledge-graph/tab/` (PRD 1798 s6)
- **Risk:** low — a reader on a phone sees a page wider than the screen, with ids and edges cut on the right, once a node is opened; they can still scroll sideways or turn the phone, and nothing is lost.
- **Regression:** new bug — no evidence this ever worked (the page shipped in #2172 with no wrapping for long ids)

## Reproduction

- **File:** `apps/galaxy/src/knowledge-graph/tab/graph-page.render.test.ts`
- **Red:** `AssertionError: expected { heading: false, statement: false } to deeply equal { heading: true, statement: true }`

## Fix

A node id such as `vertuo-omni-loop/BR-PRODUCT-120` holds no break, and nothing on the graph page let a
line break inside one, so at 390 px the opened node's heading, its statement and its edge lines widened
the cards, and the Search button with them, to 469 px. The page's root now carries `kgraph`, whose rule
sets `overflow-wrap: anywhere`, inherited by every line of the page; measured in Chromium at 390 px, the
page went from 484 px wide to 390 with no element past the window.

## Guard

The reproduction is the guard: it renders the page with a long id opened and fails when the heading, the
statement or an edge line sits in no element whose stylesheet rule lets a long word break.

## Mutation

mutation: no changed core file against origin/main (e07addcc): nothing to mutate
