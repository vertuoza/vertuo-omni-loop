---
prd: 533
title: Roomier questions list
blocked-by: none
spec: file
---

# Roomier questions list

**Date:** 2026-09-29 · **PRD:** #533 · **Touches:** the Questions tab's styles in
`apps/galaxy/src/dossier/page/dossier.css`, and a new style test beside it. No markup, no logic, no
migration, no change to the kit or to the GitHub App.

## Problem

The Questions tab of a PRD page (`/prd/<id>`, `QuestionsPane.tsx`) lists the rounds asked while the
PRD was shaped and built. Each round is one outlined list row that unfolds into its questions and
answers. The rows feel cramped. A round's line has 12px of padding above and below, and 16px at the
sides. An unfolded round's answer begins 4px under that line, and its lines run at the browser's
default height (about 1.4). The "asked by" footer sits right under the answer. The "11 of 11
answered" strip sits 16px above the list's border. A long answer reads as one dense block, pressed
against the edges of the list.

## Solution

More breathing room, with the same layout. This is direction **B · Roomier**, picked from a
full-size page that switched between five directions.

| Where | Today | After |
|---|---|---|
| Space between the "answered" strip and the list | 16px (the pane's gap) | 20px: the strip gets `margin-bottom: 4px` |
| A round's line (`.dossier-round-line`) | `padding: 12px 16px` | `padding: 16px 24px` |
| An open round's line (`.dossier-round[data-state='open'] .dossier-round-line`) | `padding-left: 38px` | `padding-left: 46px`, so its dot keeps its place under the folded rounds' ✓ |
| A round's body (`.dossier-round-body`) | `gap: 12px; padding: 4px 16px 14px 44px` | `gap: 16px; padding: 4px 24px 22px 52px`, so the text still starts under the round's title |
| An answered question's line (`.dossier-q-line`) | default line height | `line-height: 1.6` |
| A round's footer (`.dossier-round-foot`) | no space of its own | `padding-top: 4px` |

The phone view (under 720px) keeps the padding it has today (`.dossier-round-line { padding: 10px
12px; }`, `.dossier-round-body { padding: 4px 12px 12px; }`). A phone has no width to spare.

## Decisions

- B over C (the answer stacked on its own line), D (separate cards) and E (a lighter step): the
  person picked B from the lab. The layout stays the same, and only the spacing changes.
- The strip's extra space is added to the strip (`margin-bottom: 4px`), not to `.dossier-pane`'s
  gap, which the other tabs share.
- The left padding moves with the side padding (+8px on each), so the body text stays aligned under
  the round's title, and an open round's dot stays aligned under the ✓ marks.
- The phone rules are not touched.

## User stories

- As someone reading a PRD's questions, I can tell each round apart, and an unfolded answer reads
  as separate lines, not one dense block.
- As someone on a phone, the list looks as it does today.

## Scope

In: the Questions tab's spacing rules in `dossier.css`, and a style test for them.

Out: the questions' markup, the one-line answered layout, colours, the Outbox tab's cards (which
share `.dossier-round-top` only), the phone rules, and the question's own page (`/ask/q/…`).

## Test seams

Following `omni kb show testing`: tests live beside the code as `*.test.ts` and run with
`pnpm test`; none calls GitHub or Supabase. A UI change is covered by a page or style test, plus a
manual browser pass for the visual risk.

- `apps/galaxy/src/dossier/page/questions-style.test.ts` reads `dossier.css` as text, the way
  `head-style.test.ts` does. For each selector in the Solution table, it checks the new value. It
  also checks that the phone rules under `@media (max-width: 719.98px)` still read
  `padding: 10px 12px` for the line and `padding: 4px 12px 12px` for the body.
- The existing `render.test.ts` and `page.test.ts` stay green. No markup changes.
- Manual: open a PRD's Questions tab on a desktop width and a phone width, and unfold an answered
  round and an open one.

## Risks

A merge to `main` changes the look of every PRD page's Questions tab in the arcade (`apps/galaxy`).
No data, API or kit change. To roll it back, revert the merge commit.

## Acceptance criteria

- On a desktop width, a round's line has 16px of padding above and below and 24px at the sides.
- An unfolded round's body has 24px of padding on the right, 22px at the bottom and 52px on the
  left, with 16px between its questions.
- An answered question's line has a line height of 1.6, and the footer has 4px of padding above it.
- The "answered" strip sits 20px above the list.
- An open round's dot sits in the same column as the folded rounds' ✓.
- Under 720px wide, the line and body padding are unchanged from today.
- `pnpm test` is green.
