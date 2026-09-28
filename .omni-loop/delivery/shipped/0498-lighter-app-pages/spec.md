---
prd: 498
title: Lighter app pages — edge-to-edge PRD header, clearer top bar, full width, folded questions
blocked-by: none
spec: file
---

# Lighter app pages — edge-to-edge PRD header, clearer top bar, full width, folded questions

**Date:** 2026-09-28 · **PRD:** #498 · **Follows:** PRD 438 (the app shell), PRD 476 (the pinned
PRD header, `lineStrong`) · **Touches:** the galaxy app only:
- the app shell: `apps/galaxy/src/nav/app-bar.css` and `src/ask/ask.css` (`.ask-main`, `.ask-col`, `.ask-page`)
- the PRD page: `src/dossier/page/` (`dossier.css`, `QuestionsPane.tsx`, `view.ts`, `DossierPage.tsx`)
- the width caps of the app's pages: `src/dashboard/dashboard.css`, `src/knowledge/knowledge.css`,
  `src/docs/docs.css`

No migration, no new token, and no change to the kit, the game or the GitHub App.

## Problem

Seen on PRD 476's page (Light theme, a 1920 px screen, 2026-09-28):

- **Boxes inside boxes.** The PRD header is a rounded, outlined box inside the page's padding. Below it,
  each question round is another outlined box with a thick left edge. Inside that, every chosen
  option is a third box, filled with plasma-soft. The page reads as a stack of frames, not as content.
- **The top bar does not stand out.** `.app-bar` has no background of its own. Its only edge is a 1 px
  `--ask-line`, about 1.3:1 against the page, so the bar and the page run together.
- **Only the PRD page is full width.** PRD 476 freed `/prd/<id>`. Every other page still stops at a cap
  and is centred in the space:
  - Home stops at 960 px.
  - The PRD list stops at 880 px.
  - Questions stops at 1180 px, and at 680 px when there are no tabs.
  - Shared with me, History and Fleets stop at 680 px.
  - Knowledge stops at 1180 px.
  - Docs stops at 1180 px.
  - On a wide screen, most of the content area is empty.
- **The questions are heavy.** Every answered round repeats its full card: the rule badge, the
  category, "asked by", each question with a header chip, the chosen option as a purple box with its
  description, the outcome, the context line and "Open the question". PRD 476's page has four rounds,
  and it already scrolls for three screens.
- **What is left to answer is not clear.** The tab says `4/4 answered`, but it counts rounds, not
  questions. A round of three questions counts as one. An open round looks like an answered one,
  except that every option is shown unselected and a small "not answered yet" sits at its foot. With
  ten rounds, finding the ones still waiting means reading them all.

## Solution

### 1. The PRD header runs edge to edge

