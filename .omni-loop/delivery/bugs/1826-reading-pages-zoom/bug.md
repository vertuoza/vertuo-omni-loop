# Bug 1826: the app's reading pages cannot be zoomed on a phone

## Triage

- **Domain:** the galaxy app's reading surface (`/app`, `/prd`, `/ask`, `/docs`, `/knowledge` and the other app-shell sections)
- **Risk:** medium — people reading on a phone cannot zoom small text. There is a workaround: the desk, which is the main surface, or the browser's own accessibility zoom override.
- **Regression:** new bug — no evidence this ever worked. The no-zoom viewport came with the Game Boy (PRD 94, #95), before the app pages existed (#239).

## Reproduction

- **File:** `apps/galaxy/src/ask/reading-viewport.test.ts`
- **Red:** AssertionError: expected false to be true // Object.is equality (12 failed, one per reading layout: "lets a person zoom the page")

## Fix

The root layout's viewport turns zoom off for the Game Boy, and every reading section inherited it, because its own viewport set only the theme colour. The 12 reading layouts now share one viewport, `READING_VIEWPORT` in `apps/galaxy/src/ask/reading-viewport.ts`, which also sets `maximumScale: 5` and `userScalable: true`. Next merges it over the root's viewport key by key, and the arcade keeps its own.

## Guard

The same test lists every section whose layout exports a viewport, and fails unless each one is either a reading section (which must allow zoom) or named as not one (`/design`). A new section therefore cannot ship with the arcade's no-zoom viewport without someone deciding it.

## Mutation

mutation: no changed core file against origin/main (62501b33): nothing to mutate
