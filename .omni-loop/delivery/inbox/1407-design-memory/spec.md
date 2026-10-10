---
prd: 1407
title: A design memory that compounds
blocked-by: [1369]
spec: file
phase0: server
---

# A design memory that compounds

**Date:** 2026-10-10 · **PRD:** #1407 · **Stacked on:** PRD 1369 (#1371, `feat/design-craft`)
**Touches:**
- `kit/templates/playbook/design.md`, `kit/lib/playbook/forms.ts` (the form's optional `language`
  slot)
- `kit/lib/design/` (the screen library, the word pass, the screens a diff touches),
  `kit/bin/commands/design.ts` (`omni design screens`, `omni design words`, `omni design touched`)
- `kit/lib/check/` or its equivalent (`omni check design`, part of `omni check all`)
- `kit/lib/config.ts` (`design.words.*`)
- `kit/plugin/skills/pixel-perfect/` (`lock`, and `review` against a locked screen),
  `visual-fix/`, `brainstorm/`, `think-big/`, `do-work/`, `invade/`
- `docs/guide/design.md` and a third diagram
- omni-loop's own `.omni-loop/config.yml`, `.omni-loop/knowledge/playbook/design.md` and its screen
  library (the dogfood)

## Problem

PRD 1369 gives the loop an eye: a `design` form, `/omni:pixel-perfect` and a review on every UI
slice. But each run still starts from zero. Nothing accumulates "this is how our screens look, and
these screens are decided":

- A choice a person makes in `/omni:visual-fix`, `/omni:brainstorm` or `/omni:think-big` lives in
  one before/after page and is never read again.
- A screen someone approved can be redrawn by the next agent that touches it.
- Mockups ship with wording faults (a sentence on a button, two primary actions, text explaining
  the screen at rest) because nobody reads the words before a person sees them.
- The review screenshots "the screens the slice changed" by guesswork: nothing maps a diff to the
  screens it touches.

A product team that keeps a design memory (laws with their dates, a library of locked screens, a
word pass before publishing) gets visibly better screens over time. omni-loop runs in any
repository, so the kit must give that memory its shape and its rules, and leave every law, screen
and word to the repository and its people.

## Solution

### 1. Design laws in the `design` form

The form gains an optional fifth slot, **`language`**: the product's screen grammar, its laws.
Each law is a heading, then a lock line, then the law, then any amendments below it:

```markdown
### One primary action per place
🔒 2026-10-10 · @login · "only one blue button, ever"

A place holds one primary action and at most one quiet one.

#### Amended 2026-11-02 · @login · "dialogs may have two"
```

A law is changed only by a dated amendment below it, never by rewriting it. The kit ships no law,
only this shape. `/omni:pixel-perfect` reads the laws with the form and they win over its craft
floor, as the rest of the form does.

### 2. The screen library

A folder, **`design.screens`** (default `<paths.knowledge>/design/screens/`), one Markdown file per
screen, and beside it, optionally, its mockup `<name>.html`.

```markdown
---
screen: quote-editor
status: locked            # draft | locked | superseded
locked-by: "@login"
locked-on: 2026-10-10
quote: "this is the editor, build it"
mock: quote-editor.html
implements: [src/quotes/editor/]
routes: [/quotes/:id]
supersedes: null
---

## Purpose
## Regions
## States
## Words
## Refusals
## Open questions
```

- **Regions** says what each part of the screen shows and where its data comes from; **States**
  the empty, loading, error and other states; **Words** its labels; **Refusals** what it
  deliberately does not do; **Open questions** what is still undecided.
- **Amendments** to a locked screen are dated lines under its front matter,
  `> Amended <date> · @login · "<quote>": <what changed>`. A screen replaced whole is marked
  `superseded`, never deleted, and the new one names it in `supersedes`.
- **`omni design screens`** lists the library: name, status, who locked it and when, its routes.
  There is no hand-kept index.

### 3. Who writes, who locks

- **Drafts:** `/omni:visual-fix` writes the picked variation as a draft screen (or a draft
  amendment of an existing one); `/omni:brainstorm` writes the approved "after" of each screen it
  draws; `/omni:think-big` writes the crowned concept's screens. Each writes `status: draft` and its
  mockup, and names where it came from.
