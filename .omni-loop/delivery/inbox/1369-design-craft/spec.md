---
prd: 1369
title: Design craft that follows the product
blocked-by: none
spec: file
phase0: server
---

# Design craft that follows the product

**Date:** 2026-10-09 · **PRD:** #1369
**Touches:**
- `kit/lib/playbook/forms.ts` (a 15th form, `design`) and `kit/templates/playbook/design.md` (new)
- `kit/lib/config.ts` (`design.paths`, `commands.design`)
- `kit/bin/` (new: `omni design touched`, the UI check)
- `kit/plugin/skills/do-work/SKILL.md`, `visual-fix/SKILL.md`, `plan/SKILL.md`, `invade/SKILL.md`,
  `think-big/SKILL.md`, `brainstorm/SKILL.md`
- `kit/lib/help/entries.ts`, `kit/templates/README.md`, `docs/guide` (the design form and review)
- `kit/NOTICE.md` (new or extended: attribution to pbakaus/impeccable, Apache-2.0)

## Problem

Screens the loop builds come out generic. Nothing in the kit tells an agent what the product it
works on looks like, which patterns make a screen read as AI-made, or how to check the built screen
against the mockup the person chose:

- `/omni:do-work` builds a UI slice like any other code. It never looks at the screen.
- `/omni:visual-fix` looks at the real screen once, with no checklist.
- `/omni:think-big`'s Craft critic and `/omni:brainstorm`'s before/after page read the product's
  look ad hoc, with no form behind it.
- `/omni:invade` looks for no tokens, stylesheets or components.

Tools such as [impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) show what good looks
like: a product context every design step reads, a craft floor, a refuse list, and bounded
screenshot passes. But a generic taste list applied to a product that chose otherwise is noise:
the product's own design has to come first.

## Solution

### 1. The `design` form

A 15th playbook form, `design`, extended, read with `omni kb show design`. It resolves like every
form: a pointer, then the repository's own section, then the kit default. Its slots:

| slot | filled by | holds |
|---|---|---|
| `product` · required | invade | who uses it, where, under what light, its voice and words |
| `system` · required | invade | where the tokens, type scale, spacing, colours and components live, by path |
| `deliberate` · optional | invade, a person | what the product does on purpose: the craft floor and refuse list never flag these |
| `floor` · required | kit default | the checks every built screen passes: contrast, spacing, type, states, focus, responsive, copy |
| `refuse` · required | kit default | patterns that read as AI-made (cards in cards, gradient text, grey on colour, a coloured side border, Inter for everything, bounce easing, emoji as icons, an eyebrow above every heading…) |
| `review` · optional | invade, a person | how to look at a screen: the routes, the widths (default 390 and 1440), the sign-in |

**Precedence, stated in the form's opener and in every skill that reads it:** the product wins.
`product`, `system` and `deliberate` override `floor` and `refuse`; a repository may rewrite
`floor` or `refuse` whole, and its section replaces the kit default. A rule in `refuse` that the
product does on purpose is never reported.

A repository whose design system is already written in a `DESIGN.md` (or any file) points the form
at it (`See: DESIGN.md`), the pointer every form already supports.

The kit defaults of `floor` and `refuse` are adapted from impeccable's craft floor, credited in the
template and in `kit/NOTICE.md`.

### 2. Knowing a change touches a screen

- **`design.paths`**, a new config list of globs (default `[]`): where the screens, styles, tokens
  and components live.
