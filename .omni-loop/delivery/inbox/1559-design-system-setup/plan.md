# Plan: A design system agents build from

PRD #1559, spec in `spec.md` beside this plan. The feature branch `feat/design-system-setup` merges
into `main` through one feature PR (`Closes #1559`). Each slice is a sub-PR from
`feat/design-system-setup--<slice>` into the feature branch (`Part of #1559`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `design.system` and the DESIGN.md reader; `omni design parts` lists the closed list | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/design/system/` `kit/bin/commands/design.ts` `kit/bin/design.test.ts` `kit/lib/help/` | — | 1 |
| s2 | A library screen takes a `picture`; `/omni:pixel-perfect lock` records it | `kit/lib/design/screens.ts` `kit/lib/design/screens.test.ts` `kit/plugin/skills/pixel-perfect/reference/lock.md` `kit/test/design-picture.test.ts` | — | 1 |
| s3 | `omni design parts --check` on a mockup and on a diff | `kit/lib/design/parts/` `kit/bin/commands/design.ts` `kit/bin/design.test.ts` `kit/lib/help/` | s1 | 2 |
| s4 | `omni check design` warns on drift between DESIGN.md, the code and the library | `kit/lib/design/check-design.ts` `kit/bin/check-design.test.ts` | s1, s2 | 2 |
| s5 | `/omni:pixel-perfect init`: read an existing system, or propose starters, into DESIGN.md; the form's `See:` line; invade points at it | `kit/plugin/skills/pixel-perfect/SKILL.md` `kit/plugin/skills/pixel-perfect/reference/init.md` `kit/plugin/skills/invade/` `kit/templates/playbook/design.md` `kit/lib/playbook/design.test.ts` `kit/test/design-init.test.ts` | s1 | 2 |
| s6 | The review in up to three rounds, with the parts check and one outbox item per off-list part; plan and do-work read the parts and the reference screen before building | `kit/plugin/skills/pixel-perfect/reference/review.md` `kit/plugin/skills/do-work/` `kit/plugin/skills/plan/` `kit/test/design-review-rounds.test.ts` | s2, s3 | 3 |
| s7 | Mockups build from the list: brainstorm, visual-fix and think-big tag parts and run the parts check before showing a page | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/visual-fix/` `kit/plugin/skills/think-big/` `kit/test/design-mockup-parts.test.ts` | s3 | 3 |
| s8 | The guide explains DESIGN.md, `init`, the parts check, the drift warnings and the three rounds, with its diagrams | `docs/guide/design.md` `docs/guide/diagrams/design-` | s4, s5, s6, s7 | 4 |
| s9 | Dogfood: omni-loop's own DESIGN.md read from `packages/design`, `init` on a fixture repository with no design system, and the report | `DESIGN.md` `.omni-loop/knowledge/playbook/design.md` `.omni-loop/knowledge/design/screens/` `kit/test/fixtures/no-design-system/` `.omni-loop/delivery/inbox/1559-design-system-setup/dogfood.md` | s4, s5, s6, s7 | 4 |

Shared ground: `kit/bin/commands/design.ts`, `kit/bin/design.test.ts` and `kit/lib/help/` are
declared by s1 and s3 (s3 adds `--check` to the command s1 adds); s3 is blocked by s1, so they sit
in waves 1 and 2. Every skill slice keeps its tests in a test file of its own under `kit/test/`
rather than in `kit/test/plugin.test.ts`, so no two slices share a test file. `kit/dist/` is
generated from `kit/lib/` and `kit/bin/` and listed by no slice.

## Per slice: done when

**s1**
- `omni config design.system` prints `DESIGN.md` by default, and a repository can name another path.
- The reader parses a fixture DESIGN.md: the front matter token groups, each `###` part under
  Components with Summary, Variants, States, Tokens, Accessibility, Do, Don't and Code, and the
  Reference screens section; an unresolved `{colors.x}` reference and a file in another shape are
  named, never thrown.
- `omni design parts` lists every part with its variants, states and code paths, prints
  `parts: no DESIGN.md (run /omni:pixel-perfect init)` without one, prints `design: off` with design
  off, and exits 0 in each case; `omni help design` names it.

**s2**
- The screen reader takes an optional `picture:` path and still refuses any other new field.
- `/omni:pixel-perfect lock` takes the real screen's screenshot at the form's widths and records it as
  `picture`; with no browser it locks without one and says so.

**s3**
- `omni design parts --check <page>` prints `off-list:` for a `data-part` not on the list and
  `untagged:` for a control with no tag, on fixture pages, and exits 0.
- `omni design parts --check <ref>` names the parts whose `Code` paths a diff changes and a new
  component file under `design.paths` no part names, in a temporary git repository; it prints
  `parts: unknown` when it cannot tell, and exits 0.

**s4**
- `omni check design` warns on a part whose code path is gone, a component file under
  `design.paths` no part names, an unresolved token reference and a reference screen the library
  does not hold; a clean fixture prints no warning, and a warning never turns the check red.

**s5**
- `/omni:pixel-perfect init` is in the skill's command table; with design off it prints one line and
  does nothing.
- Its reference: a repository with a system is read into DESIGN.md with each entry naming its file,
  and a `TODO(human)` where the files are silent; a repository with none gets two or three rendered
  starter directions, checked against the craft floor's refuse list, and the pick written as
  DESIGN.md plus draft reference screens; one docs-only pull request; never a lock, never code.
- The design form template's System slot shows the `See: DESIGN.md` line; `/omni:invade` gives the
  `init` line where it finds screens and no DESIGN.md, and never writes DESIGN.md.
- `kit/test/design-init.test.ts` holds these rules.

**s6**
- The review runs at most three rounds of screenshot, critique against DESIGN.md and the reference
  screen's picture, and fix; it stops on a clean round; the Design review section gains the
  `Rounds — <n> of 3` and `Parts — …` lines.
- An off-list part in the slice's diff raises exactly one medium outbox item per part, with the
  DESIGN.md entry it would add, and never blocks.
- `/omni:plan` names the parts and the reference screen on each `ui: yes` slice; `/omni:do-work`
  reads DESIGN.md, that screen's file, mockup and picture before writing the slice.
- With design off or no DESIGN.md, each skill reads nothing new.

**s7**
- With design on and a DESIGN.md, the before/after page, the visual-fix variations and the think-big
  cards and prototypes are drawn from listed parts and semantic tokens, each part tagged
  `data-part`; `omni design parts --check` runs beside the word pass before anyone sees the page,
  untagged findings are fixed, and an off-list part is named under its mockup.
- With design off or no DESIGN.md, each skill draws as it does today.

**s8**
- `docs/guide/design.md` explains DESIGN.md and `design.system`, `/omni:pixel-perfect init`, the
  parts list and `--check`, the drift warnings, the three rounds and the `picture` of a locked
  screen; a diagram shows a UI slice from DESIGN.md to the Design review; the guide's tests are
  green.

**s9**
- omni-loop has a DESIGN.md read from `packages/design` by `init`'s reading path, each entry naming
  its file, and its design form's System slot points at it; `omni check design` is green with it.
- `init`'s starter path, run on `kit/test/fixtures/no-design-system/`, produces a DESIGN.md that
  `npx @google/design.md lint` accepts; `dogfood.md` records both runs, what each tool got wrong,
  and each follow-up as a medium outbox item.
