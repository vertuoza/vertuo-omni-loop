# Bug 3204: the visual check shoots the PRD page's before/after frame before it loads

## Triage

- **Domain:** the PRD page's screenshot test (`apps/galaxy/scripts/visual.ts`, PRD omni-loop-10) and the demo world it shoots
- **Risk:** low — whoever opens a UI pull request can get a red `visual` check that is not theirs and has to re-run it; nothing reaches users
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/design/visual-settle.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [ 'page fonts', 'shot' ] to deeply equal [ 'page fonts', 'navigated', …(3) ]`

## Fix

The harness shot a screen once its heading and fonts were ready, without waiting for its iframes. On
the Specifications tab, the before/after page is a sandboxed iframe that a cold dev server compiles on
its first request, so the first such shot sometimes caught it blank (23.86% of pixels). The wait
(`apps/galaxy/scripts/settle.ts`) now waits for each iframe to leave about:blank, load and ready its
fonts, and fails the run if one does not within two minutes. The demo's dates and the sidebar's
release also moved on every run: the harness now starts the demo with a pinned clock
(`OMNI_LOOP_DEMO_NOW`, read by `src/data/demo-clock.ts`), pins the browser's clock to the same moment,
and pins the release line, both to what the committed baselines show. No threshold or baseline changed.

## Guard

The reproduction is the guard: `visual-settle.test.ts` runs in `pnpm test` and fails if the wait lets a
shot through before a frame has loaded, or lets a frame that never loads be shot blank.

## Mutation

mutation: no changed core file against origin/main (56a9d1a9): nothing to mutate
