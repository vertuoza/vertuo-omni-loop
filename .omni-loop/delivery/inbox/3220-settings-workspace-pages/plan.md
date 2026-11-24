# Plan: Fleets, Repositories and API keys on the settings kit

PRD #3220, spec beside this plan (`spec.md`). Feature branch `feat/settings-workspace-pages` into `main`
(`Closes #3220`); sub-PRs from `feat/settings-workspace-pages--<slice>` into the feature branch
(`Part of #3220`).

Planned against the code as PRD 3218 leaves it (`app/app/settings/layout.tsx` draws the frame, pages draw
inside `SettingsPage`, `SectionTabs` and `SETTINGS_TABS` gone from Settings) and PRD 3217 (the kit in
`@omni/design` `settings` and `apps/galaxy/src/settings-kit/`: `SettingsPage`, `SettingsSection`,
`SettingsRow`, field states, danger zone, notice, empty state). A slice adopts those blocks; it adds none
to the kit. Where a block the page needs is missing, the page keeps a page-specific style and the slice
records an outbox item.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Fleets is drawn from the kit: sections Your fleets and Retired fleets with anchors, retire through the danger zone, the kit's empty state, a lighter stylesheet that keeps only the mascot, and the `fleet-settings` screen updated | `apps/galaxy/src/fleets/` `apps/galaxy/app/app/settings/fleets/` `apps/galaxy/src/ask/outlines.test.ts` `design/baseline.json` `.omni-loop/knowledge/design/screens/fleet-settings*` | — | 1 | build |
| s2 | Repositories is drawn from the kit: sections Connected and Add a repository with anchors, remove through the danger zone, the kit's empty state, a lighter stylesheet, and the `repositories` screen updated | `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/repositories/` `design/baseline.json` `.omni-loop/knowledge/design/screens/repositories*` | — | 2 | build |
| s3 | API keys is drawn from the kit: sections Keys and Create a key with anchors, revoke and remove through the danger zone, the one-time reveal kept as is, the kit's empty state, a lighter stylesheet, and the `api-keys` screen updated | `apps/galaxy/src/public-api/page/` `apps/galaxy/app/app/settings/api-keys/` `design/baseline.json` `.omni-loop/knowledge/design/screens/api-keys*` | — | 3 | deep |

Shared ground: `design/baseline.json`, declared in s1, s2 and s3. The design ratchet requires the
baseline to match the breaches at every commit, so each slice removes its own page's lines from it and
the three cannot share a wave; the waves are one after the other. The three pages otherwise share no
file: `apps/galaxy/src/product-knowledge/repositories/` (the product's own Repositories tab) is another
screen and is not touched. `apps/galaxy/src/fleets/FleetCard.tsx` and `fleets/model.ts` are imported by
`people/FleetChip.tsx` and `virtual-fleets/drawer/NewVirtualFleet.tsx` (`mascotSvg`, `NEUTRAL`): s1 keeps
both exports as they are. `packages/ui/src/generated/` and `packages/design/design-system.json` (rebuilt
from the screens) are generated: a slice rebuilds them to test, the wave commits the rebuild.
Wave 3 holds s3 alone on purpose: its one-time key reveal is the Legal path (L-GDPR-2).

## Per slice: done when

### s1 (`ui: yes`)
- `FleetsScreen`/`FleetsView` render inside `SettingsPage` with `SettingsSection`s *Your fleets* and *Retired fleets*, no heading or tab row of their own (AC-1).
- Each section heading is reachable at its stable anchor, asserted in `fleets/render.test.ts` (AC-2).
- Retire asks through the kit's danger zone and does nothing until confirmed; the retire confirmation step of today is kept (AC-3).
- A workspace with no fleet shows the kit's empty state with its one action (AC-6).
- What a member, an owner and a signed-out visitor see and do equals today's, in every state: demo, signed-out, no workspace, unreadable, ready (AC-4); existing assertions on old class names move to the kit's markup.
- `fleets.css` keeps only what is specific to the fleet card; `pnpm design` shows no new breach and `design/baseline.json` lists fewer `src/fleets/` lines (AC-7).
- `fleet-settings.md` (and its mock if it names the old page) describes the page as it is now (AC-8).

### s2 (`ui: yes`)
- `RepositoriesScreen`/`RepositoriesView` render inside `SettingsPage` with *Connected* and *Add a repository* sections, no heading or tab row of their own (AC-1).
- Each section heading is reachable at its stable anchor, asserted in `repositories/render.test.ts` (AC-2).
- Remove asks through the kit's danger zone and does nothing until confirmed (AC-3); the undo of today (the removed list and Add back) is kept.
- A workspace with no repository shows the kit's empty state with its one action (AC-6).
- Capabilities equal today's in every state, owner and member alike (AC-4); the css assertion in `render.test.ts` that reads `repositories.css` is updated to the lighter file.
- `pnpm design` shows no new breach and the baseline loses the `src/repositories/` lines (AC-7).
- `repositories.md` describes the page as it is now (AC-8).

### s3 (deep: the one-time key reveal and a destructive action with two confirmations) (`ui: yes`)
- `ApiKeysPage`/`ApiKeysView` render inside `SettingsPage` with *Keys* and *Create a key* sections, no heading or tab row of their own (AC-1).
- Each section heading is reachable at its stable anchor, asserted in `public-api/page/render.test.ts` (AC-2).
- Revoke, and Remove of a key's GitHub App, ask through the kit's danger zone and do nothing until confirmed; Revoke for good and Remove for good keep their two steps (AC-3).
- A workspace with no key shows the kit's empty state with its one action (AC-6).
- A newly created key is revealed once, never logged in clear, and not shown again after leaving; the one-time reveal stays page-specific (AC-5, L-GDPR-2).
- Owner, member and signed-out visitor see and do what they do today (AC-4); the owners-only note is kept.
- `pnpm design` shows no new breach and the baseline loses the `src/public-api/page/` lines (AC-7).
- `api-keys.md` describes the page as it is now (AC-8).
