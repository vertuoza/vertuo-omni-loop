---
prd: 1559
title: A design system agents build from
blocked-by: none
spec: file
phase0: server
---

# A design system agents build from

**Date:** 2026-10-11 · **PRD:** #1559 · **Builds on:** PRD 1369 (design craft) and PRD 1407 (the
screen library), both shipped
**Research:** [Design systems agents build from](https://claude.ai/code/artifact/20f87031-d53b-4032-8b9b-874d8aebbe10),
the sources this design rests on
**Touches:**
- `kit/lib/design/` (the DESIGN.md reader, the parts check, the drift check, the screen's
  `picture`), `kit/bin/commands/design.ts` (`omni design parts`)
- `kit/lib/config.ts` (`design.system`)
- `kit/lib/design/check-design.ts` (the drift warnings in `omni check design`)
- `kit/templates/playbook/design.md` (the System slot's `See: DESIGN.md` line)
- `kit/plugin/skills/pixel-perfect/` (`init`, and `review` in up to three rounds, with the parts
  check), `brainstorm/`, `visual-fix/`, `think-big/`, `plan/`, `do-work/`, `invade/`
- `docs/guide/design.md` and its diagrams
- omni-loop's own `DESIGN.md` and a fixture repository with no design system (the dogfood)

## Problem

Screens an agent builds in a target repository look generic. PRD 1369 taught the loop to describe a
product's look in the `design` form and to review a screen against it; PRD 1407 gave it a library
of draft and locked screens. Neither gives the agent a **fixed set of parts to build with**:

- The form's System slot names where tokens and components live, by path. The agent still picks
  colours, spacing and component shapes screen by screen, and each mockup invents its own.
- A repository with no design system gets a `TODO(human)` in the System slot, and nothing else. Every
  screen then starts from the model's defaults, which is the generic look itself.
- The library's screens are text and an optional HTML mockup. No screen holds a picture of the real
  screen, so "build it like this one" cannot be shown (1407 dogfood items s9-10, s9-12).
- The review looks once, fixes once and stops. Render feedback is the lever with the best evidence
  behind it (1D-Bench, UICoder), and the loop uses one turn of it.
- 1407's dogfood asks for a component inventory (s9-04); nothing holds one.

Serious design systems that agents use (Primer's MCP, Storybook manifests, shadcn registries,
OpenUI) all do one thing: a single written inventory feeds both the agent's instructions and a
checker, so only listed parts come out. Every one of them except Google's DESIGN.md needs code or a
framework. The kit adds only config and Markdown to a target repository.

## Solution

One file, `DESIGN.md`, in Google's DESIGN.md format, is the design system every drawing and
building skill reads. A command writes it, a check keeps it honest, and the review looks until the
screen matches it. Everything is behind `design.enabled`, as PRD 1369 is, and nothing it finds
blocks a slice.

### DESIGN.md

At the path `design.system` names (default `DESIGN.md`, at the repository's root), written in the
[DESIGN.md format](https://github.com/google-labs-code/design.md): YAML front matter with the
token groups (`colors`, `typography`, `rounded`, `spacing`, `components`), then its prose sections
in its order (Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and
Don'ts). Its own tools read it: `npx @google/design.md lint` (references and WCAG contrast) and
`export` (Tailwind or DTCG tokens). The kit never installs them.

- **Semantic tokens only** reach a screen: `colors.primary`, never a hex value. Primitives exist
  for tokens to point at.
- **Components, a closed list.** Each part is one `###` entry under Components, with these lines:
  `Summary` (one line), `Variants`, `States` (default, hover, focus-visible, active, disabled, and
  loading, error and empty where it shows data), `Tokens` (the tokens it binds), `Accessibility`,
  `Do` and `Don't`, and `Code` (the paths of its implementation, any framework). A part not on the
  list is proposed, never invented.
- **Reference screens,** one omni-loop section after Do's and Don'ts: the names of library screens
  (PRD 1407) a builder copies, two or three of them, each one line on what it shows (a list with its
  empty, loading and error states; a form; a detail or a dashboard).

The `design` form's System slot points at it with `See: DESIGN.md`. The Product, Deliberate,
Review and Language slots stay where they are: the product still wins over the craft floor.

### `/omni:pixel-perfect init`

Run on purpose by a person, once per repository, and again after the system moves.

- **A repository with a design system:** reads its tokens, theme files, component folders,
  Storybook, shadcn `components.json` or Figma links into DESIGN.md, each entry naming the file it
  read. What the files do not say is a `TODO(human)` question, never invented. A link to an existing
  tool is linked, never copied.
- **A repository with none:** asks about the product (who uses it, on what screens, its voice, one
  product it admires), then shows **two or three starter directions** as one rendered page, each a
  full set: about thirty semantic tokens in light and dark, eight to twelve components with every
  state, and two or three reference screens built only from them. Each direction is checked against
  the craft floor's refuse list before it is shown. The person picks one, or asks for another round,
  as `/omni:visual-fix` does.
- **Either way** it writes DESIGN.md, the reference screens as **draft** library screens with their
  mockups, and the System slot's `See:` line, then opens one docs-only pull request a person merges.
  It never locks a screen and never writes code: turning the tokens into CSS or a Tailwind theme is
  the first ordinary slice after it (DESIGN.md's `export` produces the file).
- A DESIGN.md already there in another shape is kept; `init` proposes the missing sections and
  rewrites nothing a person wrote.

`/omni:invade` never writes DESIGN.md: where it finds screens and no DESIGN.md, its report gives
the `/omni:pixel-perfect init` line.

### `omni design parts`

A kit command; it exits 0 whatever it finds.

- `omni design parts` lists the closed list: each part, its variants and states, its code paths.
- `omni design parts --check <file.html>` reads a mockup. Every part a kit skill draws is tagged
  `data-part="<name>"` (beside 1407's `data-screen` and `data-primary`). It prints `off-list:` for a
  tag not on the list, and `untagged:` for a control (button, input, select, link styled as a
  button) carrying no tag.
- `omni design parts --check <ref>` reads a diff. A changed file under a part's `Code` paths is that
  part; a new component file under `design.paths` that no part names is `off-list`. When it cannot
  tell, it prints `parts: unknown` and never guesses.
- With no DESIGN.md it prints `parts: no DESIGN.md (run /omni:pixel-perfect init)`.

### Mockups build from the list

`/omni:brainstorm`'s before/after page, `/omni:visual-fix`'s variations and `/omni:think-big`'s
cards and prototypes, with design on and a DESIGN.md present, are drawn only from listed parts and
semantic tokens, every part tagged. Before anyone sees the page, the skill runs
`omni design parts --check` beside 1407's word pass and fixes each `untagged` finding. An
`off-list` part stays only when the design needs a new part; the page then names it under the
mockup.

### Slices build from the list

- `/omni:plan` writes, on each `ui: yes` slice, the parts it uses and the reference screen it
  copies.
- `/omni:do-work` reads DESIGN.md, that reference screen's file, its mockup and its picture
  **before** it writes the first line of the slice, not only at review.

### The review: up to three rounds

`/omni:pixel-perfect review` (run by `/omni:do-work` and `/omni:visual-fix`) becomes a loop of at
most **three rounds**: screenshots at the form's widths (390 and 1440 when it names none), a
critique against DESIGN.md and the reference screen's picture, one batch of fixes. It stops when a
round finds nothing, or after round three. What is left becomes outbox items, as today. It then runs
`omni design parts --check` on the slice's diff:

- an `off-list` part raises **one medium outbox item per part**: "add `<part>` to DESIGN.md?", with
  the entry it would add. The list grows on purpose, never by accident.
- The sub-PR's **Design review** section gains two lines: `Rounds — <n> of 3` and
  `Parts — all listed` (or the parts it raised).

With no browser where the agent works, it says `— Screens: not seen here`, runs no round, and
reports nothing as seen.

### Pictures of locked screens

A library screen gains an optional `picture:` field: the path of a PNG beside its file.
`/omni:pixel-perfect lock` takes the screenshot of the real screen at the form's widths and records
it. A screen locked before this PRD keeps working; the next review that sees it proposes its picture
in the pull request.

### Drift: `omni check design`

DESIGN.md is kept by hand, so it can drift from the code. `omni check design` adds warnings, never
refusals:

- a part whose `Code` path no longer exists;
- a component file under `design.paths` no part names;
- a token reference that does not resolve, and a reference screen the library does not hold.

Running `/omni:pixel-perfect init` again proposes the fixes in a pull request; `/omni:invade --refresh`
only reports the warnings with that line.

## Decisions

- **DESIGN.md in Google's format, pointed at from the form** (the person, 2026-10-11): one portable
  file other tools also read (its lint and export, impeccable), rather than new slots in the form.
- **A command a person runs, not invade** (the person): `/omni:pixel-perfect init` proposes the
  starter; `/omni:invade` only points at it.
- **Off-list parts raise an outbox item and never block** (the person): one medium item per new
  part, so the list grows on purpose.
- **Reference screens are 1407's library screens** (the person): DESIGN.md names them; the screens
  gain a `picture`. PRD 1407 shipped on 2026-10-11, so nothing blocks this PRD.
- **Up to three rounds of looking and fixing** (the person), the lever with the best evidence.
- **OpenUI's pattern, not its library:** one inventory feeds the instructions and the checker. Its
  runtime, Zod schemas and React code would put code in every target repository and still not
  reach the code a slice ships.
- **`init` writes no code:** the tokens become CSS or a Tailwind theme in the first ordinary slice
  after it.
- **Objection** (persona:F-E Developer): "I already have my components in code and maybe
  Storybook. A hand-kept markdown list will drift from them in a month, and then the agent builds
  from a stale list." Settled `accepted`: the drift warnings in `omni check design`, and
  `/omni:pixel-perfect init` run again proposing their fixes.
- **Proof video:** no.
- **Out:** a Figma or Storybook MCP integration (linked, never driven), turning tokens into code,
  areas with their own system (1407's s9-01), motion and theme slots (s9-03, s9-09).

## User stories

- As a front-end developer, I want the agent to use my Button and my tokens, so that what it builds
  looks like the screens I built.
- As a product manager in a repository with no design system, I want to pick a starter direction
  once, so that every screen after it looks like one product.
- As a lead engineer, I want a new component to come up as a question, so that the system grows by
  decision and not by accident.
- As a reviewer, I want a mockup and a built screen made from the same parts, so that what I
  approved on the before/after page is what ships.

## Scope

In: `design.system`; the DESIGN.md reader; `omni design parts` and `--check`; the drift warnings;
the screen's `picture`; `/omni:pixel-perfect init` and the three-round review; brainstorm,
visual-fix, think-big, plan, do-work and invade reading or pointing at DESIGN.md; the guide; the
dogfood on omni-loop and on a fixture repository with no design system.

Out: see **Decisions**.

## Test seams

- The DESIGN.md reader: front matter tokens, a reference that does not resolve, the Components
  entries with every line, the Reference screens section, a file in another shape; on fixtures.
- `omni design parts --check` on a mockup: a tagged page, an off-list tag, untagged controls; on a
  diff in a temporary git repository: a part's code path changed, a new unlisted component file,
  `parts: unknown`, no DESIGN.md. Exit 0 in every case.
- `omni check design`: each drift warning, and no warning on a clean fixture.
- The screen reader takes `picture` and still refuses any other new field.
- `design.system` resolves like the other `design.*` keys.
- `kit/test/plugin.test.ts`: `init` never locks and never writes outside DESIGN.md, the library and
  the form; the review stops at three rounds and raises one item per off-list part; every drawing
  skill runs the parts check before showing a mockup; do-work reads the reference screen before
  building; every one of them reads nothing new with design off.
- The dogfood: `omni check design` green with DESIGN.md on omni-loop; `init` on the fixture
  repository produces a DESIGN.md that `npx @google/design.md lint` accepts.

## Risks

Merging publishes a kit release. Repositories with `design.enabled` off see nothing new; with it on
and no DESIGN.md, they see one review line pointing at `init`. With a DESIGN.md, reviews take up to
three rounds (more time and tokens on UI slices) and new parts add medium outbox items. omni-loop
gets its own DESIGN.md. Rollback for a repository: remove DESIGN.md or set `design.enabled: false`.
For the kit: revert the feature PR.

## Acceptance criteria

1. `omni config design.system` prints `DESIGN.md` by default, and a repository can name another
   path.
2. `omni design parts` lists every part of a fixture DESIGN.md with its variants, states and code
   paths.
3. `omni design parts --check <page>` prints the off-list and untagged parts of a fixture mockup,
   and exits 0.
4. `omni design parts --check <ref>` names the parts a diff changes and a new unlisted component
   file, prints `parts: unknown` when it cannot tell, and exits 0.
5. `omni check design` warns on a part whose code path is gone, an unlisted component file, an
   unresolved token reference and a missing reference screen.
6. `/omni:pixel-perfect init` on a repository with no design system shows two or three rendered
   starter directions, and after a pick opens a docs-only pull request with a DESIGN.md that
   `npx @google/design.md lint` accepts and its reference screens as drafts.
7. `/omni:pixel-perfect init` on omni-loop reads `packages/design` into DESIGN.md, each entry naming
   the file it came from.
8. A before/after page drawn with design on tags every part with `data-part`, and names an
   off-list part under its mockup.
9. A slice that adds a part not on the list raises exactly one medium outbox item for it, and never
   blocks.
10. The review runs at most three rounds, and its Design review section shows the rounds and the
    parts lines.
11. `/omni:pixel-perfect lock` records a `picture` of the real screen.
12. With `design.enabled` off, none of the above runs and every skill behaves as before.
13. The guide's design page explains DESIGN.md, `init`, the parts check, the drift warnings and the
    three rounds.