- **Locks:** only a person, in their own words. **`/omni:pixel-perfect lock <screen>`** asks for the
  quote, records `locked-by` (the GitHub login, or the one ask mode gives), `locked-on` and `quote`,
  and commits it. A law in `language` is locked the same way. No skill locks anything on its own.
- **Readers:** every skill that draws or builds a screen (`/omni:visual-fix`, `/omni:brainstorm`,
  `/omni:think-big`, `/omni:do-work`, `/omni:pixel-perfect`) reads the form and the library first.
  A locked screen is built as written and never redesigned; a draft is a starting point.

### 4. Changing a locked decision asks its owner

The one place design blocks, on purpose: findings never block, but a decision someone locked is
not changed without them.

- An agent never edits a locked screen's body or a locked law. It writes an amendment line and
  raises a **high outbox item** naming the screen, the change and who locked it, so the gate stays
  red until a person answers.
- **`omni check design`** (run by `omni check all`) refuses a locked screen or law whose text
  changed against the default branch without a new amendment line, a screen whose front matter does
  not read, and a `superseded` screen no other screen names. A draft is free to change.

### 5. The word pass

**`omni design words <page.html>…`** lists the visible words of each screen in a mockup and flags:

| rule | flags |
|---|---|
| `sentence-on-control` | a button or link whose label holds `design.words.sentence` words or more (default 7) |
| `two-primaries` | more than one primary action in one screen |
| `explains-at-rest` | a sentence standing on a screen outside any control, longer than `design.words.sentence` |
| `avoided-word` | a word the form's `product` section lists under the words the product avoids, or `design.words.avoid` |

- **It reads structure, never style.** A screen is an element with `data-screen`, a primary action
  one with `data-primary` (`design.words.screen` and `design.words.primary` map a repository's own
  selectors). Every mockup the kit's skills write uses that convention: the before/after pages,
  visual-fix rounds and think-big boards. A page with no screen marked is read whole, and says so.
- **Never blocking.** It exits 0 and prints its findings. `/omni:brainstorm`, `/omni:visual-fix`
  and `/omni:think-big` run it before showing a mockup and fix what it finds; the review's critique
  runs it too. A page with findings is still a draft. The rule is fixed in the screen, never
  silenced.

### 6. The screens a diff touches

`omni design touched` adds a `screens:` line: each library screen whose `implements` paths the diff
touches, with its status and routes (`quote-editor 🔒 (/quotes/:id) · quote-list (draft)`).
`/omni:pixel-perfect review` screenshots those routes and compares a locked screen with its mock; a
change to a locked screen raises the high item of section 4.

### 7. Invade drafts, the owner locks

`/omni:invade` (with `design.enabled`) drafts a screen entry for each screen it can prove exists,
from routes and screen files: `implements`, `routes`, the purpose from the code and copy, every
undecided point under **Open questions**. It never writes a law, never locks, never invents a
direction, and ends with the list of drafts for the owner to review and lock.

### 8. Dogfood on omni-loop

The last slice turns it on here:

- `design.enabled: true` and `design.paths` (`apps/galaxy/src/`, `apps/omni-app/src/`,
  `packages/design/`) in omni-loop's config.
- omni-loop's `design` form filled from evidence (`@omni/design`'s tokens, the galaxy components,
  the arcade look, the copy), with `TODO(human)` where the evidence does not decide.
- Draft screens for HOME, the game room, a PRD page and the dashboard. None locked: a person
  locks what they choose.
- The word pass over every before/after page in the inbox and shipped folders, its findings in
  `dogfood.md` beside this spec.
- Each design concept the dogfood shows the generic version lacks becomes a medium outbox item
  with the fix it would make. A person decides which become a follow-up PRD.

## Decisions

- **Stacked on PRD 1369** (the person, 2026-10-10): built on `feat/design-craft`, its PR targets
  that branch until #1371 merges.
- **Dogfood here, even if long** (the person): omni-loop runs it first to find missing concepts.
- **The kit gives shapes and rules, the repository gives content** (the person): no law, screen,
  word list or class name is hard-coded.
