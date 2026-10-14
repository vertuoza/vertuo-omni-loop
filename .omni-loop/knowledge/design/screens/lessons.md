---
screen: lessons
status: draft
kind: page
mock: lessons.html
implements: []
reads: []
routes: [/knowledge?tab=lessons]
supersedes: null
---

## Purpose

The one place to see the anti-loop's ledger: `/knowledge › Lessons`, a card per lesson, each in one
of five states, with the facts that put it there. Lessons come in through two entrances: a fix that
carries its lesson (the neutral `omni / lesson` check), and the retro's echo that links a finding to
an earlier one by cause. The page shows them in one list. It reads at the evidence and proposes; it
never merges and never locks a law. It is drawn in anti-loop mode, the shared screen
`anti-loop-mode`, inside `app-shell`; neither is drawn again here.

## Regions

- **The head:** the title Lessons and the Knowledge tabs (Registers, Playbook, Lessons, Screens),
  Lessons current.
- **The filters:** one chip per state, each with its count copied from evidence, never a rate: All,
  Never landed, Unsworn, Shining, Cracked, Kept on purpose, Sweep; then the denominator, `read 10 of
  171 retros`.
- **The hero card:** the lesson that leads, today "Regenerate database types; never hand-edit
  them.", its state badge and its source (`2 retros · 0 KB rules`). Its **journey strip**: the
  nodes are the facts, there is no separate grid of facts: 1322 · red on 7 commits (#1349) → 1628 ·
  red on 3 commits (#1649) → Echo → Lesson PR → Before CI. Each node opens its proof below the strip.
  Then its one action, **Land it**, which opens a lesson PR a person merges.
- **The list:** one row per other lesson: state badge, the lesson's sentence, its source (retros,
  threads, a rule), a note, and Open.
- **Weekly sweep:** the inverse sweep's findings, lessons with no retro behind them: a guard with no
  rule, rules with no `Governs:`, a baseline entry to recheck; each with Ask.

## States

- **Never landed:** proposed by retros, nothing merged: no KB line. The hero shows Land it.
- **Unsworn:** the KB line merged and reads Proposed, not a law. The hero's action becomes "A person
  locks it", with "It needs an Enforced by test".
- **Shining:** an `Enforced by:` test and a person who locked it; the card no longer reads Proposed.
  Its action reads Locked, disabled, "Checked before CI". The journey strip lights node by node as
  the card moves from never landed to shining.
- **Cracked:** a rule existed and the red came back: "why didn't it hold?"
- **Kept on purpose:** dismissed, and remembered, so it is not proposed again.
- **Sweep question:** a sweep finding waiting for an owner's answer.
- **A filter with nothing in it:** "Nothing in this state".
- **A journey node open:** its proof, e.g. "1322 F1 · check red on 7 commits in s2, s3, s7 · retro
  issue #1349"; with none open, "Pick a step to see its proof."

## Words

Lessons · Registers · Playbook · Screens · All · Never landed · Unsworn · Shining · Cracked · Kept on
purpose · Sweep · read 10 of 171 retros · Land it · Opens a lesson PR a person merges · A person
locks it · It needs an Enforced by test · Locked · Checked before CI · Pick a step to see its proof. ·
Weekly sweep · question · Ask · Open · Nothing in this state.

## Refusals

- Every count is copied from evidence, never a rate, never a number the model did not read.
- A shining card never also reads Proposed.
- Land it opens a pull request; the page merges nothing and locks no law: a person does both.
- Magenta marks state only; the primary keeps yellow, and errors stay red (`anti-loop-mode`).

## Open questions

- The route: the tour showed `/knowledge?tab=lessons`; the concept writes `/knowledge › Lessons`.
  A tab of `/knowledge` or a path of its own is not settled.
- Developers distrust a model verdict that does not cite the lines it read: how a card shows the
  lines behind "still true", "cracked" or an echo is not drawn.
- Feasibility rests on matching findings by cause and on backfilling retros: only 10 of 171 shipped
  PRDs have one. What the page says while most PRDs have no retro, beyond the denominator, is open.
- Which lesson leads as the hero card when several never landed is not said.
- The `omni / lesson` check, Forewarned in `/omni:plan` and the pre-commit check do not exist today;
  the Before CI node has nothing to point at until they do.
- Not library screens, so not drawn here: the fix PR with its neutral `omni / lesson` check and its
  states (asking, carried, no lesson, "a rule existed: why didn't it hold?"), the sibling
  `omni:lesson` PR and its two hunks, both on GitHub; and the terminal (Forewarned, the pre-commit
  check, the silence when nothing changed).
- The Skeptic wanted the fix check, not the retro echo, as the wedge; the Value critic wanted this
  screen first. The order the areas ship in is not decided.
- Whether the page stays in anti-loop colours while anything never landed and turns back at 0 (the
  Skeptic's remix) is not decided.

## Source

- /omni:think-big, concept #1964, crowned M on 2026-10-14: .omni-loop/delivery/inbox/concepts/1964-anti-loop/vision.html
