# Plan: One map of the settings, in sections that make sense

PRD #3216, spec beside this plan (`spec.md`). The feature branch `feat/settings-map` goes into `main`
as one draft PR (`Closes #3216`); each slice is a sub-PR from `feat/settings-map--<slice>` into the
feature branch (`Part of #3216`, base the feature branch).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | One typed `SETTINGS_MAP` (Workspace, Agents, Developers; every page with id, label, path, summary, keywords) and the test that checks it against the `app/app/settings/` pages | `apps/galaxy/src/settings/` | — | 1 | build |
| s2 | The menu's Settings pages, `SETTINGS_TABS`, `SETTINGS_LANDING` and the top bar's trail are derived from the map, so the menu, the tabs and the trail agree, API keys included | `apps/galaxy/src/nav/sidebar.ts` `apps/galaxy/src/nav/section-tabs.ts` `apps/galaxy/src/nav/sidebar.test.ts` `apps/galaxy/src/nav/section-tabs.test.ts` `apps/galaxy/src/nav/SectionTabs.render.test.ts` `apps/galaxy/src/nav/Sidebar.render.test.ts` `apps/galaxy/src/nav/AppBar.test.ts` | s1 | 2 | build |

Shared ground: none between slices. s1 creates `apps/galaxy/src/settings/` only (new files), s2 edits
the `nav/` files named above, so no two territories meet and s2 waits for s1 only because it imports
the map. The nav tests that read the Settings labels and tabs (`SectionTabs.render.test.ts`,
`Sidebar.render.test.ts`, `AppBar.test.ts`, which expects `Settings › Fleets`) are s2's alone and
are declared there. `apps/galaxy/app/app/settings/` is read by s1's test and changed by no slice
(no address changes). No generated path is listed. The map imports nothing from `nav/`, so the
dependency runs one way (nav reads settings).

## Per slice: done when

**s1** (`ui: yes`)
- `apps/galaxy/src/settings/map.ts` exports `SETTINGS_MAP`, `SettingsSection` and `SettingsPageEntry`
  as data (no JSX): sections Workspace (Fleets, Repositories, Business), Agents (Jev, Playbook),
  Developers (API keys), each with a label and one-line summary, each page with id, label, path,
  summary and keywords; within a section ordered from most to least touched (AC-6).
- Every path is the existing address (`/app/settings/fleets`, `/repositories`, `/business`, `/jev`,
  `/playbook`, `/api-keys`) and the settings landing is still Fleets (AC-4).
- `map.test.ts` reads the directories under `apps/galaxy/app/app/settings/` that hold a `page.tsx`
  (`products/` holds only `route.ts` and `[id]/`, so it is not a settings page) and fails naming the
  directory when one is missing from the map (AC-2), and naming the entry when a map path has no page
  (AC-3). Paths and labels are unique, each section is non-empty. No network, no database.
- Proof of the guards: each failing case is shown red once (a temporary extra directory, a temporary
  entry), then removed.

**s2** (`ui: yes`)
- `SETTINGS.pages`, `SETTINGS_TABS` and `SETTINGS_LANDING` are computed from `SETTINGS_MAP`; the menu
  and the tab row list the same pages in the same order, API keys included (AC-1).
- `pageTrail('/app/settings/api-keys')` reads Settings › Developers › API keys: the section is the
  trail's group crumb, from the map (AC-5); the other settings pages read their own section the same
  way, and `AppBar.test.ts`'s expectations are updated to the new trail.
- Every existing URL is unchanged and `/app/settings` still lands on Fleets (AC-4); the tab row still
  omits Products (`SectionTabs.render.test.ts`).
- `sidebar.test.ts` and `section-tabs.test.ts` assert the menu's pages and the tabs equal the map's,
  in its order. No page content, shell layout or product-level settings changes.
