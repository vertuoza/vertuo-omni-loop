# Plan: A design system agents build from

PRD #1559, spec in `spec.md` beside this plan. The feature branch `feat/design-system-setup` merges
into `main` through one feature PR (`Closes #1559`). Each slice is a sub-PR from
`feat/design-system-setup--<slice>` into the feature branch (`Part of #1559`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `design.system` (optional) and the DESIGN.md reader; `omni design parts` lists the closed list | `kit/lib/config.ts` `kit/lib/design/system/` `kit/bin/commands/design.ts` `kit/bin/design-parts.test.ts` `kit/lib/help/` | — | 1 |
| s2 | `omni design parts --check` on a mockup's marked screens and on a diff | `kit/lib/design/parts/` `kit/bin/commands/design.ts` `kit/bin/design-parts.test.ts` `kit/lib/help/` | s1 | 2 |
| s3 | `omni check design` warns on drift between DESIGN.md, the code and the library | `kit/lib/design/check-design.ts` `kit/bin/check-design.test.ts` | s1 | 2 |
| s4 | `/omni:pixel-perfect init`: read an existing system, or propose starters, into DESIGN.md, its reference screens drawn by `mock`; the form's `See:` line; invade points at it | `kit/plugin/skills/pixel-perfect/SKILL.md` `kit/plugin/skills/pixel-perfect/reference/init.md` `kit/plugin/skills/invade/` `kit/templates/playbook/design.md` `kit/lib/playbook/design.test.ts` `kit/test/design-init.test.ts` | s1 | 2 |
| s5 | The review in up to three rounds, touched-only in each, with the parts check and one outbox item per off-list part; plan and do-work read the parts and the reference screen before building | `kit/plugin/skills/pixel-perfect/reference/review.md` `kit/plugin/skills/do-work/` `kit/plugin/skills/plan/` `kit/test/design-review-rounds.test.ts` | s2 | 3 |
| s6 | Mockups build from the list: `mock`, brainstorm's Pixel perfect part, visual-fix and think-big tag parts and run the parts check before showing a page | `kit/plugin/skills/pixel-perfect/mock.md` `kit/plugin/skills/brainstorm/` `kit/plugin/skills/visual-fix/` `kit/plugin/skills/think-big/` `kit/test/design-mockup-parts.test.ts` | s2 | 3 |
| s7 | The guide explains DESIGN.md, `init`, the parts check, the drift warnings and the three rounds, with its diagrams; the porting notes of the skills s4 to s6 changed | `docs/guide/design.md` `docs/guide/diagrams/design-` `kit/porting/plugin--pixel-perfect.md` `kit/porting/plugin--brainstorm.md` `kit/porting/plugin--do-work.md` `kit/porting/plugin--plan.md` | s3, s4, s5, s6 | 4 |
| s8 | Dogfood: omni-loop's own DESIGN.md read from `packages/design`, its six screens' mockups tagged, `init` on a fixture repository with no design system, and the report | `DESIGN.md` `.omni-loop/knowledge/playbook/design.md` `.omni-loop/knowledge/design/screens/` `kit/test/fixtures/no-design-system/` `.omni-loop/delivery/inbox/1559-design-system-setup/dogfood.md` | s3, s4, s5, s6 | 4 |

Shared ground: `kit/bin/commands/design.ts`, `kit/bin/design-parts.test.ts` and `kit/lib/help/` are
declared by s1 and s2 (s2 adds `--check` to the command s1 adds); s2 is blocked by s1, so they sit
in waves 1 and 2. The porting notes of every skill s4 to s6 change are written once, in s7, so no
two slices share one. No slice touches `kit/lib/config.test.ts` or `kit/test/plugin.test.ts`, the
proofs of laws: each keeps its tests in a file of its own. `kit/dist/` is generated from `kit/lib/`
and `kit/bin/` and listed by no slice.

## Per slice: done when

**s1**
- `omni config design.system` prints `DESIGN.md` when unset, and a repository can name another path;
  the default is applied where the key is read, and the design section's shape in
  `kit/lib/config.test.ts` is unchanged.
- The reader parses a fixture DESIGN.md: the front matter token groups, each `###` part under
  Components with Summary, Variants, States, Tokens, Accessibility, Do, Don't and Code, and the
  Reference screens section; an unresolved `{colors.x}` reference and a file in another shape are
  named, never thrown.
- `omni design parts` lists every part with its variants, states and code paths, prints
  `parts: no DESIGN.md (run /omni:pixel-perfect init)` without one, prints `design: off` with design
  off, and exits 0 in each case; `omni help design` names it.

**s2**
- `omni design parts --check <page>` reads only marked screens (`design.words.screen`): it prints
  `off-list:` for a `data-part` not on the list and `untagged:` for a control with no tag, prints
  `no screen marked: skipped` on a page with none, never counts what `design.words.content` holds,
  and exits 0.
- `omni design parts --check <ref>` names the parts whose `Code` paths a diff changes and a component
  file the diff adds under `design.paths` that no part names and no screen's `implements` claims, in
  a temporary git repository; it prints `parts: unknown` when it cannot tell, and exits 0.

**s3**
- `omni check design` warns on a part whose code path is gone, a component file under
  `design.paths` no part names and no screen claims, an unresolved token reference and a reference
  screen the library does not hold; a shared screen's files and a clean fixture print no warning,
  and a warning never turns the check red.

**s4**
- `/omni:pixel-perfect init` is in the skill's command table; with design off it prints one line and
  does nothing.
- Its reference: a repository with a system is read into DESIGN.md with each entry naming its file,
  and a `TODO(human)` where the files are silent; a repository with none gets two or three rendered
  starter directions, checked against the craft floor's refuse list, and the pick written as
  DESIGN.md plus draft reference screens whose mockups `mock` draws; one docs-only pull request;
  never a lock, never code.
- The design form template's System slot shows the `See: DESIGN.md` line; `/omni:invade` gives the
  `init` line where it finds screens and no DESIGN.md, and never writes DESIGN.md.
- `kit/test/design-init.test.ts` holds these rules.

**s5**
- The review's **Bounded** line becomes at most three rounds of screenshot, critique against
  DESIGN.md and the reference screen's mockup, and fix; it stops on a clean round; each round fixes
  only what the diff changed, and a fault in an untouched part stays under Seen, not touched; the
  Design review section gains the `Rounds — <n> of 3` and `Parts — …` lines.
- An off-list part the slice's diff adds raises exactly one medium outbox item per part, with the
  DESIGN.md entry it would add, and never blocks.
- `/omni:plan` names the parts and the reference screen on each `ui: yes` slice; `/omni:do-work`
  reads DESIGN.md, and that screen's file and mockup, before writing the slice.
- With design off or no DESIGN.md, each skill reads nothing new.

**s6**
- With design on and a DESIGN.md, `mock`'s mockups, the marked screens of brainstorm's Pixel perfect
  part, the visual-fix variations and the think-big cards and prototypes are drawn from listed parts
  and semantic tokens, each part tagged `data-part`; `mock`'s **Standing in** takes the faces from
  DESIGN.md's typography; `omni design parts --check` runs beside the word pass before anyone sees
  the page, untagged findings are fixed, and an off-list part is named outside the marked screen.
- A Functional part, and a page that says `Pixel perfect: no screen changes`, draws no part.
- With design off or no DESIGN.md, each skill draws as it does today.

**s7**
- `docs/guide/design.md` explains DESIGN.md and `design.system`, `/omni:pixel-perfect init`, the
  parts list and `--check`, the drift warnings and the three rounds; a diagram shows a UI slice from
  DESIGN.md to the Design review; the guide's tests are green.
- The porting notes of pixel-perfect, brainstorm, do-work and plan name what this PRD changed.

**s8**
- omni-loop has a DESIGN.md read from `packages/design` by `init`'s reading path, each entry naming
  its file, and its design form's System slot points at it; `omni check design` is green with it.
- omni-loop's six library mockups tag their parts with `data-part`, and `omni design parts --check`
  on each prints no `untagged:`.
- `init`'s starter path, run on `kit/test/fixtures/no-design-system/`, produces a DESIGN.md that
  `npx @google/design.md lint` accepts; `dogfood.md` records both runs, what each tool got wrong,
  and each follow-up as a medium outbox item.