- **`omni design touched [<base>]`** prints `ui: yes` with the matching paths, or `ui: no`, for the
  diff from `<base>` (default: the merge base with the branch's base). With `design.paths` empty it
  prints `ui: unknown` and exits 0. It never exits non-zero for a finding.
- **`/omni:plan`** writes `ui: yes` on a slice whose territory meets `design.paths`.
- **`/omni:do-work`** runs the auto-review when the slice says `ui: yes` **or** `omni design touched`
  prints `ui: yes`. On `ui: unknown` it judges from the diff whether a screen changed, and says that
  it judged.

### 3. The auto-review

In `/omni:do-work`'s review step, before the sub-PR is marked ready, for a UI slice. It reads
`omni kb show design` first. It is **bounded**: one look, one batch of fixes, at most one confirming
look.

1. **Critique** against `product`, `system` and `deliberate`: tokens and components used, never a
   raw value where a token exists; the product's voice; the hierarchy reads.
2. **Floor:** every check in `floor`, on the built result.
3. **Lint:** `commands.design`, when set (for example `npx impeccable detect src`). Null → the line
   `Design lint: not set here`.
4. **Screenshots** at the `review` widths of the screens the slice changed, compared with the
   "after" screen of the PRD's before/after page.
5. **Fix** what it found, in one batch, then look once more.

**Never blocking.** A finding never stops the slice, the wave or the gate, and never turns a check
red. What it fixed is listed; what it chose not to fix becomes an outbox item, as any decision taken
alone does. When the app cannot run or be seen here, it says so and nothing is reported as seen.

**Visible.** The sub-PR body gets a **Design review** section: one ✓, ✗ or — line per step, the
screenshots when there are any, and what was fixed.

`/omni:visual-fix` runs the same review at its real check (step 7), compared with the variation the
person picked, under the same never-blocking rule.

### 4. Invade fills it

`/omni:invade`'s facet 4 gets a `design` row: theme and token files, CSS custom properties,
Tailwind or theme config, the component library and stories, fonts, global styles, an existing
`DESIGN.md`, the screens and their copy. It fills `product`, `system`, `deliberate` and `review`
with `path@hash` evidence, leaves a `TODO(human)` question where the evidence is missing (never an
invented direction), and proposes `design.paths` and, when a design linter is already installed,
`commands.design`. `--refresh` redoes the form when those files move. A repository with no screen
keeps the form blank.

### 5. The other readers

- **`/omni:think-big`:** the fuel sheet's "Today's product" is the `design` form; the Craft critic
  judges against it.
- **`/omni:brainstorm`:** the before/after page's "after" uses the product's tokens and components
  as the form names them.

## Decisions

- **Product first** (the person, 2026-10-09): the craft rules are defaults that never override what
  the repository deliberately does.
- **Auto-review starts on its own** for UI work (the person): no one has to ask for it.
- **Nothing blocking** (the person): the review, the lint and the UI check only report.
- **Markdown and config, no hook, no install of impeccable:** the kit stays agent-agnostic and runs
  no code a repository wrote; impeccable stays one possible `commands.design`.
- **One form, not two:** the craft floor and refuse list are slots of `design`, so a repository
  overrides them the way it overrides any section.
- **Objection** (persona:F-E Developer): "a generic rule list that flags our deliberate choices,
  and a screenshot round on every slice, is noise that slows me down." Settled `accepted`: the
  `deliberate` slot wins over the rules, the review is bounded, and it runs only on UI slices.
- **Proof video:** no.

## User stories

- As a front-end developer, the screens the loop builds use our tokens and components and look like
  our product, not a template.
- As a PM, a UI slice comes back already checked on mobile and desktop against the mockup I
  approved, with the screenshots on the sub-PR.
- As a lead engineer, our design system is written once, in the playbook, and every agent reads it.
- As a repository with its own taste, I rewrite the refuse list and the kit stops flagging it.

## Scope

In: the form and its template, the two config keys, `omni design touched`, the skill changes above,
help, guide and attribution.

Out: a design hook on file edits; installing or vendoring impeccable; live browser variants;
impeccable's 20+ refinement commands (bolder, quieter, delight…); any blocking check.

## Test seams

- `kit/lib/playbook/forms.test.ts`, `templates.test.ts`, `kb.test.ts`, `init.test.ts`,
  `profiles.test.ts`: the 15th form, its slots, and the counts that list forms.
- A `design.test.ts` beside the form: a repository's `refuse` section replaces the kit default; a
  `See: DESIGN.md` pointer resolves.
- `kit/lib/config.test.ts`: `design.paths` defaults to `[]`; `commands.design` to null.
- `omni design touched`: `ui: yes` with the matching paths, `ui: no`, `ui: unknown` on empty paths,
  exit 0 in every case; on a temporary git repository.
- `kit/test/plugin.test.ts`: do-work, visual-fix, plan, invade and think-big name
  `omni kb show design` and `omni design touched`; do-work's review says it never blocks.

## Risks

Merging publishes a new kit release: target repositories get the blank `design` form on
`omni update`, and their agents start the auto-review once `design.paths` is set or a slice is
judged UI. A review that misjudges costs a screenshot round, never a red check. Rollback: revert
the feature PR; the form left blank in a repository is harmless.

## Acceptance criteria

1. `omni kb show design` in a repository that never filled it prints the six sections, `floor` and
   `refuse` with the kit default, the others as `[hole]`.
2. A repository section `refuse` replaces the kit default when shown.
3. `omni design touched` prints `ui: yes` and the matching paths for a diff that touches
   `design.paths`, `ui: no` for one that does not, and `ui: unknown` when the list is empty; it
   exits 0 in all three.
4. `/omni:do-work`'s review step runs the auto-review when the slice is `ui: yes` or the check says
   `ui: yes`, and writes a **Design review** section on the sub-PR.
5. No step of the auto-review can fail the slice, the wave or the gate: its findings are fixed,
   listed or sent to the outbox.
6. `/omni:visual-fix`'s real check runs the same review against the picked variation.
7. `/omni:invade` fills the `design` form from evidence with `path@hash`, and proposes
   `design.paths`.
8. `omni help design` explains the form, the precedence and the review; the guide has a page.
9. The kit credits impeccable (Apache-2.0) for the adapted floor and refuse list.
