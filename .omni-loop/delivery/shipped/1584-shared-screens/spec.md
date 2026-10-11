---
prd: 1584
title: Design memory, round 3 — shared screens, touched-only holds, copy apart from content, a Pixel perfect section
blocked-by: none
spec: file
phase0: server
---

# Design memory, round 3

**Date:** 2026-10-11 · **PRD:** #1584 · **Follows:** PRDs 1369, 1407 and 1550, all on `main`
**Touches:**
- `kit/lib/design/screens.ts` (`kind`), `kit/lib/design/gallery/` (shared screens grouped),
  `kit/lib/design/touched.ts`, `kit/bin/commands/design.ts`, the help entries
- `kit/lib/design/words/` (`design.words.content`, sentences across inline elements, a control's
  parts), `kit/lib/config.ts`
- `kit/plugin/skills/pixel-perfect/` (`mock.md`, `reference/review.md`, `reference/lock.md`),
  `brainstorm/`, `visual-fix/`, `think-big/`, `invade/`, `do-work/`, `pr/`
- `docs/guide/design.md`
- omni-loop's own screen library (the dogfood)

## Problem

PRD 1550's dogfood on omni-loop (`.omni-loop/delivery/shipped/1550-screen-mockups/dogfood.md`)
drew four mockups for real and found ten gaps. The ones this PRD closes:

- **Shared structure has no home.** The app shell (the sidebar and top bar around every app page),
  the notifications bell, a sign-in page: each changes what a person sees on many screens, yet the
  rule of PRD 1550 only says "a file the screen depends on goes in `reads`". So nothing guards the
  shell, and nothing tests it as a screen.
- **A fault the work did not touch reads as the work's.** Review screenshots a whole page. A bug in
  the menu, seen while fixing the quote list, shows up among the slice's findings, though the slice
  never touched the menu.
- **The word pass judges content as copy.** On the dossier mockup, five of six findings were the
  PRD's own text shown in its Spec pane: content the screen displays, not words the screen wrote.
- **The word pass splits and glues.** `on <code>main</code> (2026-10-11)` became two strings;
  `<b>CREW TOP 5</b><span>NO SCORES YET</span>` became `CREW TOP 5NO SCORES YET`.
- **The mock skill leaves the agent guessing** about the product's fonts, its pixel art and images,
  example data ("nothing invented" read as forbidding it), a missing screenshot or gallery, and a
  screen whose one primary action is still an open question.
- **The rule leaves two cases open:** a view file two pages share, and a data file that holds a
  screen's words.
- **The before/after page mixes what a change does with how it looks.** For a big PRD a reviewer
  cannot tell which part is the pixel-perfect part to look at closely; for a fix with no screen (a
  database change), nothing says pixel-perfect has nothing to do.

## Solution

### 1. Shared screens

- A screen's front matter gains an optional **`kind`**: `page` (the default) or `shared`. Every
  screen written before this PRD reads as a page.
- A **shared screen** is structure several pages show: an app shell, notifications, a sign-in page,
  a dialog, a toast. It has its own `implements`, mockup, lock, review and place in the gallery,
  like any screen. It names the pages it appears on in `routes` when it has none of its own.
- Each page it appears on lists its files in **`reads`**. Locking the shell guards the shell; a
  change to the shell never trips a page's lock, and a change to a page never trips the shell's.
- When a change touches a shared screen's `implements`, `/omni:pixel-perfect review` screenshots it
  **in place**: on one page it appears on, as well as on its own.
- `omni design screens` prints `shared` beside a shared screen; `omni design gallery` shows the
  shared screens in a group of their own, after the pages.

### 2. Only what a change touches can hold it

- A lock trips only when the diff changes that screen's own `implements`, as today: this PRD
  writes the rule down where every reader sees it (the review reference, `lock.md`, do-work).
