---
prd: 476
title: PRD page — a pinned compact header, full-width content, readable contrast
blocked-by: none
spec: file
---

# PRD page — a pinned compact header, full-width content, readable contrast

**Date:** 2026-09-28 · **PRD:** #476 · **Follows:** PRD 216 (dossiers), PRD 426 (the stage header),
PRD 438 (the app shell) · **Touches:** the galaxy app only:
- the dossier page, `apps/galaxy/src/dossier/page/` (`DossierPage.tsx`, `StageHeader.tsx`,
  `StageHeaderCopy.tsx`, `dossier.css`)
- the ask pages' stylesheets that draw outlines (`src/ask/ask.css`, `src/ask/page/*.css`,
  `src/nav/*.css`)
- the Ask colour tokens in `packages/design/src/tokens.mjs`

No migration, and no change to the kit, the game or the GitHub App.

## Problem

The PRD page (`/prd/<id>`) is dense, and its layout works against it (seen on PRD 459's page, Omni
theme, 1920 px screen):

- **The header does not read as a header.** The title, the stage track, "Stage: PRD", the button,
  the GitHub links, the repository, "opened by" and Copy link sit as loose lines on the page's
  background. Nothing separates them from the tabs and content below. Copy link floats on its own
  on the far right.
- **Approve spec is unreadable.** It is an `<a class="ask-button">`. The link rule `.ask a` (cyan,
  underlined) outranks `.ask-button`, so the label is cyan on plasma. The contrast is 1.03:1 on Omni
  (cyan on yellow), 1.24:1 on Light and 2.15:1 on Dark. Review & merge, Read the retro and Answer
  the outbox are drawn the same way.
- **The content stays narrow.** `.dossier` stops at 1180 px, and the question cards, the outbox
  items, the spec and plan text and the front matter stop at 780 px, left-aligned. On a wide screen
  more than half of the content area is empty, while the cards wrap every line.
- **The contrast is low.** The grey text itself passes. What fails:
  - The stages ahead (inbox → retro) are faded with `opacity: 0.6`, about 3.05:1 on Omni and
    2.71:1 on Light.
  - The empty tabs (Outbox, Retro) are faded with `opacity: 0.55`, about 2.72:1 and 2.45:1.
  - `--ask-line` is the only outline of the stage chips, the repository chip, the category badges,
    the cards and the controls. It reaches only 1.29–1.56:1 against the page and the cards, in every
    theme and on every page that uses it.

## Solution

### 1. One header box, in three rows

`DossierPage` renders a single `<header class="dossier-head">`. It is a box on `--ask-surface`,
with a `--ask-line-strong` border and rounded corners, holding three rows in this order:

1. **The title row.** On the left, the existing title: `PRD #n ↗` linking to the issue, or `DRAFT`,
   then the title. On the right, the actions, in this order:
   - the stage's one button, when there is one (Approve spec, Build it with its command, Review &
     merge, Answer the outbox, Read the retro);
   - **Copy link**;
   - **Delete draft**, on a draft, for the person who opened it.
   
   When the row is too narrow, the actions wrap below the title rather than squeeze it.
2. **The facts strip.** A row of labelled cells, split by `--ask-line-strong` rules. Each cell has
   a small uppercase label and a value:

   | Label | Value | Shown when |
   |---|---|---|
   | **Stage** | the six-stop track, then the stage in words and its caption (`Stage: outbox · Being built · 2/5 slices`), or `Stage unknown: GitHub did not answer.` as a status | a stage is known or unknown, not in demo mode |
   | **Repo** (**Repos** for more than one) | each repository as a chip, as today | always |
   | **On GitHub** | the issue, phase-0, feature and retro links that exist, each with `open` or `✓` | at least one link exists |
   | **Opened** | who opened it and when (the existing `opened` string) | always |

   A cell with nothing to show is left out, not drawn empty. The cells share the row and wrap to
   more rows as the width shrinks: one column on a phone.
3. **The tabs.** The existing artifact tabs move inside the box, on its bottom edge. The current tab
   keeps its plasma underline.

The live-update notice and the tab's pane follow the box, outside it.

### 2. Pinned while you scroll, on large screens

