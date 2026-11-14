# Bug 2838: the Search overview scrolls sideways on a phone

## Triage

- **Domain:** the product Knowledge home's Search section, `apps/galaxy/src/product-knowledge/search/` (PRD omni-loop-6 s3, and its Eval view, PRD omni-loop-8)
- **Risk:** low — a reader on a phone sees the Search overview (681 px at 390) and its Eval view (665 px) wider than the screen; they can scroll sideways or turn the phone, and nothing is lost.
- **Regression:** new bug — no evidence this ever worked (the overview shipped in #2772 with its tables wrapped in a region that lets them widen the page)

## Reproduction

- **File:** `apps/galaxy/src/product-knowledge/search/search-phone.render.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ false, false ] to deeply equal [ true, true ]`

## Fix

Each wide table of the Search pages sits in its own scrolling box (`kn-scroll`), but on the overview and the Eval
view that box sits in a plain `data-region` wrapper, a grid item of the section card. A grid item is never narrower
than its content unless it may shrink, and the card's `justify-items: start` sized it to its table, so at 390 px the
overview grew to 681 px and the Eval view to 665 px. `[data-region]` now sets `width: 100%; min-width: 0`, as
`.kn-repo` does, so the table scrolls inside its box; measured in Chromium at 390 px on the demo, the overview, the
Categories view and the Eval view are all 390 px wide. The Categories view had no such wrapper and already fitted.

## Guard

The reproduction is the guard: it renders the overview and the Eval view and fails when an element between a
`kn-scroll` box and its card is matched by no rule that sets both `width: 100%` and `min-width: 0`.

## Mutation

mutation: no changed core file against origin/main (7c51c838): nothing to mutate
