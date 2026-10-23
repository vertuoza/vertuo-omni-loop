# Plan: Anti-loop placeholder

PRD #2490, from the spec beside this plan (`spec.md`). It is built on the feature branch
`feat/anti-loop-placeholder` into `main`, whose feature PR says `Closes #2490`. Each slice is a
sub-PR from `feat/anti-loop-placeholder--<slice>` into the feature branch, saying `Part of #2490`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `@omni/design` holds the Rewind Light tokens for the three themes, AA-tested, and draws the crest mirrored with its ring in the anti-loop colour | `packages/design/src/tokens` `packages/design/src/logo` `packages/design/src/index` | — | 1 | build |
| s2 | `/anti` and `/anti/work` open the anti-loop mode: the shell in Rewind Light, the ANTI LOOP lockup, the Anti-loop menu and trail, the top bar's Anti-loop / Omni loop switch, and the two placeholder pages | `apps/galaxy/app/anti/` `apps/galaxy/src/anti/` `apps/galaxy/src/nav/` `apps/galaxy/src/switch/AntiLoopButton` `apps/galaxy/src/ask/theme-tokens` | s1 | 2 | build |

No prefix is declared by more than one slice: s2 reads what s1 exports and comes in the next wave.
The generated `apps/omni-app/api/` bundle, built from `packages/design/`, is in no territory: the
wave rebuilds it once after merging.

## Per slice: done when

### s1 (`ui: yes`)

- `ASK_ANTI` is exported from `@omni/design`: per theme (`omni`, `light`, `dark`), the overrides of
  `line`, `lineStrong`, `plasma`, `plasmaSoft`, `onPlasma`, `yellow` and `onYellow`, with the values
  of the spec's table; every other token is left to `ASK`.
- `tokens.test.ts` runs every `ASK_TEXT_PAIRS` pair at 4.5:1 and every `ASK_UI_PAIRS` pair at 3:1 on
  each theme with its anti-loop overrides applied, and passes. A value changed to pass is named in
  the spec's **Decisions** as an outbox item.
- `logoSvg(form, { mirror: true })` returns the drawing's pixels reversed column for column, its ring
  in the anti-loop signal colour, at whole-number scales only; without `mirror`, every existing
  drawing is byte for byte as before (`logo.test.ts`).
- `pnpm --filter @omni/design tokens` leaves `packages/design/tokens.css` unchanged.

### s2 (`ui: yes`)

- `/anti` renders Anti-dashboard and `/anti/work` renders Anti-work inside `AppShell` with
  `mode="anti"`, read per request with the same viewer as `/app`, not indexed; each page shows its
  title and its two lines from the spec, and nothing else (a render test per page).
- `AppShell` marks its root `data-ask-mode="anti"` in mode `anti` and nothing in mode `omni` (the
  default); `themeCss()` emits each theme's `ASK_ANTI` declarations only under a root marked so, and
  an unmarked root is unchanged (`theme-tokens.test.ts`).
- `ANTI_SIDEBAR` holds one group, Anti-loop, with Anti-dashboard (`/anti`) and Anti-work
  (`/anti/work`), each with a 16 px sprite; the sidebar in mode `anti` draws it in place of Dashboard
  and Work and keeps the foot (Settings, Docs, Release notes); `currentItem` and `pageTrail` read
  `/anti` and `/anti/work` as those entries and the trail `Anti-loop › …`, and every forward path
  reads as before (`sidebar.test.ts`).
- The top bar shows `AntiLoopButton` beside Game mode: a link reading `Anti-loop` to `/anti` on a
  forward page and `Omni loop` to `/app` in mode `anti` (the top bar's test).
- In mode `anti` the lockup reads `ANTI LOOP` then the mirrored crest from s1, linked to `/anti`.
- `design-system.test.ts` and `page-width.test.ts` stay green, nothing is written to a cookie or to
  local storage, and the screens `app-shell`, `anti-dashboard` and `anti-work` match their drafts.
