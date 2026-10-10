# Plan: Design craft that follows the product

PRD #1369. The spec is `spec.md`, beside this plan. The feature branch `feat/design-craft` goes into
`main` through one feature PR; each slice is a sub-PR from `feat/design-craft--<slice>` into the
feature branch.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The `design` form: four slots and the product-first opener | `kit/lib/playbook/` `kit/templates/playbook/design.md` `kit/templates/README.md` `kit/bin/kb.test.ts` `kit/bin/init.test.ts` `kit/bin/omni.test.ts` `kit/test/profiles.test.ts` `kit/test/bundle-playbook.test.ts` `kit/bin/__snapshots__/` | — | 1 |
| s2 | The `design.enabled` flag (default off), `design.paths`, `commands.design` and `omni design touched` (design: off / ui: yes / no / unknown, always exit 0), with `omni help design` | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/design/` `kit/bin/commands/design.ts` `kit/bin/commands/index.ts` `kit/bin/design.test.ts` `kit/bin/omni.test.ts` `kit/bin/__snapshots__/` `kit/lib/help/` | — | 2 |
| s3 | `/omni:pixel-perfect`: impeccable's critique, audit, polish, harden, typeset, layout, adapt, clarify and craft floor imported at d631a882 and tailored, plus the kit's `review`; porting note, NOTICE, `omni help pixel-perfect` | `kit/plugin/skills/pixel-perfect/` `kit/porting/plugin--pixel-perfect.md` `kit/NOTICE.md` `kit/lib/help/` `kit/test/plugin.test.ts` | s1, s2 | 3 |
| s4 | `/omni:do-work` spots UI work and follows `/omni:pixel-perfect review`, never blocking, with a Design review section; `/omni:visual-fix` follows it at its real check; `/omni:plan` marks UI slices | `kit/plugin/skills/do-work/` `kit/plugin/skills/visual-fix/` `kit/plugin/skills/plan/` `kit/porting/plugin--do-work.md` `kit/porting/plugin--plan.md` `kit/test/plugin.test.ts` | s3 | 4 |
| s5 | `/omni:invade` fills the form from evidence and proposes the flag, `design.paths` and `commands.design`; think-big's Craft critic and brainstorm's before/after read the form | `kit/plugin/skills/invade/` `kit/plugin/skills/think-big/` `kit/plugin/skills/brainstorm/` `kit/porting/plugin--brainstorm.md` `kit/test/plugin.test.ts` `kit/test/brainstorm-concept.test.ts` | s3 | 5 |
| s6 | The guide's design page and the loop pages that mention the review | `docs/guide/` | s4, s5 | 6 |

Shared ground:

- `kit/bin/omni.test.ts` and `kit/bin/__snapshots__/`: s1 (the form count and `kb` output) and s2
  (the new command); s2 waits for wave 2.
- `kit/lib/help/`: s2 (`omni help design`) and s3 (`omni help pixel-perfect`); s3 waits for wave 3.
- `kit/test/plugin.test.ts`: s3, s4 and s5 each add the lines their skills must say; waves 3, 4
  and 5.

`kit/dist/` is generated from `kit/lib/`, `kit/bin/` and `kit/templates/`: no slice lists it, and
the wave rebuilds it.

## Per slice: done when

**s1**
- `omni kb show design` in a repository that never filled it prints four sections: `product` and
  `system` as `[hole]`, `deliberate` and `review` empty optional.
- A repository section shows as `[repo]`; `See: DESIGN.md` resolves as a pointer (a
  `design.test.ts` in `kit/lib/playbook/`).
- The form's opener says the product wins over the craft floor and the refuse list.
- Every test that lists or counts forms says 15.

**s2**
- `design.enabled` defaults to `false`, `design.paths` to `[]` and `commands.design` to `null`; all
  read through `omni config`.
- `omni design touched [<base>]` prints `design: off` while the flag is off, else `ui: yes` and the
  matching paths, `ui: no`, or `ui: unknown` when `design.paths` is empty; it exits 0 in every case
  (tested on a temporary git repository).
- `omni help design` explains the form, the flag, the check and that nothing blocks.

**s3** (`ui: no`: Markdown only)
- `kit/plugin/skills/pixel-perfect/SKILL.md` and `reference/` hold critique, audit, polish,
  harden, typeset, layout, adapt, clarify, craft-floor and review, imported from
  `pbakaus/impeccable@d631a8827f99414d2b6daba4ef08b7f8701751d7` and tailored as the spec's table
  says.
- The skill reads `omni config design.enabled` first (off: one line saying how to turn it on, then
  stop), then `omni kb show design`; the product wins over the floor and the refuse list.
- `review` is bounded (one look, one batch, one confirming look), runs `commands.design` when set,
  screenshots at the form's widths, and never blocks.
- No file names `scripts/impeccable`, `PRODUCT.md`, `.impeccable/` or a Claude-only path.
- `kit/porting/plugin--pixel-perfect.md` names the source commit, what was left out and every
  change; `kit/NOTICE.md` credits impeccable and Anthropic's frontend-design skill under
  Apache-2.0 and says the files were modified.
- `omni help pixel-perfect` lists its commands.
- `kit/test/plugin.test.ts` holds each of these lines.

**s4** (`ui: yes`: the skills that drive screen work)
- Each skill reads `omni config design.enabled` first; off, it runs no review and the sub-PR has no
  Design review section.
- `/omni:do-work`'s review step runs `omni design touched`, and follows `/omni:pixel-perfect
  review` when the slice is marked `ui: yes` or the check prints `ui: yes`; on `ui: unknown` it
  judges from the diff and says so.
- It never fails the slice, the wave or the gate: what it did not fix becomes an outbox item.
- The sub-PR body has a **Design review** section, one ✓, ✗ or — line per step.
- `/omni:visual-fix` follows the same review at its real check against the picked variation.
- `/omni:plan` writes `ui: yes` in the done-when of a slice whose territory meets `design.paths`.
- `kit/test/plugin.test.ts` holds each of these lines.

**s5**
- Each skill reads `omni config design.enabled` first; off, invade leaves the form blank and
  proposes no `design.paths` (it may propose turning the flag on when the repository has
  screens), and think-big and brainstorm do not read the form.
- `/omni:invade`'s per-form table has a `design` row (tokens, CSS custom properties, theme or
  Tailwind config, components and stories, fonts, global styles, `DESIGN.md`, screens and copy);
  it fills the form with `path@hash`, leaves `TODO(human)` where evidence is missing, and proposes
  the flag, `design.paths` and, when a design linter is installed, `commands.design`.
- think-big's fuel sheet "Today's product" reads `omni kb show design`; the Craft critic judges
  against it and the craft floor.
- brainstorm's before/after step builds the "after" from the form's tokens and components.
- `kit/test/plugin.test.ts` holds each of these lines.

**s6**
- `docs/guide/` has a design page (the flag, `/omni:pixel-perfect` and its commands, the form, the
  precedence, the auto-review, the optional lint, the impeccable credit), linked from the guide's
  index and `meta.json`, and the loop page mentions the review on UI slices.
