# Plan: Personas

PRD #799, spec beside this plan (`spec.md`). The feature branch `feat/business-personas` goes into
`main` through the feature PR (`Closes #799`). Each slice is a sub-PR from
`feat/business-personas--<slice>` into the feature branch (`Part of #799`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Covers the store and its read. One migration adds `personas` on each product, `valid_persona_avatar()` (skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3, `v` 1, trade a short lower-case word), and the RPCs (add, edit, delete, restore for Undo), refusing `42501`, `P0002` and `22023` with a `hint`. `business_for_repo` returns the product's `personas`, oldest first, with `[]` when there are none. `supabase/checks/personas.sql` proves it in CI. `GET /api/business` and `omni business show [--json]` carry `personas`, and `state` still comes from claims only | `supabase/migrations/` `supabase/checks/personas.sql` `.github/workflows/supabase.yml` `apps/galaxy/src/business-api/` `apps/galaxy/app/api/business/route.ts` `kit/bin/commands/business.mjs` `kit/bin/business.test.mjs` `kit/test/fake-ask-server.mjs` `kit/lib/help/entries.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | Adds the persona sprite family in `packages/design`, built with the forge. It has one body per trade (builder, plumber, heating engineer, electrician, carpenter, roofer, painter, site foreman, office manager, accountant, doctor, nurse, shopkeeper, driver, developer) with its prop, and variations by skin, hair style, hair colour, outfit colour and accessory. `personaGrid(trade, avatar)` is pure and deterministic, and `randomAvatar(seed)` picks a variation. The ranges are exported and equal the database's | `packages/design/src/personas` `packages/design/src/index.mjs` `packages/design/src/index.d.ts` `packages/design/src/index.test.mjs` | — | 1 |
| s3 | Adds the Personas section on Settings › Business (direction A, the card grid). It has the header with the count and + Add a persona, the cards (portrait, name, trade, stance chip, who, uses) and the empty state "No personas yet — agents carry on". The drawer holds the name, the three stance chips, the trade select, who, usage, and a portrait picker of 24 variations with Shuffle; a new persona starts on a random variation. Delete offers Undo for 5 s. Each product tab has its own personas, and "product" is never shown with one product. It works at 393px and in demo mode with sample personas naming no real company | `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` | s1, s2 | 2 |
| s4 | Adds `scripts/personas-import.mjs <workspace-id> <file.json>`. It checks every row (name, stance, trade, who, usage, the product name it belongs to, avatar ranges from `packages/design`) and prints the workspace's name and what it would add. `--write` adds every row, all or none, as the service role, and never changes or deletes an existing persona | `scripts/personas-import` | s1, s2 | 2 |

**Shared ground.**
- **`packages/design/src/index.*`:** s2 only; s3 and s4 import from the package and never edit it.
- **The database:** every table, function and RPC lands in s1's single migration. s3 calls those
  RPCs and s4 inserts as the service role through the same checks, so neither touches `supabase/`.
  The migration's date is checked against the latest one on `main` before the feature PR merges
  (the lesson of #771).
- **The avatar ranges** are written twice, in s1's `valid_persona_avatar()` and in s2's exported
  ranges, from the numbers in s1's row above. s2's test asserts them against those numbers, so the
  two slices agree without sharing a file.
- **`kit/dist/omni.mjs`:** s1 only, rebuilt with `pnpm kit:build` because `kit/test/dist.test.mjs`
  fails on a stale bundle.
- s3 and s4 share no prefix, so both run in wave 2.

## Per slice: done when

**s1**
- `supabase/checks/personas.sql` passes in CI and proves:
  - a member adds, edits, deletes and restores a persona;
  - a member of another workspace and a signed-out caller are refused (`42501`);
  - a bad stance, an empty name, a text over 400 characters and an out-of-range avatar are refused
    (`22023`, the field in `hint`);
  - a persona follows its product;
  - `business_for_repo` returns the product's personas oldest first, and `[]` without.
- `GET /api/business`'s tests: `personas` is present, and `state` does not change with personas.
- `kit/bin/business.test.mjs`: `--json` carries `personas`; `omni business show` prints one line per
  persona under the claims; every other state still exits 0.

**s2**
- Every trade renders at every accessory.
- The same trade and avatar always give the same grid; two different avatars give different grids.
- `randomAvatar(seed)` is deterministic and always in range.
- The exported ranges equal s1's numbers.

**s3**
- Render tests cover:
  - the empty section with its line and + Add a persona;
  - the card grid;
  - the drawer with its fields;
  - the picker showing 24 variations of the chosen trade, and Shuffle showing 24 others;
  - two products with their own personas, and no "product" with one;
  - 393px and demo mode.
- Reducer tests: add, edit, delete, and Undo within 5 s restoring the persona.
- Store tests: the RPC calls and the refusal mapping.

**s4**
- A dry run prints the workspace's name and the rows it would add, and writes nothing.
- One invalid row refuses the whole file, naming the row and the field.
- `--write` adds every row once, and leaves existing personas unchanged.