- **Only a person locks; changing a locked decision asks its owner** through a high outbox item,
  the one deliberate exception to "never blocking".
- **The library lives in the knowledge base**, not in a skill folder, so any agent reads it.
- **No hand-kept index**: `omni design screens` lists the library.
- **Out:** CI binding (a branch-protection setting a person turns on), demo data with every
  feature, motion skills, lock by delegation.
- **Objection** (persona:Irisa): "I ship quick wins for customers; locking and amending screens
  sounds like ceremony before my fix goes out." Settled `accepted`: nothing has to be locked,
  drafts never hold anything, and only a change to a screen someone chose to lock asks one
  question.
- **Proof video:** no.

## User stories

- As a product owner, I lock the screens I'm happy with and no agent redraws them.
- As a front-end developer, the slice I review was built from the locked screen, and its review
  compared the result with that screen's mockup.
- As a PM, every mockup I'm shown has had its words read: no sentence on a button, one primary
  action.
- As a lead engineer, the library and laws are plain files any agent and any person can read and
  diff.

## Scope

In: the `language` slot, the screen library and its format, `omni design screens`, `omni design
words`, `omni design touched`'s screens, `omni check design`, `/omni:pixel-perfect lock`, the
skills that write drafts and read the library, invade's drafts, the guide, the dogfood on
omni-loop.

Out: CI binding, demo data, motion skills, lock by delegation, a mockup gallery app, automatic
screenshots stored in the repository.

## Test seams

- `omni design words`: one fixture page per rule, a repository's own selectors, a page with no
  marked screen, exit 0 in every case.
- `omni check design`: a locked screen changed without an amendment is refused; with one, it
  passes; a draft changes freely; a bad front matter and an orphan `superseded` are named; on a
  temporary git repository.
- `omni design screens` and `omni design touched`'s `screens:` line, on a temporary library.
- The form's `language` slot resolves like the other slots.
- `kit/test/plugin.test.ts`: `lock` records the login, the date and the quote and only on a
  person's words; visual-fix, brainstorm and think-big write drafts and run the word pass; the
  review compares a locked screen with its mock; every drawing or building skill reads the library.
- The dogfood: `omni check design` and `omni check all` (bar the known PRD 3 and 45 entries) green
  on omni-loop with design on.

## Risks

Merging publishes a kit release: repositories with `design.enabled` off see nothing new. With it
on, a change to a locked screen now holds the gate until a person answers; drafts hold nothing.
omni-loop itself turns design craft on, so its own UI PRDs start running the review. Rollback for
a repository: `design.enabled: false`. For the kit: revert the feature PR.

## Acceptance criteria

1. The `design` form has an optional `language` slot; a law written in the shape above shows under
   it in `omni kb show design`.
2. `omni design screens` lists every screen of the library with its status, locker, date and
   routes.
3. `/omni:pixel-perfect lock <screen>` records `locked-by`, `locked-on` and the person's quote, and
   no skill locks a screen or a law on its own.
4. `omni check design` refuses a locked screen or law changed without an amendment line, and lets a
   draft change.
5. A change an agent makes to a locked screen raises a high outbox item naming the screen and who
   locked it.
6. `omni design words` flags `sentence-on-control`, `two-primaries`, `explains-at-rest` and
   `avoided-word` on a fixture page, reads a repository's own selectors, and exits 0.
7. `/omni:brainstorm`, `/omni:visual-fix` and `/omni:think-big` run the word pass before showing a
   mockup, write draft screens, and mark their mockups with `data-screen` and `data-primary`.
8. `omni design touched` prints the library screens a diff touches, with status and routes, and the
   review screenshots those routes.
9. `/omni:invade` drafts screen entries from evidence and never locks or writes a law.
10. omni-loop runs with `design.enabled: true`, a filled `design` form, draft screens for HOME, the
    game room, a PRD page and the dashboard, and `dogfood.md` with the word pass over its
    before/after pages; each missing concept is a medium outbox item.
11. The guide's design page explains the library, locking, the word pass, with a diagram of a
    screen's life (draft, locked, amended, superseded).
