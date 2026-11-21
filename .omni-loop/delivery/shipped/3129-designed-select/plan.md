# Plan: One designed Select for every dropdown

PRD #3129, spec in `spec.md` beside this plan. The feature branch `feat/designed-select` merges into
`main` through one feature PR (`Closes #3129`); each slice is a sub-PR from
`feat/designed-select--<slice>` into the feature branch (`Part of #3129`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The designed Select of @omni/ui on Base UI (md and sm, the check glyph, keyboard, dismissal, listbox roles, form post), FilterBar on it, its meta, specimen, DOM test and library screen | `packages/ui/src/Select` `packages/ui/src/FilterBar` `packages/design/src/icons/` `.omni-loop/knowledge/design/screens/select` | — | 1 | build |
| s2 | Ask and agent-connect pick with the Select: the category chip, the share picker, the workspace history sort, the questions card | `apps/galaxy/src/ask/` `apps/galaxy/src/agent-connect/questions/` `design/baseline.json` | s1 | 2 | build |
| s3 | The dossier page, products and product repositories pick with the Select: version, history, pitch, product and tech-approval pickers, approvers, the pitch form's private Select, links and plan repository | `apps/galaxy/src/dossier/page/` `apps/galaxy/src/products/` `apps/galaxy/src/product-repositories/` `design/baseline.json` | s2 | 3 | build |
| s4 | Every other app page picks with the Select: product knowledge and its search eval, constituents, knowledge repo picker, missions, runners, profile tokens, settings repository line, JEV, idea members, personas, fixes | `apps/galaxy/src/product-knowledge/` `apps/galaxy/src/knowledge/` `apps/galaxy/src/missions/` `apps/galaxy/src/runners/page/` `apps/galaxy/src/profile/` `apps/galaxy/src/omni-settings/` `apps/galaxy/src/jev/settings/` `apps/galaxy/src/ideas/members/` `apps/galaxy/src/business/` `apps/galaxy/src/fixes/` `design/baseline.json` | s3 | 4 | build |
| s5 | The ratchet's raw-select rule refuses any new raw select; the shared classes no page uses any more are deleted | `scripts/design-ratchet` `design/baseline.json` `apps/galaxy/src/ask/page/share.css` `apps/galaxy/src/ask/page/history.css` `apps/galaxy/src/products/products.css` | s4 | 5 | build |

**Shared ground.** `design/baseline.json` is declared by s2, s3, s4 and s5: the ratchet fails on a
baseline line whose breach is gone, so every slice that removes a file's last raw element deletes its
line, and the four run in waves 2 to 5, one after another. `apps/galaxy/src/ask/page/share.css` and
`history.css` (s2's directory) and `apps/galaxy/src/products/products.css` (s3's) hold
`ask-share-pick` and `products-look-select`, which pages of s2, s3 and s4 share: no migration slice
deletes them, s5 does once the last user is gone, in a later wave than their owners. Each migrated
screen's test sits beside it, inside its slice's territory. `packages/design/src/icons/` feeds the
generated `apps/omni-app/api/`, which no slice commits.

## Per slice: done when

### s1 (`ui: yes`)

- `Select` renders Base UI's Select: a trigger in the Input's look (`md`) or compact (`sm`), a popup
  with the Menu's panel and items, a `check` glyph on the picked option; `onValueChange(value)`
  replaces `onChange(event)`; `Field` wiring kept.
- The `check` glyph is in the 1-bit set of `@omni/design`, and its icon tests pass.
- `Select.dom.test.ts` proves AC-1 to AC-4: keyboard (arrows, type-ahead, Enter, Escape), outside
  click, focus back on the trigger, listbox and option roles with `aria-selected`, the hidden input
  posting `name=value` in a form, `disabled` and `invalid`.
- `FilterBar` passes `size="sm"` and calls `onSelect(name, value)` as before.
- `Select.meta.ts` no longer says "native select"; the specimen shows the open list on `/design`.
- The draft screen `select` matches what was built; it stays a draft.

### s2 (`ui: yes`)

- `CategoryChip`, `ShareButton`, `WorkspaceHistory` and `QuestionsCard` render `<Select>` (`sm`
  inline), no raw `<select>` left under `apps/galaxy/src/ask/` or `agent-connect/questions/`.
- Each has a test that picking an option calls its save with that option's value (AC-5);
  `share-render.test.ts` reads the new markup.
- `ask-category-pick` is deleted from `ask.css`; `pnpm design` is green with the baseline shrunk.

### s3 (`ui: yes`)

- `VersionPicker`, `DossierHistory`, `PitchPane`, `ProductPicker`, `RequestTechApproval`,
  `approvers-section`, `LinksSection`, `PlanRepositorySection` and the eight uses of
  `pitch-form.tsx`'s private Select render `<Select>`; the private Select is gone.
- Each has a test that picking an option calls its save with that value (AC-5).
- `pnpm design` green, the baseline shrunk where a file's last raw element went.

### s4 (`ui: yes`)

- `KnowledgeTabPage`, `EvalControls`, `ConstituentsClient`, `RepoPicker`, `RoomTab`, `MissionsTab`,
  runners `actions`, `TerminalTokensCard`, `SettingsRepositoryLine`, `JevView`, `MemberControls`,
  `PersonasSection` and `FixList` render `<Select>`; no raw `<select>` is left under
  `apps/galaxy/src/` (AC-6, first half).
- Each has a test that picking an option calls its save with that value (AC-5);
  `knowledge/render.test.ts` reads the new markup.
- `pnpm design` green, the baseline shrunk.

### s5 (`ui: yes`)

- `scripts/design-ratchet.ts` reports a JSX `<select>` as `raw-select`, and `raw-component` no
  longer counts it; the header comment says so.
- `scripts/design-ratchet.test.ts` proves AC-7 (a `<select>` added to a file listed for
  `raw-component` fails as `raw-select`) and AC-6 (no `raw-select` line in the baseline).
- `ask-share-pick` and `products-look-select` are deleted from the stylesheets once nothing uses
  them; `pnpm design` and the full `pnpm test` and `pnpm lint` are green.
