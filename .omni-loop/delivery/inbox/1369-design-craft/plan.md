# Plan: Design craft that follows the product

PRD #1369. The spec is `spec.md`, beside this plan. The feature branch `feat/design-craft` goes into
`main` through one feature PR; each slice is a sub-PR from `feat/design-craft--<slice>` into the
feature branch.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The `design` form: six slots, the product-first opener, the kit's floor and refuse defaults adapted from impeccable and credited | `kit/lib/playbook/` `kit/templates/playbook/design.md` `kit/templates/README.md` `kit/NOTICE.md` `kit/bin/kb.test.ts` `kit/bin/init.test.ts` `kit/bin/omni.test.ts` `kit/test/profiles.test.ts` `kit/test/bundle-playbook.test.ts` `kit/bin/__snapshots__/` | — | 1 |
| s2 | The `design.enabled` flag (default off), `design.paths`, `commands.design` and `omni design touched` (design: off / ui: yes / no / unknown, always exit 0), with `omni help design` | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/design/` `kit/bin/commands/design.ts` `kit/bin/commands/index.ts` `kit/bin/design.test.ts` `kit/bin/omni.test.ts` `kit/bin/__snapshots__/` `kit/lib/help/` | — | 2 |
| s3 | `/omni:do-work` spots UI work and runs the bounded, never-blocking auto-review with a Design review section; `/omni:visual-fix` runs it at its real check; `/omni:plan` marks UI slices | `kit/plugin/skills/do-work/` `kit/plugin/skills/visual-fix/` `kit/plugin/skills/plan/` `kit/porting/plugin--do-work.md` `kit/porting/plugin--plan.md` `kit/test/plugin.test.ts` | s1, s2 | 3 |
| s4 | `/omni:invade` fills the form from evidence and proposes `design.paths` and `commands.design`; think-big's Craft critic and brainstorm's before/after read the form | `kit/plugin/skills/invade/` `kit/plugin/skills/think-big/` `kit/plugin/skills/brainstorm/` `kit/porting/plugin--brainstorm.md` `kit/test/plugin.test.ts` `kit/test/brainstorm-concept.test.ts` | s1, s2 | 4 |
| s5 | The guide's design page and the loop pages that mention the review | `docs/guide/` | s3, s4 | 5 |

Shared ground:

- `kit/bin/omni.test.ts` and `kit/bin/__snapshots__/`: s1 (the form count and `kb` output) and s2
  (the new command); s2 waits for wave 2.
- `kit/test/plugin.test.ts`: s3 and s4 each add the lines their skills must say; s4 waits for wave 4.

`kit/dist/` is generated from `kit/lib/`, `kit/bin/` and `kit/templates/`: no slice lists it, and
the wave rebuilds it.

## Per slice: done when

**s1**
- `omni kb show design` in a repository that never filled it prints six sections: `floor` and
  `refuse` with the kit default, `product`, `system`, `deliberate` and `review` as `[hole]` or
  empty optional.
- A repository `refuse` section replaces the kit default; `See: DESIGN.md` resolves as a pointer
  (a `design.test.ts` in `kit/lib/playbook/`).
- The form's opener says the product wins: `product`, `system` and `deliberate` override `floor`
  and `refuse`.
- The template credits pbakaus/impeccable (Apache-2.0), and `kit/NOTICE.md` names it.
- Every test that lists or counts forms says 15.

**s2**
- `design.enabled` defaults to `false`, `design.paths` to `[]` and `commands.design` to `null`; all
  read through `omni config`.
- While `design.enabled` is off, `omni design touched` prints `design: off` and exits 0.
- `omni design touched [<base>]` prints `ui: yes` and the matching paths, `ui: no`, or
  `ui: unknown` when `design.paths` is empty; it exits 0 in all three (tested on a temporary git
  repository).
- `omni help design` explains the form, the precedence, the check and that nothing blocks.

**s3** (`ui: yes`: the skills that drive screen work)
- Each skill reads `omni config design.enabled` first; off, it runs no auto-review and the
  sub-PR has no Design review section.
- `/omni:do-work`'s review step runs `omni design touched`, and runs the auto-review when the
  slice is marked `ui: yes` in its plan or the check prints `ui: yes`; on `ui: unknown` it judges
  from the diff and says so.
- The auto-review reads `omni kb show design`, then: critique, floor, `commands.design` (or
  `Design lint: not set here`), screenshots at the `review` widths against the PRD's before/after
  "after", one batch of fixes, one confirming look.
- It never fails the slice, the wave or the gate: what it did not fix becomes an outbox item.
- The sub-PR body has a **Design review** section, one ✓, ✗ or — line per step.
- `/omni:visual-fix` runs the same review at its real check against the picked variation.
- `/omni:plan` writes `ui: yes` in the done-when of a slice whose territory meets `design.paths`.
- `kit/test/plugin.test.ts` holds each of these lines.

**s4**
- Each skill reads `omni config design.enabled` first; off, invade leaves the form blank and
  proposes no `design.paths` (it may propose turning the flag on when the repository has
  screens), and think-big and brainstorm do not read the form.
- `/omni:invade`'s per-form table has a `design` row (tokens, CSS custom properties, theme or
  Tailwind config, components and stories, fonts, global styles, `DESIGN.md`, screens and copy);
  it fills the form with `path@hash`, leaves `TODO(human)` where evidence is missing, and proposes
  `design.paths` and, when a design linter is installed, `commands.design`.
- think-big's fuel sheet "Today's product" reads `omni kb show design`; the Craft critic judges
  against it.
- brainstorm's before/after step builds the "after" from the form's tokens and components.
- `kit/test/plugin.test.ts` holds each of these lines.

**s5**
- `docs/guide/` has a design page (the form, the precedence, the auto-review, the optional lint,
  impeccable as one lint), linked from the guide's index and `meta.json`, and the loop page
  mentions the review on UI slices.
