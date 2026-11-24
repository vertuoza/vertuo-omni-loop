# Plan: The settings shell: one frame, grouped navigation

PRD #3218, its spec beside this plan (`spec.md`). One feature branch `feat/settings-shell` into `main`
(`Closes #3218`); every slice is a sub-PR from `feat/settings-shell--<slice>` into the feature branch
(`Part of #3218`).

This plan is written against the code PRDs 3216 (the settings map, `apps/galaxy/src/settings/map.ts`,
`SETTINGS_MAP`) and 3217 (the settings kit, `apps/galaxy/src/settings-kit/`, with `SettingsPage`) leave
behind: both merge before any slice here starts (`blocked-by` in the spec). A slice imports the map and
the kit; none edits them. After 3216, `SETTINGS_TABS` is already derived from the map, so slice s8
deletes a derived constant, not a hand-written list.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | One settings layout draws the frame once: heading area, grouped rail (aria-current, summaries on hover or focus), the narrow "Settings: <page>" control as a real list of links, and a content-only loading skeleton | `apps/galaxy/app/app/settings/layout.tsx` `apps/galaxy/app/app/settings/loading.tsx` `apps/galaxy/src/settings/SettingsNav*` `apps/galaxy/src/settings/SettingsFrame*` `apps/galaxy/src/settings/SettingsLoading*` `apps/galaxy/src/settings/settings-shell.css` | — | 1 | build |
| s2 | Fleets draws inside `SettingsPage`, no tab row; its notices and loading sit inside the frame | `apps/galaxy/src/fleets/` `apps/galaxy/app/app/settings/fleets/` | s1 | 2 | build |
| s3 | Repositories draws inside `SettingsPage`, no tab row; its notices and loading sit inside the frame | `apps/galaxy/src/repositories/` `apps/galaxy/app/app/settings/repositories/` | s1 | 2 | build |
| s4 | Business draws inside `SettingsPage`, no tab row, no heading of its own; its notices and loading sit inside the frame | `apps/galaxy/src/business/` `apps/galaxy/app/app/settings/business/` | s1 | 2 | build |
| s5 | Jev draws inside `SettingsPage`, no tab row; its notices and loading sit inside the frame | `apps/galaxy/src/jev/settings/` `apps/galaxy/app/app/settings/jev/` | s1 | 2 | build |
| s6 | Playbook draws inside `SettingsPage`, no tab row; its notices and loading sit inside the frame | `apps/galaxy/src/omni-settings/` `apps/galaxy/app/app/settings/playbook/` | s1 | 2 | build |
| s7 | API keys draws inside `SettingsPage`, no tab row; its notices and loading sit inside the frame | `apps/galaxy/src/public-api/page/` `apps/galaxy/app/app/settings/api-keys/` | s1 | 2 | build |
| s8 | The old tab row retires from Settings: `SETTINGS_TABS` deleted, a guard test keeps pages off `SectionTabs` and the URLs unchanged | `apps/galaxy/src/nav/section-tabs*` `apps/galaxy/src/nav/SectionTabs.render.test.ts` `apps/galaxy/src/settings/shell-guard.test.ts` | s2, s3, s4, s5, s6, s7 | 3 | build |

Shared ground: none declared. No prefix is owned by two slices, and the territories of the wave-2
slices are six disjoint folders. s1 names its files in `apps/galaxy/src/settings/` one by one, because
3216's `map.ts` and its test own that folder: s1 and s8 add files beside them and edit none. Existing
tests that import what a slice changes sit inside that slice's own territory: `playbook-reach.test.ts`
(s6, it reads `SETTINGS_TABS`, so s6 repoints it to the map), `section-tabs.test.ts` and
`SectionTabs.render.test.ts` (s8). `kit/dist/` and `apps/omni-app/api/` are generated and are never
listed. The `fleets` and `jev` areas of the repository's flow own `apps/galaxy/src/fleets/` and
`apps/galaxy/src/jev/`: s2 and s5 read `omni kb show game` and `jev` knowledge before they start; they
add no slice rule.

## Per slice: done when

### s1
**s1** (`ui: yes`)
- `apps/galaxy/app/app/settings/layout.tsx` exists and draws `SettingsFrame` once around `children`: heading area, rail, content column. AC-1
- `SettingsNav.render.test.ts` renders the rail from `SETTINGS_MAP`: sections and pages in the map's order (Workspace, Agents, Developers), every entry a link, each page's one-line summary reachable on hover or focus (a title or described-by text, no script). AC-2
- On `/app/settings/jev` the Jev entry alone carries `aria-current="page"`. AC-3
- The narrow form renders one control named "Settings: <current page>" that opens the same list of links (a `<details>`, no script to navigate); the wide rail and the narrow control are one list in the markup, switched by CSS. AC-4
- `SettingsLoading` draws a content skeleton only (no title, no tab row); the root `settings/loading.tsx` uses it, so the frame is not repainted. AC-6
- `settings-shell.css` declares no colour literal, only design-system tokens; `design-system.test.ts`, `anti/anti-shell.test.ts` and `nav/*.test.ts` stay green; `pnpm design` is not made worse.
- Until s2 to s7 land, pages still draw their own tabs inside the new frame; the feature PR is never marked ready before they do.

### s2 to s7 (one page each, the same shape)
**s2** (`ui: yes`) **s3** (`ui: yes`) **s4** (`ui: yes`) **s5** (`ui: yes`) **s6** (`ui: yes`) **s7** (`ui: yes`)
- The page's screen component imports neither `SectionTabs` nor `SETTINGS_TABS`, and draws its content in `SettingsPage` from the kit with the page's title and summary from the map. AC-1
- s4 only: the hand-made heading card (`business-title`) is replaced by `SettingsPage`'s title and summary; no other business content changes.
- Each non-ready kind of the screen's view (`closed`, `sign-in`, `no-workspace`, `unreadable`, and `not available` for Jev) renders its notice with no tab row of its own, asserted in the screen's view test (`FleetsScreen`, `RepositoriesScreen`, `BusinessScreen`, `JevScreen` via `jev/settings/render.test.ts`, `PlaybookScreen`, `ApiKeysPage` via `public-api/page/render.test.ts`); the notice sits inside the layout, so the navigation is present. AC-5
- The page's `loading.tsx` paints `SettingsLoading` (content skeleton only). AC-6
- The page's loader, its reads and its URL are unchanged. AC-7
- s6 only: `playbook-reach.test.ts` reads the map instead of `SETTINGS_TABS`, still asserting Playbook is reachable.
- Existing tests of the page stay green.

### s8
**s8** (`ui: yes`)
- `SETTINGS_TABS` is deleted from `section-tabs.ts`; `QUESTIONS_TABS`, `withCounts` and `SectionTabs` stay for Questions; `section-tabs.test.ts` and `SectionTabs.render.test.ts` read the map where they read the settings tabs. AC-8
- `apps/galaxy/src/settings/shell-guard.test.ts` fails when any file under `app/app/settings` or any settings screen imports `SectionTabs` or `SETTINGS_TABS`, and when `SETTINGS_TABS` appears anywhere in `apps/galaxy/src`. AC-8
- The same test lists every settings page of the map and checks each is served under the layout (no page outside `app/app/settings/`), each address is unchanged, and `/app/settings` still lands on Fleets (`SETTINGS_LANDING`). AC-7