The header `.dossier-head` (PRD 476) keeps its three rows, its content, its class names and its
pinning. What changes is its frame:
- It has no rounded corners, no left, right or top border, and no margin. It touches the top bar
  above it, the sidebar on its left (the drawer's edge below 900 px) and the window's right edge.
- It keeps its `--ask-surface` background and gains one bottom border: 1.5 px `--ask-line-strong`.
- Its rows keep the page's side padding (§3), so the title and the tabs line up with the content
  below.
- **Every line in it runs edge to edge.** The rule above the tabs spans the header's full width, not
  the padded width. The same goes for the header's bottom border. The tabs themselves sit inside the
  padding.

The page content under the header is spaced from it by the page's usual gap.

### 2. The top bar stands out: surface and a strong rule (T1)

`.app-bar` gets `background: var(--ask-surface)` and `border-bottom: 2px solid var(--ask-line-strong)`,
on every page that has the app shell and in the three themes:
- On Light it is white on the off-white page.
- On Dark it is `#16144a` on `#0e0d33`.
- On Omni it is the cabinet's navy on the void.

`lineStrong` already reaches at least 3:1 against `ground` and `surface` in every theme (PRD 476), so
no new pair is needed. Nothing else in the bar changes: its title, the theme switch, Game mode, the
avatar and its wrapping below 900 px stay as they are.

This replaces PRD 476's rule that the app bar's bottom edge stays on `--ask-line`.

### 3. Every page is full width, and prose keeps a 900 px column

- **Containers lose their caps.** Each of these becomes `width: 100%` with no `max-width`, and is
  aligned to the start of `.ask-main` rather than centred:
  - `.dash` (Home)
  - `.dossier-history` (the PRD list)
  - `.ask-page` and `.ask-col` (Questions, Shared with me, History, Fleets, a question's own page)
  - `.km-main` and `.km` (Knowledge)
  - the docs layout (`docs.css:10`)
- **Side padding.** The side padding of `.ask-main` becomes 24 px from 900 px wide (16 px below), so
  full-width content does not touch the sidebar's edge.
- **Prose keeps a column of at most 900 px,** left-aligned:
  - `.dossier-md` and `.dossier-front` (already 900 px);
  - `.docs-article`, up from 760 px;
  - release notes' `.rel-text` keeps its 64ch.
- **A form field is never wider than 900 px.** An input, a select or a textarea in `.ask-main` gets
  `max-width: 900px`, so a single field does not stretch across a wide screen.
- **Left as they are:** the knowledge orrery (an image, capped at 620 px), HOME, the design page and
  the arcade.

### 4. The Questions tab: folded rounds, with what is left always shown

The tab keeps its order: rounds in the order they were asked (`askedOrder`). Each round is one line.
A **round's line** shows, left to right:
- a status mark;
- the round's rule and category (`Brainstorm · UX/UI`);
- its question headers joined in lower case (`— header, width, contrast`);
- its count;
- when it was asked;
- the outcome (`answered by PIERRE after 4 min 26 s, on the page`).

No round is drawn as a card. Rounds are separated by one `--ask-line` rule, on `--ask-surface`, and
the list has a single `--ask-line-strong` outline. Chosen options lose their box and their
plasma-soft fill.

**The three states:**

| Round | Status mark | Count | Folded? |
|---|---|---|---|
| **Open** (waiting for an answer) | a `--ask-yellow` dot with an `--ask-on-yellow` ring | `N to answer`, as a badge in `--ask-yellow` on `--ask-on-yellow` | **Never.** It is always unfolded, with no fold control. Its line and body sit on `--ask-sunk` with a 4 px `--ask-yellow` left edge. |
| **Answered** | a `--ask-green` ✓ | `N/N` | Starts folded. A click on its line unfolds it, and another click folds it again. |
| **Moved to the terminal** | a `--ask-muted` dot | `moved to the terminal` in `--ask-muted` | Starts folded, like an answered round. |

**Unfolded, a round lists each of its questions:**
- **An answered question** is one line: its header chip, the question in `--ask-muted`, then `→` and
  the chosen option(s) in `--ask-ink`, with the Recommended badge when the option had one.
  - The option's description follows in `--ask-muted`, on the next line when it does not fit.
  - An answer no option names shows as the text written, as today.
- **An open question** shows its header chip and its text in `--ask-ink`. Under them come its options
  as outlined buttons (`--ask-line-strong`, no fill), each with its description.
  - A quick round (PRD 384) keeps its one-click `QuickAnswer` buttons, or its "Waiting for <owner>".
- The round's context line and **Open the question** close its body, as today.

**Folding without a script.** Folding uses `<details>`/`<summary>`, rendered on the server:
- An answered or moved round is a `<details>` with its line as the `<summary>`.
- An open round is a plain element whose line is not a control.
- The round keeps its `id` on the outer element, so `#<round id>` still lands on it, and PRD 476's
  `scroll-margin-top` under the pinned header still applies.

**Counting questions, not rounds.** `questionsView` returns three counts:
- `asked`: the number of questions in every round.
- `answered`: the number of questions in the answered rounds.
- `open`: the number of questions in the open rounds.

A moved round's questions count in `asked` and nowhere else. The counts show in two places:
- **On the tab:** `Questions 7/10 · 3 to answer`, where `3 to answer` is the yellow badge. When
  nothing is open, it reads `10/10 answered` with no badge.
- **In a strip above the list:** the same words, and a meter filled to `answered / asked` in
  `--ask-green` on `--ask-sunk`.

A page with no rounds keeps its empty state, and a page whose rounds could not be read keeps its
message.

## Decisions

- **The top bar is T1 (surface and a 2 px `lineStrong` rule),** picked by the person with the idea
  out of five drawn on 2026-09-28. The other four were today's bar, an ink bar, a plasma bar, and a
  surface bar with a shadow and an accent.
- **The Questions tab uses folded rounds (E),** picked out of five: a ledger, a transcript, "to answer
  first", a table and folded rounds. The person added one rule: **an open round is never folded.**
- **A round is open or answered as a whole.** A round's status is stored per round
  (`dossier_rounds.status`), so a round with some questions answered and others open cannot occur.
  The rule "open is never folded" therefore applies to whole rounds.
- **Open rounds stay in the order asked** rather than moving to the top. That order is how the
  brainstorm read, and the yellow mark and the tab's badge already say how many rounds are left.
- **Prose keeps 900 px everywhere,** chosen over full width for prose too. `.docs-article` is raised
  to the same 900 px, so the app has one reading measure.
- **"To answer" uses the existing `yellow` token.** On Omni that token is magenta, the Recommended
  badge's colour. The badge and the waiting mark never sit on the same element, so no new token is
  added. The `yellow`/`onYellow` pair is already guarded.
- **A moved round does not count as "to answer".** Nobody can answer it on the page any more.
- **Folding is `<details>`,** so the page works with no script and keyboard folding comes for free.

## User stories

1. As a member reading a PRD page, I see the header as the top of the page, not as a box on it, and
   the tabs' line runs from the sidebar to the window's edge.
2. As anyone signed in, I can tell the top bar from the page in every theme.
3. As a member on a wide screen, every app page uses the width, and I still read the spec, the plan
   and the docs at a comfortable line length.
4. As the person a PRD asks, I open its Questions tab and see at once how many questions are left
   (`3 to answer`) and which rounds they are in, without unfolding anything.
5. As a reviewer, I scan the answered rounds as one line each, and I unfold only the one I want to
   read.

## Scope

**In:**
- the PRD header's frame;
- the top bar's background and rule;
- the width caps and side padding listed in §3;
- the Questions tab's layout;
- the question counts in `questionsView` and on the tab.

**Out:**
- the Questions page (`/ask`) and a question's own page (`/ask/q/<round>`), beyond their width;
- the Outbox and Retro tabs' cards;
- HOME, the design page and the arcade;
- any new colour token;
- the sidebar.

## Test seams

Following `omni kb show testing`: vitest beside the code, no network.

- **`view.test.ts`:** `questionsView` counts questions, not rounds.
  - Two answered rounds of 3 and 1 questions, an open round of 2 and a moved round of 1 give
    `asked 7, answered 4, open 2`.
  - With no open round, the tab badge reads `4/4 answered`; with one, it reads `4/7 · 2 to answer`.
- **`render.test.ts`** (the questions pane rendered to static markup):
  - An answered round renders as a `<details>` without `open`, with its line in the `<summary>`.
  - An open round renders with no `<details>` and every option visible.
  - A moved round renders as a closed `<details>` saying `moved to the terminal`.
  - Each round element keeps its round id.
  - A quick round still renders `QuickAnswer` or "Waiting for <owner>".
- **A stylesheet test** (like `src/design-system.test.ts`, reading the CSS as text):
  - None of `.dash`, `.dossier-history`, `.ask-page`, `.ask-col`, `.km-main`, `.km` or the docs
    layout declares a `max-width`.
  - `.dossier-md`, `.dossier-front` and `.docs-article` declare `max-width: 900px`.
  - `.dossier-head` declares no `border-radius`.
  - `.app-bar` declares a `--ask-surface` background and a `--ask-line-strong` bottom border.
- **A manual browser pass** of `/prd/<id>` (one PRD with open rounds, one fully answered), Home, the
  PRD list, Questions, History, Fleets, Knowledge and Docs:
  - at 1920 px and at 390 px, in Omni, Light and Dark;
  - checking that the tabs' rule touches both edges, that the header pins at ≥ 900×700, and that
    Tab, Enter and Space fold an answered round.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the galaxy app's styles and the questions
  pane, through its Vercel deployment. There is no migration and no kit change. Rolling back means
  reverting the feature PR.
- **Tests that read class names.** `render.test.ts` and `page.test.ts` read `dossier-round`,
  `dossier-q`, `dossier-option` and `dossier-outcome`. They are kept on the new markup, so the round's
  anchor and those tests do not move.
- **The way back from a question's page** lands on `#<round id>`. An answered round is folded, so it
  lands on the round's line. That is enough to find the round again, and no script is added to
  unfold it.

## Acceptance criteria

1. On `/prd/<id>` at 1920 px, the header has no rounded corners and no side borders, and it touches
   the top bar, the sidebar and the window's right edge. The rule above its tabs spans the full
   header width.
2. The top bar has a surface background and a 2 px `lineStrong` bottom border in Omni, Light and
   Dark.
3. Home, the PRD list, Questions, Shared with me, History, Fleets, Knowledge and Docs use the full
   content width at 1920 px. The spec, the plan and a docs article stay at most 900 px wide.
4. With rounds of 3 and 1 answered questions, 2 open and 1 moved, the Questions tab reads
   `Questions 4/7 · 2 to answer`, and the strip above the list says the same, with its meter.
5. An open round is shown unfolded, with its options, and has no fold control. An answered round
   shows one line until it is clicked. A moved round shows one line marked `moved to the terminal`.
6. No chosen option is drawn as a filled box.
7. `pnpm test` is green, and the page still renders, and folds, with JavaScript off.
