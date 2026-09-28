# Plan: PRD page — a pinned compact header, full-width content, readable contrast

PRD #476. The spec is `spec.md` beside this plan. The feature branch `feat/prd-page-header` goes
into `main` with "Closes #476". Each slice is a sub-PR from `feat/prd-page-header--<slice>` into the
feature branch, with "Part of #476".

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Readable contrast on every Ask-coloured page: the `lineStrong` token and its 3:1 pairs, `.ask a.ask-button` dark on plasma, and outlines of chips, badges, cards, controls and tab bars moved to `--ask-line-strong` outside the dossier page | `packages/design/src/tokens*` `apps/galaxy/src/ask/` `apps/galaxy/src/nav/` `apps/galaxy/src/dashboard/` `apps/galaxy/src/docs/` `apps/galaxy/src/fleets/` `apps/galaxy/src/knowledge/` `apps/galaxy/src/releases/` `apps/galaxy/src/switch/` | — | 1 |
| s2 | The PRD page's header box (title row with the actions, the facts strip, the tabs), pinned from 900 × 700 px with rounds landing under it, the content at full width with a 900 px measure for prose, and no faded stages or tabs, outlined with `--ask-line-strong` | `apps/galaxy/src/dossier/page/` | s1 | 2 |

**Shared ground:** none. s1 owns every stylesheet but the dossier page's, and s2 owns only
`apps/galaxy/src/dossier/page/`. s2 waits for s1 because it draws with `--ask-line-strong`, which s1
adds, and because the Approve spec link relies on s1's `.ask a.ask-button` rule.

## Per slice: done when

### s1: contrast everywhere

- `ASK` in `packages/design/src/tokens.mjs` has `lineStrong` in all three themes: Omni `#5a60c4`,
  Light `#85819f`, Dark `#6d6acc`. `AskToken` in `tokens.d.mts` includes it.
- `ASK_UI_PAIRS` holds `lineStrong` on `ground`, `surface` and `sunk`, and
  `packages/design/src/tokens.test.mjs` passes with them at 3:1 or more.
- `themeCss()` emits `--ask-line-strong` for every theme, checked in `theme-tokens.test.ts`.
- `ask.css` has `.ask a.ask-button { color: var(--ask-on-plasma); text-decoration: none; }` with
  hover and focus, and a test asserts the rule. A link drawn as `.ask-button` renders dark on plasma
  and keeps the cyan focus outline.
- In every stylesheet of this slice's territory, borders outlining a chip, a badge, a card or panel,
  a control or a tab bar use `var(--ask-line-strong)`. Dividers keep `var(--ask-line)`: table
  cells, `hr`, rules between rows, and the app bar's bottom edge.
- No stylesheet in this territory dims text with `opacity` below 1.
- The existing colour lints pass (only `var(--ask-…)` colours), as does `pnpm test`.

### s2: the PRD page

- `DossierPage` renders one `header.dossier-head` box containing, in order:
  1. the title row: the title, then the actions (the stage's button, then Copy link, then Delete
     draft for a draft's opener);
  2. the facts strip, with its Stage, Repo/Repos, On GitHub and Opened cells, each shown exactly
     when the spec's §1 table says;
  3. `nav.dossier-tabs`.
  
  `render.test.ts` covers:
  - a PRD in every stage;
  - a draft: no On GitHub cell, and Delete draft for its opener;
  - demo mode: no Stage cell;
  - GitHub unknown: the Stage cell says so as a status.
  
  It keeps the class names the spec's Decisions list.
- The header box is `position: sticky; top: 0` only inside `@media (min-width: 900px) and
  (min-height: 700px)`, checked by a stylesheet lint in `page.test.ts`.
- A client component writes the box's height to `--dossier-head-h`. `.dossier-round` and the
  markdown headings use `scroll-margin-top: calc(var(--dossier-head-h, 0px) + 16px)`. The
  height-to-value function has a unit test.
- `.dossier` has no max-width. `.dossier-rounds`, `.outbox-items` and the before/after frame span
  it. `.dossier-md` and `.dossier-front` are capped at `900px`. Each is checked by a lint.
- `.stage-ahead` and `.dossier-tab-empty` have no opacity:
  - stages ahead and empty tabs read in `--ask-muted`;
  - tabs with content read in `--ask-ink`;
  - the current tab reads in `--ask-ink` with its plasma underline.
- Outlines in `dossier.css` of the header box, chips, badges, cards, controls and the tab bar use
  `--ask-line-strong`. Dividers keep `--ask-line`.
- In the browser, on PRD 459's page, in Omni, Light and Dark:
  - at 1920 × 1080 and 1280 × 720, the box pins and Approve spec is readable;
  - at 390 px, the box scrolls away;
  - cards span the width while spec text stops at 900 px;
  - coming back from `/ask/q/<round>`, the round lands below the box.
- `pnpm test` passes.