From 900 px wide **and** 700 px tall, the header box is `position: sticky` at the top of the page's
scroll, above the content (a z-index under the app's drawer and dialogs). It stays in view while
you read a long spec, so the stage, Approve spec and the tabs are always in reach. Below either
size it scrolls away with the page: pinned on a phone, it would take half the screen.

While it is pinned, a question card that the way back from `/ask/q/<round>` scrolls to lands just
under the box, not behind it. A small client component measures the box and writes its height to
`--dossier-head-h` on the page. Each round's `scroll-margin-top` is `calc(var(--dossier-head-h) +
16px)`. Without JavaScript, the variable falls back to 0 and the margin to 16 px, as today.

### 3. Button-shaped links read as buttons

One rule in `ask.css`, `.ask a.ask-button { color: var(--ask-on-plasma); text-decoration: none; }`,
with its hover and focus states, fixes every link drawn as `.ask-button` on every Ask/PRD page.
Approve spec and the other stage links become dark on yellow on Omni and meet their `onPlasma` on
`plasma` pair (14.4:1 Omni, 7.2:1 Light, 6.4:1 Dark). Focus keeps the cyan outline.

### 4. Full width, with a reading measure for prose

- `.dossier` loses its 1180 px cap and takes the whole content area.
- The question cards (`.dossier-rounds`), the outbox items (`.outbox-items`) and the before/after
  frame use the full width of `.dossier`.
- Long prose keeps a measure: the rendered spec and plan (`.dossier-md`) and the front-matter line
  (`.dossier-front`) are capped at **900 px** (up from 780 px), left-aligned under the header. Their
  tables and code blocks still scroll within that measure.
- The PRD list (`/prd`, `.dossier-history`) is unchanged.

### 5. Contrast, on every page using the Ask colours

- **A new token, `lineStrong`**, in `ASK` for each theme: Omni `#5a60c4`, Light `#85819f`,
  Dark `#6d6acc`. It is exposed as `--ask-line-strong` by `themeCss()`. It reaches at least 3:1
  against `ground`, `surface` and `sunk` in every theme:

  | Theme | on ground | on surface | on sunk |
  |---|---|---|---|
  | Omni | 3.71 | 3.38 | 3.47 |
  | Light | 3.41 | 3.72 | 3.14 |
  | Dark | 4.08 | 3.72 | 3.42 |

  These three pairs join `ASK_UI_PAIRS`, so the existing token test guards them.
- **What uses it.** Across the galaxy app's stylesheets on the Ask colours (`src/ask/**`,
  `src/dossier/**`, `src/nav/**`, and every other stylesheet using `var(--ask-line)`), every
  border that outlines something the eye must find switches from `--ask-line` to
  `--ask-line-strong`:
  - a chip or badge (stage stops, repository, category, verdict, a key cap);
  - a card or panel (question round, outbox item, history row, filters, the header box);
  - a control (buttons with an outline, inputs, selects, the theme switch, the ☰ menu, Mine / All);
  - the tab bar's baseline.
  
  Borders that only divide content keep `--ask-line`: table cells, `hr`, the rule under a markdown
  `h2`, the line between two questions in one round, and the app bar's bottom edge.
- **No faded text.** `.stage-ahead` and `.dossier-tab-empty` lose their opacity:
  - Stages ahead read in `--ask-muted` (at least 6.1:1).
  - A tab with content reads in `--ask-ink`.
  - The current tab reads in `--ask-ink` with its plasma underline.
  - An empty tab reads in `--ask-muted`, so the difference is kept without failing contrast.
  
  No stylesheet in the app dims text with `opacity` below 1.

## Decisions

- **E, the compact bar with a facts strip,** out of five directions drawn on 2026-09-28 (a framed
  panel, a masthead band, story + facts, an arcade ticket, the compact bar). It was picked by the
  person with the idea.
- **Pinned only from 900 × 700 px.** 900 px is the width where the sidebar stops being a drawer
  (`src/nav/drawer.ts`). 700 px keeps a laptop's pinned box under about a third of the screen.
- **Full width with a 900 px measure for prose,** chosen over full width everywhere and over a wider
  centred column.
- **The contrast fix is app-wide,** chosen over the PRD page only. It is done with a new token
  rather than a stronger `line`, so dividers stay quiet and only the outlines that mark things get
  stronger.
- **Class names the tests read are kept:** `stage-track`, `stage-stop stage-*`, `stage-words`,
  `ask-button stage-action`, `stage-links`, `dossier-repo`, `dossier-tabs`, `dossier-tab`,
  `ask-button` for Copy link. The markup around them moves.

## User stories

- As someone reading a PRD's page, I see at a glance where its header ends and its content begins.
  The title, what to do next and the facts are in one box.
- As the person who must approve a spec, I can read **Approve spec** in every theme, and I can reach
  it without scrolling back up, however long the spec I am reading.
- As someone reading a brainstorm with many questions on a wide screen, the question cards use the
  width, so each wraps onto fewer lines.
- As someone reading the spec, its lines still stop at a comfortable length.
- As anyone on an Ask or PRD page in any theme, I can make out the chips, badges, cards, controls
  and the stages ahead without straining.

## Scope

In:
- The dossier page's header (§1, §2), its widths (§4), and the fading of its stages and tabs (§5).
- The `.ask a.ask-button` rule (§3).
- The `lineStrong` token, its pairs, and its use for outlines across the galaxy app's
  stylesheets that use the Ask colours (§5).

