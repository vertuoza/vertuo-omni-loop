---
name: pixel-perfect
description: Design craft on a screen, imported from impeccable and tailored so the product wins — reads the design flag first (off, it says how to turn it on and stops), then the repository's design form, whose product, system and deliberate sections override the craft floor and the refuse list. Its commands review a screen (critique, audit), finish it (polish, harden) or fix one side of it (typeset, layout, adapt, clarify), and review is the bounded auto-review /omni:do-work and /omni:visual-fix follow on UI work — one look, one batch of fixes, one confirming look, never blocking. Fixes stay inside the slice's territory; anything else becomes an outbox item. Triggers on "polish this screen", "audit the quote page", "critique this page", "does this look like our product", "/omni:pixel-perfect polish", "/omni:pixel-perfect review".
---

<!-- Imported from pbakaus/impeccable@d631a8827f99414d2b6daba4ef08b7f8701751d7 (the impeccable skill's SKILL.md, version 4.5.2, Apache-2.0) and modified — every change in kit/porting/plugin--pixel-perfect.md, the attribution in kit/NOTICE.md -->

# Pixel perfect: design craft that follows the product

This skill brings design craft to a screen: the eye of a design director who knows what makes a
screen read as built for its product rather than assembled from a template, and the discipline to
check the built result rather than the intention. It works on the product's own design, never on
a taste of its own: what the repository says about its product comes first, and the craft floor
fills only what it leaves open.

Its Markdown is imported from [impeccable](https://github.com/pbakaus/impeccable) by Paul Bakaus,
which started from Anthropic's frontend-design skill, both under the Apache License 2.0, and has
been modified: the attribution is in `kit/NOTICE.md`, every change in
`kit/porting/plugin--pixel-perfect.md`. No package, binary, hook or network call comes with it.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

## Input

| input | example | what it does |
|---|---|---|
| a command and a target | `/omni:pixel-perfect polish the quote page` | runs that command on that screen |
| `review`, from a skill | `/omni:pixel-perfect review` | the bounded auto-review of a slice or a visual fix: [reference/review.md](reference/review.md) |
| a request that names no command | `/omni:pixel-perfect does this look like our product?` | picks the one command that fits; when two fit, asks which |
| nothing | `/omni:pixel-perfect` | shows the commands below and asks which, as one question through the session's question tool; never runs one unasked |

## Step 0

1. **The flag.** Run `node .omni-loop/bin/omni.mjs config design.enabled`. When it prints anything
   but `true` (or fails), print exactly this line, and stop:

   ```
   design: off — set design.enabled: true in .omni-loop/config.yml to turn design craft on
   ```

   Nothing else runs: no form is read, no screen is looked at, nothing is changed. A skill that
   follows `review` reads that line as the review's one `—` line.
2. **The product.** Run `node .omni-loop/bin/omni.mjs kb show design`. It prints the repository's
   design form section by section: `product` (who uses it, where, under what light, its voice and
   words), `system` (where its tokens, type scale, spacing, colours and components live),
   `deliberate` (what it does on purpose) and `review` (how to look at a screen). A section that
   points at a file (`See: DESIGN.md`, or any file) is that file: read it. A `[hole]` is a question
   for a person, never a reason to stop: work from what the code shows (the tokens and components
   in use, the screens around the target), never invent a direction to fill it, and say in your
   report which section was a hole.
3. **The command.** Load the command's reference below and follow it. Before any edit to a screen,
   small ones included, read [reference/craft-floor.md](reference/craft-floor.md); planning or a
   review with no edit does not need it.

## The product wins

`omni kb show design` does not print the form's opening paragraph, so the precedence is stated
here, and it binds every command and every reference:

- **The product wins.** The design form's `product`, `system` and `deliberate` sections override
  the craft floor and the refuse list. A rule of either that the form sets aside, by saying the
  product does otherwise on purpose, is set aside here: never fix it, never report it as a finding.
  Where the form says nothing, the craft floor holds. Your own habit overrides neither.
- **Refinement preserves.** Every command here refines what exists: it keeps the product's visual
  world, behaviour, copy and everything outside its target. A screen whose concept is wrong is not
  this skill's to replace: say so, and name `/omni:brainstorm` as the way to redesign it. Never
  split the difference into polish on a look that should go.
- **Visual authority is evidence, not a file name.** A form with holes does not make the product a
  blank page: its tokens, components and neighbouring screens are its design.
- **Loaded symbols stay out of the decoration.** A subject's world does not license emblems tied to
  militarism, supremacy or hate movements as motifs, badges or ornament, such as the Rising Sun
  flag's rays, the Confederate battle flag, or Nazi-era insignia and their stylised variants; reach
  for that world's neutral forms instead. Content that documents such a symbol as fact stays as it
  is.

## Modes

The mode names what success looks like for the person on this screen. Choose it from the screen,
not the product: a tool's landing page is still Persuade, a docs index is still Read.

- **Persuade:** the visitor decides and acts. Landing pages, marketing, pricing. Earn attention and
  action, in the product's committed world rather than the category's habit.
- **Operate:** the person completes a task. App screens, dashboards, editors, admin, settings.
  Scanability, consistency, platform expectations and the real scene of use outrank expression;
  the brand lives in precise details.
- **Read:** the person understands something. Docs, articles, help, changelogs. Structure for
  comprehension, then make the reading worth staying in.
- **Experience:** the person is inside the work itself. Portfolios, galleries, showcases. The work
  leads from the first view; the interface recedes.

## Commands

| command | group | does | reference |
|---|---|---|---|
| `critique [target]` | review | does it read as this product: hierarchy, clarity, voice, the tokens and components used, scored | [reference/critique.md](reference/critique.md) |
| `audit [target]` | review | accessibility, performance, theming, responsive, implementation, scored | [reference/audit.md](reference/audit.md) |
| `polish [target]` | finish | the last pass: agreement with the design system, spacing, states, details | [reference/polish.md](reference/polish.md) |
| `harden [target]` | finish | empty, loading and error states, long text, languages, edge cases | [reference/harden.md](reference/harden.md) |
| `typeset [target]` | fix | type choices, scale, hierarchy | [reference/typeset.md](reference/typeset.md) |
| `layout [target]` | fix | spacing, rhythm, grid, alignment | [reference/layout.md](reference/layout.md) |
| `adapt [target]` | fix | mobile and desktop, touch targets, breakpoints | [reference/adapt.md](reference/adapt.md) |
| `clarify [target]` | fix | labels, errors and empty-state copy, in the product's words | [reference/clarify.md](reference/clarify.md) |
| `review` | the loop's | critique, audit, the lint, screenshots, then polish, bounded and never blocking | [reference/review.md](reference/review.md) |
| — | shared | the quality floor and the refuse list, read before any edit to a screen | [reference/craft-floor.md](reference/craft-floor.md) |

A redesign, a new screen, a new visual world, motion or colour added for its own sake are not
here: they are product decisions, and start at `/omni:brainstorm`. A screen on a native platform
(iOS, Android) follows the platform's own guidelines; these references are for the web.

## Rules for every command

- **Bounded.** Inspect in one batched round (desktop and mobile together), fix everything it showed
  in one batch, confirm with at most one more round, and stop. The ceiling covers the whole cycle:
  screenshots, scans, small edits and rebuilds alike. Open-ended self-checking costs more and does
  worse than the next command would.
- **Inside the territory.** Followed by a skill on a slice, every fix stays inside the slice's
  territory. A fix that needs a file outside it (a shared component, a token, a stylesheet another
  slice owns) is a decision, not an edit: the calling skill records it as an outbox item, with the
  fix it would make. Typed by a person, edits stay inside the target they named; ask before going
  beyond it.
- **The lint is the repository's.** The design linter is `commands.design`
  (`node .omni-loop/bin/omni.mjs config commands.design`), run from the repository root when it is
  set; when it prints `null`, no lint runs. Never install a tool, add a hook or call the network to
  get one. A lint finding is evidence of a defect, never proof of quality, and a clean lint does not
  replace looking.
- **Looking at a screen.** Through the session's browser tool when it has one, at the widths the
  form's `review` section names (390 and 1440 when it names none), signed in as it says. When the
  app cannot run or be seen here, say so, judge from the source, say that you judged from the
  source, and report nothing as seen.
- **Two views apart.** Where a reference asks for two independent assessments, run them as two
  isolated helper agents when the session can start one, else one after the other, the first
  finished before the second is read; the report's first line says which.
- **Asking.** Typed by a person, a question goes through the session's question tool, one at a time,
  with concrete options. Followed by a skill, nothing is asked: what a person would have been asked
  becomes an outbox item.
- **Never blocking.** No finding of any command stops a slice, a wave or a gate, or turns a check
  red. What is fixed is listed; what is not becomes a decision.
- **The product's words.** Never change a factual claim, a price, a legal phrase or a term of the
  product's glossary to make a screen read better: ask, or record it.
