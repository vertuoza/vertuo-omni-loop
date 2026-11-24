# Plan: A settings kit in the design system

PRD #3217, spec beside this plan (`spec.md`). The feature branch `feat/settings-design-kit` goes into `main` as the feature PR (`Closes #3217`); each slice is a sub-PR from `feat/settings-design-kit--<slice>` into the feature branch.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `@omni/design` gains a React-free `settings` module: the class and markup contract of SettingsPage, SettingsSection (with anchor id), SettingsRow, the five field states with one wording each, danger zone, notice and empty state, and a tokens-only stylesheet that passes contrast in both themes and the anti mode | `packages/design/` `apps/galaxy/src/design-system.test.ts` | — | 1 | build |
| s2 | The galaxy app's thin React layer `settings-kit/` renders each block from that contract, and exposes all of them from one entry | `apps/galaxy/src/settings-kit/` | s1 | 2 | build |
| s3 | `/design` shows each block in each of its states | `apps/galaxy/src/design/` `apps/galaxy/app/design/` | s2 | 3 | build |

Shared ground: none. No two slices declare the same prefix, and the chain s1, s2, s3 runs one slice per wave because each needs the one before it (s2 imports s1's contract, s3 renders s2's components). `apps/galaxy/src/design-system.test.ts` (it reads the kit's stylesheet for AC-4 and AC-5) is owned by s1 alone; s3 does not edit it. Generated paths are never listed.

## Per slice: done when

### s1 (`ui: yes`)
- `packages/design/src/settings.ts` is re-exported by `packages/design/src/index.ts`, with no React import; `packages/design/src/settings.test.ts` checks each block's class contract.
- The kit's stylesheet draws only with role tokens, space, radius and type; no colour literal and no `:root` colour is declared (AC-4), and `design-system.test.ts` stays green.
- The kit's text and edge pairs pass the token contrast test in each theme and the anti mode (AC-5).
- Idle, dirty, saving, saved and error each carry one shared wording, readable from the module (AC-3).
- The package README lists the `settings` module.

### s2 (`ui: yes`)
- The kit's exports expose SettingsPage, SettingsSection, SettingsRow, the field states, the danger zone, the notice and the empty state (AC-1).
- A SettingsSection given the id `keys` renders its heading with that id, reachable at `#keys` (AC-2).
- Each of the five field states renders its shared wording (AC-3).
- A row carries the class that stacks it on a narrow viewport; render tests follow `SectionTabs.render.test.ts`.
- No existing page imports the kit: no page moves.

### s3 (`ui: yes`)
- `/design` renders a section with each block in each of its states (AC-6), covered by a render test beside `render.test.ts`.
- `pnpm design` is not made worse against `design/baseline.json`.