Out:
- The PRD list at `/prd`: its layout, and its 880 px width.
- The sidebar's and the app bar's layout.
- The arcade (game) screens, and the kit.
- Any new data on the page: the header shows exactly what the page shows today.

## Test seams

Following `omni kb show testing`: vitest, tests beside the code, and no call to GitHub or Supabase.

- **Tokens** (`packages/design/src/tokens.test.mjs`): `lineStrong` exists in all three themes, and
  `lineStrong` on `ground`, `surface` and `sunk` are in `ASK_UI_PAIRS` and reach 3:1. This comes
  free from the existing loop over the pairs, once they are added.
- **Header markup** (`apps/galaxy/src/dossier/page/render.test.ts`, via `renderToStaticMarkup`):
  - The header box holds the title row, the facts strip and the tabs, in that order, and the
    actions sit in the title row: stage button, then Copy link, then Delete draft for the opener of
    a draft.
  - The Stage, Repo/Repos, On GitHub and Opened cells show exactly when §1's table says. A draft
    has no On GitHub cell, and demo mode has no Stage cell.
  - Every existing stage test still passes, with its regexes changed only where the markup around
    the kept class names moved.
- **Stylesheet lints** (`apps/galaxy/src/dossier/page/page.test.ts`,
  `apps/galaxy/src/ask/theme-tokens.test.ts`):
  - `ask.css` has an `.ask a.ask-button` rule setting `color: var(--ask-on-plasma)` and
    `text-decoration: none`.
  - No stylesheet under `apps/galaxy/src` sets `opacity` below 1 on `.stage-ahead` or
    `.dossier-tab-empty`, or on any text.
  - `dossier.css` has no `max-width` on `.dossier`, `.dossier-rounds` or `.outbox-items`, and
    `900px` on `.dossier-md` and `.dossier-front`.
  - The header's sticky rule sits inside a `(min-width: 900px) and (min-height: 700px)` media query.
  - The existing "only `var(--ask-…)` colours" lints keep passing.
- **The head-height measure:** a unit test of the small function that turns a measured height into
  the `--dossier-head-h` value. The ResizeObserver wiring is checked in the browser.
- **In the browser** (manual): PRD 459's page, in Omni, Light and Dark, at 1920 × 1080, 1280 × 720
  and a 390 px phone. The box is pinned at 1920 and 1280 but not on the phone. Approve spec is
  readable. The cards span the width while the spec text stops at 900 px. Coming back from
  `/ask/q/<round>`, the round lands under the pinned box.

## Risks

- **What a merge publishes** (`omni kb show releasing`): no migration, and the kit is untouched.
  The galaxy app is a Vercel project imported from this repository, so a merge to `main` changes the
  live Ask and PRD pages once Vercel deploys it. Rollback is a revert of the feature PR, since
  nothing is stored.
- **The token change reaches every page on the Ask colours.** An outline switched to
  `--ask-line-strong` by mistake, on a divider, makes that page look heavier. The browser pass looks
  at `/app`, `/ask`, `/ask/history`, `/prd`, `/knowledge`, `/docs` and `/releases` in the Omni
  theme to catch it.
- **A pinned header hides content under it.** Anchors inside the pane (a markdown heading link, a
  round) must clear it, and §2's `scroll-margin-top` covers the rounds. Markdown headings get the
  same margin.
- **Sticky can fail silently** when an ancestor sets `overflow` other than `visible`. The browser
  pass checks the box really pins inside the app shell.

## Acceptance criteria

1. On `/prd/<id>`, the title, the stage's button, Copy link, the facts (Stage, Repo, On GitHub,
   Opened) and the tabs are inside one bordered box, in the three rows of §1. Nothing that belonged
   to the header is left outside it.
2. The Approve spec label is `--ask-on-plasma` on `--ask-plasma` and not underlined, in Omni, Light
   and Dark. The same holds for every other stage link and for any `a.ask-button` on the Ask pages.
3. At 900 px wide and 700 px tall or more, scrolling a long Spec tab keeps the header box in view at
   the top. Below 900 px wide, or below 700 px tall, it scrolls away.
4. Coming back from a question's own page to its round, the round's top is visible just below the
   pinned box.
5. At 1920 px, question cards and outbox items span the content area's width, and the spec and plan
   text stop at 900 px.
6. `lineStrong` exists in every theme and reaches 3:1 on ground, surface and sunk, checked by the
   token test. Chips, badges, cards, controls and the tab bar outline with it on every Ask-coloured
   page, and dividers keep `line`.
7. No text on these pages is dimmed with `opacity`. The stages ahead and the empty tabs read in
   `--ask-muted`.
8. A draft shows DRAFT, no On GitHub cell and, for its opener, Delete draft in the title row. Demo
   mode shows no Stage cell. When GitHub did not answer, the Stage cell says so as a status.
9. `pnpm test` passes.