- **Seen, not touched.** When review screenshots a page and sees a fault in a part the diff did not
  change (another screen's `implements`, or a shared screen the diff did not touch), it reports it
  under its own heading, `Seen, not touched`, apart from the work's findings. It is never a finding
  against the slice, never fixed in the slice, never an outbox item and never a block. Review names
  the screen it sits on and suggests filing it as a bug of its own.

### 3. The word pass

- **Copy apart from content.** Text inside an element matching **`design.words.content`**
  (`[data-content]` when unset) is content the screen shows, not words it wrote: the pass prints its
  word count apart, as `content · <n> words`, and raises no finding on it. The key is optional, like
  `design.ignore`: its default is applied where it is read.
- **Sentences stay whole.** Phrasing elements inside running text (`a`, `abbr`, `b`, `cite`, `code`,
  `em`, `i`, `kbd`, `mark`, `q`, `s`, `small`, `span`, `strong`, `sub`, `sup`, `time`, `u`, `var`)
  no longer split it: `on <code>main</code> (2026-10-11)` is one string. Sibling **block** elements,
  and sibling elements that are not inside running text, stay separate strings, as PRD 1550 made
  them.
- **A control's parts are words apart.** Inside a control, two sibling elements are joined with a
  space: `<b>CREW TOP 5</b><span>NO SCORES YET</span>` reads `CREW TOP 5 NO SCORES YET`.

### 4. What the mock skill says

`mock.md` gains one section, **Standing in**, for what a self-contained mockup cannot carry:

- **Fonts:** name the product's faces first in each `font-family`, with the fallbacks the product
  itself uses; never load a font.
- **Pixel art and images:** an inline SVG placeholder at the image's real size, labelled with what it
  stands for.
- **Example data:** allowed, and expected for a screen that shows data. Take it from the product's
  own demo data or fixtures when they exist, keep it realistic, put it inside `data-content`, and
  say outside the marked screen that the figures are examples.
- **No screenshot:** draw from the source and say so outside the mark.
- **No gallery yet:** open the `.html` file directly.
- **An undecided primary action:** mark the one the screen's own words point to, say so outside the
  mark, and keep the question in the screen's **Open questions**.

### 5. The rule, settled

Every skill that writes a screen states the rule in these lines:

- A file whose change can change what a person sees on this screen goes in `implements`, the data
  files that hold its words included.
- A file the screen only depends on goes in `reads`.
- Structure several pages share is a shared screen of its own; each page lists its files in `reads`.
- A view file two pages share, and that is not structure, goes in `reads` on each.

### 6. A Functional part and a Pixel perfect part

When `design.enabled` is on:

- `/omni:brainstorm`'s before/after page has two parts, in this order:
  - **Functional:** what the change does, today beside after (the flow, the data, the exchange).
  - **Pixel perfect:** only when the change changes a screen: the marked screens, today beside after,
    and one line naming the library screens they are (`screens: quote-list · app-shell`). It is the
    part review and the word pass read.
- A PRD that changes no screen (a database fix) has the Functional part alone, says
  `Pixel perfect: no screen changes`, and no slice runs pixel-perfect work for it.
- The feature PR's body (`/omni:pr`) carries a **Pixel perfect** line naming the screens to look at,
  or `none`, so a reviewer knows where to focus.
- `/omni:visual-fix`, whose page is all screens, keeps its shape: it is the Pixel perfect part alone.
- With `design.enabled` off, the before/after is written as today.

### 7. Dogfood on omni-loop

- Two shared screens, each with a mockup: **`app-shell`** (the app pages' sidebar and top bar) and
  **`notifications`** (the bell and its panel).
- `dashboard` and `prd-dossier` move the shell's files into `reads`; the dossier's PRD text and the
  dashboard's figures are marked `data-content` in their mockups.
- The word pass and the lock replay of PRD 1550's dogfood are rerun, and the results written down.

## Decisions

- **Shared structure is a screen of its own** (2026-10-11, the person: "structural components
  should have their own screen — things that are shared like the app shell, notifications, a login
  screen — treated as a screen to test"). The kit names no shared screen: the repository draws its
  own.
- **Only what a change touches can hold it** (2026-10-11, the person: "a bug in a menu I did not
  touch should not block the work"). A fault in an untouched part is reported apart, `Seen, not
  touched`, and suggested as a bug of its own.
- **A `data-content` mark** (2026-10-11, the person): content is counted apart, never judged; not
  skipped silently, so a reader sees what was left out.
- **A Functional part and a Pixel perfect part** (2026-10-11, the person): a small fix with no
  screen never runs pixel-perfect work; a big PRD shows which part needs the pixel-perfect eye.
- **`design.words.content` is optional, its default applied where read,** as `design.ignore` is:
  `kit/lib/config.test.ts`, a law's proof, compares the whole design section.
- **The objection, accepted** (persona:Irisa): "I ship small mobile fixes; if the app shell is a
  lockable screen, does every change to the sidebar now wait for someone?" Settled `accepted`: a
  shared screen starts as a draft and holds nothing until a person locks it; once locked, only a
  change to its own files holds, and a fix elsewhere never does.
- **No proof video** (2026-10-11; the person did not ask for one, as for PRDs 1369, 1407 and 1550).

## User stories

- As a **developer fixing the quote list**, a bug I see in the menu is reported apart and never
  holds my work.
- As a **lead engineer**, I lock the app shell and know a change to it waits for its owner, while
  every page around it stays free.
- As a **front-end developer**, the word pass judges a screen's own words, not the data it shows.
- As a **product manager**, I open a big PRD's before/after and go straight to its Pixel perfect part.
- As a **back-end developer**, my database fix has no Pixel perfect part and runs no design work.

## Scope

**In:** `kind: shared`; touched-only holds and `Seen, not touched`; `design.words.content`;
sentences across phrasing elements; spaced control parts; the mock skill's **Standing in**; the
rule's four lines; the Functional and Pixel perfect parts and the PR's Pixel perfect line; the guide;
omni-loop's `app-shell` and `notifications` screens and the rerun.

**Out:** publishing the gallery; filing the `Seen, not touched` bug automatically; loading real
fonts or images into a mockup; a check that grades the before/after's two parts (the skills write
them; no check refuses a page without them).

## Test seams

Unit tests next to each module, as `omni kb show testing` says; no test reaches the network. No test
goes in `kit/lib/config.test.ts` or `kit/test/plugin.test.ts`, the proofs of laws.

- **Screens** (`screens.test.ts`): `kind: shared` parses; a screen without `kind` reads `page`; an
  unknown kind is refused by name.
- **Gallery** (`gallery/page.test.ts`): shared screens come in their own group, after the pages.
- **Screens command** (`kit/bin/design.test.ts`): `omni design screens` prints `shared` beside a
  shared screen.
- **Word pass** (`words/words.test.ts`, `kit/bin/design-words.test.ts`): text in `[data-content]`
  gives a `content · <n> words` line and no finding; `on <code>main</code> (2026-10-11)` is one
  string; `<b>CREW TOP 5</b><span>NO SCORES YET</span>` in a control reads with a space; sibling
  blocks stay apart; `design.words.content` set to another selector is used (tested in
  `kit/lib/design/words/content.test.ts` or beside the pass).
- **Skills** (`kit/test/design-skills.test.ts`): `mock.md` has **Standing in** with its six rules;
  `review.md` has `Seen, not touched` and says it never blocks; every screen-writing skill states the
  rule's four lines; brainstorm writes the Functional and Pixel perfect parts with design on; `/omni:pr`
  has the Pixel perfect line.
- **Docs** (`apps/galaxy/src/docs/*.test.ts`): the guide page still builds and links.

## Risks

- **What merging publishes:** a new kit version (the `release` workflow bumps it) with a new screen
  field, a new optional config key and new skill text; all of it behind `design.enabled`, off by
  default.
- **Older kits refuse `kind`.** The screen parser is strict, so a kit older than this PRD refuses a
  screen that says `kind:`. Rolling back means deleting each `kind: shared` line in the same revert
  (omni-loop's two shared screens are the only ones this PRD writes).
- **Sentences joined too eagerly.** Treating phrasing elements as part of running text could join a
  label to its neighbour in a layout built from spans. The rule joins only inside running text (a
  parent that holds text of its own beside them); the tests cover a layout of spans.
- **A reviewer misses a `Seen, not touched` fault** because it is apart from the findings. It is
  listed on the review's record and suggested as a bug; nothing hides it.
- **Rollback:** revert the feature PR, and delete omni-loop's `kind: shared` lines with it.

## Acceptance criteria

1. A screen may carry `kind: shared`; one without `kind` reads as a page; `kind: other` is refused
   by name.
2. `omni design screens` prints `shared` beside a shared screen, and `omni design gallery` shows
   shared screens in a group of their own after the pages.
3. `reference/review.md` says a lock trips only on a change to that screen's own `implements`, and
   reports a fault in an untouched part under `Seen, not touched`, never against the slice, never
   blocking, suggested as a bug of its own; it screenshots a touched shared screen on one page it
   appears on.
4. Text inside `[data-content]` gives `content · <n> words` and no finding.
5. `on <code>main</code> (2026-10-11)` inside a marked screen reads as one string.
6. `<b>CREW TOP 5</b><span>NO SCORES YET</span>` inside a control reads `CREW TOP 5 NO SCORES YET`.
7. `mock.md` has a **Standing in** section covering fonts, pixel art and images, example data, no
   screenshot, no gallery and an undecided primary action.
8. Every screen-writing skill (lock, mock, visual-fix, brainstorm, think-big, invade) states the
   rule's four lines.
9. With `design.enabled` on, `/omni:brainstorm` writes the before/after as a Functional part, then a
   Pixel perfect part when a screen changes (or `Pixel perfect: no screen changes`); `/omni:pr`'s
   feature body carries a Pixel perfect line.
10. omni-loop's library holds `app-shell` and `notifications` as shared screens with mockups;
    `dashboard` and `prd-dossier` list the shell's files in `reads`; the dossier's mockup marks its
    PRD text `data-content`.
11. The rerun, written in the PRD's folder, shows the dossier's content findings gone and no page
    lock tripped by a change to the shell alone.
12. `docs/guide/design.md` explains shared screens, `Seen, not touched`, `data-content`, **Standing
    in** and the two parts of the before/after.
