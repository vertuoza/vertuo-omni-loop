---
prd: 1369
title: Design craft that follows the product
blocked-by: none
spec: file
phase0: server
---

# Design craft that follows the product

**Date:** 2026-10-09, reworked 2026-10-10 · **PRD:** #1369
**Touches:**
- `kit/plugin/skills/pixel-perfect/` (new: `/omni:pixel-perfect`, its `SKILL.md` and `reference/`,
  imported from impeccable and tailored)
- `kit/porting/plugin--pixel-perfect.md` (new: the import's source, commit and every change),
  `kit/NOTICE.md` (new: the Apache-2.0 attribution)
- `kit/lib/playbook/forms.ts` (a 15th form, `design`) and `kit/templates/playbook/design.md` (new)
- `kit/lib/config.ts` (`design.enabled`, `design.paths`, `commands.design`)
- `kit/bin/` (new: `omni design touched`, the UI check)
- `kit/plugin/skills/do-work/SKILL.md`, `visual-fix/SKILL.md`, `plan/SKILL.md`, `invade/SKILL.md`,
  `think-big/SKILL.md`, `brainstorm/SKILL.md`
- `kit/lib/help/entries.ts`, `kit/templates/README.md`, `docs/guide` (the skill, the form, the
  review)

## Problem

Screens the loop builds come out generic. Nothing in the kit tells an agent what the product it
works on looks like, which patterns make a screen read as AI-made, or how to check the built screen
against the mockup the person chose:

- `/omni:do-work` builds a UI slice like any other code. It never looks at the screen.
- `/omni:visual-fix` looks at the real screen once, with no checklist.
- `/omni:think-big`'s Craft critic and `/omni:brainstorm`'s before/after page read the product's
  look ad hoc, with no form behind it.
- `/omni:invade` looks for no tokens, stylesheets or components.

[impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) is the level we want: a product
context every design step reads, a craft floor, a refuse list, focused commands (critique, audit,
polish…) and bounded screenshot passes. Installing it as a dependency would tie the loop to its
engine, its hook and its release cycle, and its generic taste would override products that chose
otherwise. We want its craft, imported into the kit and tailored, with the product's own design
first.

## Solution

### 0. One switch: `design.enabled`

The whole feature sits behind one config flag, **`design.enabled`**, default `false`, so it rolls
out one repository at a time and rolls back with one line.

- **Off** (the default): nothing in the loop changes. `omni design touched` prints `design: off`
  and exits 0; `/omni:do-work` and `/omni:visual-fix` run no auto-review; `/omni:invade` leaves the
  `design` form blank and proposes no `design.paths`; think-big and brainstorm do not read the
  form. `/omni:pixel-perfect` typed by a person says the flag is off and how to turn it on, and
  stops. The form still exists, so `omni kb show design` works and a person may fill it ahead.
- **On:** everything below runs. `/omni:invade` proposes turning it on, as it proposes any config,
  when the repository has screens; a person turns it on by merging that config.

Every skill that reads the form or runs the review checks the flag first, through
`omni config design.enabled`.

### 1. `/omni:pixel-perfect`, imported from impeccable

A new kit skill, typed `/omni:pixel-perfect <command> [target]`. Its Markdown is **imported** from
impeccable at a pinned commit (`pbakaus/impeccable@d631a882`, skill version 4.5.2), then tailored.
No package, binary, hook or network call: the kit owns the copy and changes it as it likes.

**Commands imported** (each a `reference/<command>.md`, as upstream):

| group | command | does |
|---|---|---|
| review | `critique` | does it read as this product: hierarchy, clarity, voice, tokens and components used |
| review | `audit` | accessibility, responsive, performance, theming, scored |
| finish | `polish` | the last pass: alignment with the design system, spacing, states, details |
| finish | `harden` | empty, loading and error states, long text, i18n, edge cases |
| fix | `typeset` | type choices, scale, hierarchy |
| fix | `layout` | spacing, rhythm, grid, alignment |
| fix | `adapt` | mobile and desktop, touch targets, breakpoints |
| fix | `clarify` | labels, errors and empty-state copy in the product's words |
| shared | `craft-floor` | the quality floor and the refuse list, read before any UI edit |

Plus one kit command, **`review`**: the bounded auto-review of section 4 (critique, audit, polish,
screenshots), which `/omni:do-work` and `/omni:visual-fix` follow.

**Left out:** the taste dials (`bolder`, `quieter`, `delight`, `overdrive`, `colorize`, `animate`),
`onboard`, `optimize`, `shape`, `craft`, the live browser mode and `generate`, `init`, `document`
and `extract` (the `design` form and `/omni:invade` do their job), the Rust engine and its context
launcher, the design hook and the per-harness copies.

**Tailored, every change listed in `kit/porting/plugin--pixel-perfect.md`:**

| upstream | here |
|---|---|
| `scripts/impeccable context`, `PRODUCT.md`, `DESIGN.md` | `omni kb show design` (and the file it points at, when it is a pointer) |
| "the brief wins" | the product wins: the form's `product`, `system` and `deliberate` override the craft floor and the refuse list |
| the detector and its hook | `commands.design`, when a repository sets it; never a hook |
| open-ended self-QA | at most one look, one batch of fixes, one confirming look |
| refinements that edit freely | fixes stay inside the slice's territory; anything else is an outbox item |
| Claude-only paths and tool names | the kit's own words: the session's browser tool when it has one, its question tool |

The skill and `kit/NOTICE.md` credit impeccable and Anthropic's frontend-design skill it started
from, under Apache-2.0, and state that the files were modified.

### 2. The `design` form

A 15th playbook form, `design`, extended, read with `omni kb show design`. It resolves like every
form: a pointer, then the repository's own section, then the kit default. Its slots:

| slot | filled by | holds |
|---|---|---|
| `product` · required | invade | who uses it, where, under what light, its voice and words |
| `system` · required | invade | where the tokens, type scale, spacing, colours and components live, by path |
| `deliberate` · optional | invade, a person | what the product does on purpose, including any rule of the craft floor or refuse list it sets aside |
| `review` · optional | invade, a person | how to look at a screen: the routes, the widths (default 390 and 1440), the sign-in |

The form's opener states the precedence: the product wins. A repository whose design system is
already written in a `DESIGN.md` (or any file) points the form at it (`See: DESIGN.md`), the pointer
every form already supports.

### 3. Knowing a change touches a screen

- **`design.paths`**, a config list of globs (default `[]`): where the screens, styles, tokens and
  components live.
- **`omni design touched [<base>]`** prints `ui: yes` with the matching paths, or `ui: no`, for the
  diff from `<base>` (default: the merge base with the branch's base). With `design.paths` empty it
  prints `ui: unknown`; with the flag off, `design: off`. It always exits 0.
- **`/omni:plan`** writes `ui: yes` in the done-when of a slice whose territory meets
  `design.paths`.
- **`/omni:do-work`** runs the auto-review when the slice says `ui: yes` **or** `omni design touched`
  prints `ui: yes`. On `ui: unknown` it judges from the diff whether a screen changed, and says that
  it judged.

### 4. The auto-review: `/omni:pixel-perfect review`

Followed by `/omni:do-work` in its review step, before the sub-PR is marked ready, for a UI slice.
Bounded: one look, one batch of fixes, at most one confirming look.

1. **Critique** (`reference/critique.md`) against the `design` form.
2. **Audit** (`reference/audit.md`) and the craft floor, on the built result.
3. **Lint:** `commands.design`, when set (for example `npx impeccable detect src`). Null → the line
   `Design lint: not set here`.
4. **Screenshots** at the `review` widths of the screens the slice changed, compared with the
   "after" screen of the PRD's before/after page.
5. **Polish** (`reference/polish.md`): fix what steps 1 to 4 found, in one batch, then look once
   more.

**Never blocking.** A finding never stops the slice, the wave or the gate, and never turns a check
red. What it fixed is listed; what it chose not to fix becomes an outbox item, as any decision taken
alone does. When the app cannot run or be seen here, it says so and nothing is reported as seen.

**Visible.** The sub-PR body gets a **Design review** section: one ✓, ✗ or — line per step, the
screenshots when there are any, and what was fixed.

`/omni:visual-fix` follows the same review at its real check (step 7), compared with the variation
the person picked, under the same never-blocking rule.

A person may type any command alone, on any screen: `/omni:pixel-perfect polish the quote page`.

### 5. Invade fills the form

`/omni:invade`'s facet 4 gets a `design` row: theme and token files, CSS custom properties,
Tailwind or theme config, the component library and stories, fonts, global styles, an existing
`DESIGN.md`, the screens and their copy. It fills `product`, `system`, `deliberate` and `review`
with `path@hash` evidence, leaves a `TODO(human)` question where the evidence is missing (never an
invented direction), and proposes `design.enabled: true`, `design.paths` and, when a design linter
is already installed, `commands.design`. `--refresh` redoes the form when those files move. A
repository with no screen keeps the form blank and the flag off.

### 6. The other readers

- **`/omni:think-big`:** the fuel sheet's "Today's product" is the `design` form; the Craft critic
  judges against it and the craft floor.
- **`/omni:brainstorm`:** the before/after page's "after" uses the product's tokens and components
  as the form names them.

## Decisions

- **Import, don't install** (the person, 2026-10-10): impeccable's Markdown is copied into the kit
  at a pinned commit and tailored; no dependency, engine or hook.
- **`/omni:pixel-perfect` holds the commands we need** (the person, 2026-10-10): critique, audit,
  polish, harden, typeset, layout, adapt, clarify, the craft floor, and the kit's `review`.
- **Behind a flag, off by default** (the person, 2026-10-10): `design.enabled` lets each
  repository opt in, and turning it off restores today's loop.
- **Product first** (the person, 2026-10-09): the craft rules never override what the repository
  deliberately does.
- **Auto-review starts on its own** for UI work (the person): no one has to ask for it.
- **Nothing blocking** (the person): the review, the lint and the UI check only report.
- **Objection** (persona:F-E Developer): "a generic rule list that flags our deliberate choices,
  and a screenshot round on every slice, is noise that slows me down." Settled `accepted`: the
  `deliberate` slot wins over the rules, the review is bounded, and it runs only on UI slices.
- **Proof video:** no.

## User stories

- As a front-end developer, the screens the loop builds use our tokens and components and look like
  our product, not a template.
- As a PM, a UI slice comes back already checked on mobile and desktop against the mockup I
  approved, with the screenshots on the sub-PR.
- As anyone on the team, I type `/omni:pixel-perfect polish` or `audit` on a screen and get
  impeccable-level work without installing anything.
- As a lead engineer, our design system is written once, in the playbook, and every agent reads it.

## Scope

In: `/omni:pixel-perfect` and its imported references, the porting note and attribution, the form
and its template, the three config keys, `omni design touched`, the skill changes above, help and
guide.

Out: installing or vendoring impeccable's engine, CLI or hook; live browser variants; the commands
listed as left out; any blocking check; syncing future impeccable releases automatically (a later
import is a PRD of its own).

## Test seams

- `kit/test/plugin.test.ts`: `pixel-perfect` is a skill with its frontmatter; every imported
  reference exists; no reference names `scripts/impeccable`, `PRODUCT.md` or `.impeccable/`;
  the skill reads `omni kb show design` and `omni config design.enabled`; do-work, visual-fix,
  plan, invade and think-big name the review and check the flag first; do-work's review says it
  never blocks.
- `kit/lib/playbook/forms.test.ts`, `templates.test.ts`, `kb.test.ts`, `init.test.ts`,
  `profiles.test.ts`: the 15th form, its slots, and the counts that list forms; a `design.test.ts`
  for the pointer and a repository section.
- `kit/lib/config.test.ts`: `design.enabled` defaults to `false`, `design.paths` to `[]`,
  `commands.design` to null.
- `omni design touched`: `design: off`, `ui: yes` with the matching paths, `ui: no`, `ui: unknown`,
  exit 0 in every case; on a temporary git repository.

## Risks

Merging publishes a new kit release: target repositories get the new skill and a blank `design`
form on `omni update`, and nothing else until a person sets `design.enabled: true`; from then
their agents start the auto-review on UI slices. A review that misjudges costs a screenshot round,
never a red check. The imported text is Apache-2.0: the NOTICE and the porting note must ship with
it. Rollback for one repository: `design.enabled: false`. For the kit: revert the feature PR.

## Acceptance criteria

1. `design.enabled` defaults to `false`; while it is off, `omni design touched` prints
   `design: off`, `/omni:pixel-perfect` says so and stops, and no skill runs the auto-review, fills
   the form or reads it.
2. `/omni:pixel-perfect` exists with the eight imported commands, the craft floor and `review`;
   none of its files names impeccable's engine, `PRODUCT.md` or `.impeccable/`.
3. `kit/porting/plugin--pixel-perfect.md` names the source commit and every change;
   `kit/NOTICE.md` credits impeccable under Apache-2.0.
4. `omni kb show design` in a repository that never filled it prints its four sections, the
   required ones as `[hole]`; a `See: DESIGN.md` pointer resolves.
5. `omni design touched` prints `ui: yes` and the matching paths for a diff that touches
   `design.paths`, `ui: no` for one that does not, and `ui: unknown` when the list is empty; it
   exits 0 in every case.
6. With the flag on, `/omni:do-work`'s review step follows `/omni:pixel-perfect review` when the
   slice is `ui: yes` or the check says `ui: yes`, and writes a **Design review** section on the
   sub-PR.
7. No step of the review can fail the slice, the wave or the gate: its findings are fixed, listed
   or sent to the outbox.
8. `/omni:visual-fix`'s real check follows the same review against the picked variation.
9. `/omni:invade` fills the `design` form from evidence with `path@hash`, and proposes the flag
   and `design.paths`.
10. `omni help pixel-perfect` and `omni help design` explain the skill, the form, the precedence
    and the review; the guide has a page.
