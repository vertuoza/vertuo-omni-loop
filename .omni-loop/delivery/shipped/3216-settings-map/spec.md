---
prd: 3216
title: One map of the settings, in sections that make sense
blocked-by: none
spec: file
phase0: server
---

## Problem

The settings sections feel random, and the code explains why: there is no map, only lists that grew one PRD at a time.

- The menu (`SETTINGS` in `apps/galaxy/src/nav/sidebar.ts`) lists Fleets, Repositories, Business, Jev, Playbook. The tab row (`SETTINGS_TABS` in `section-tabs.ts`) lists Fleets, Repositories, Business, **API keys**, Jev, Playbook. API keys is in one and not the other.
- The order is the order the pages were built (PRDs 400, 748, 2022, 812, 2417), not an order a person would guess: Business sits beside Fleets, Jev between API keys and Playbook.
- The top bar's trail (`pageTrail`) is derived from the menu's list, so a page missing there gets no trail.
- Some settings live elsewhere entirely: a product's settings under `/app/products/<id>/knowledge/settings`, and its repositories tab.

A person cannot predict where a setting lives, because the product itself does not know.

## Solution

### 1. One typed map

`apps/galaxy/src/settings/map.ts` is the only place that says what Settings holds: a list of **sections** (a label, a one-line summary), each with its **pages** (id, label, path, a one-line summary, keywords a person might type). The default grouping (Q1): **Workspace** (Fleets, Repositories, Business), **Agents** (Jev, Playbook), **Developers** (API keys). Within a section the order goes from what most people touch to what few do.

### 2. Every reader derives from it

The menu's `SETTINGS.pages`, `SETTINGS_TABS`, `SETTINGS_LANDING` and the top bar's trail are computed from the map. The tab row and the menu can no longer differ.

### 3. The map is checked against the routes

A test lists the directories under `app/app/settings/` that hold a page and fails if one is missing from the map, or if the map names a path with no page. Every label is written once.

### 4. Nothing moves for anyone with a link

Every existing URL stays as it is (Q3); this PRD changes labels' order and grouping, never an address. The settings root still lands on Fleets.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | ui | `SETTINGS_MAP`, `SettingsSection`, `SettingsPageEntry` | no written convention: follows `apps/galaxy/src/nav/section-tabs.ts` (`SETTINGS_TABS`, `SectionTab`) |
| vertuoza/vertuo-omni-loop | ui | `apps/galaxy/src/settings/map.ts` | no written convention: follows the folder-per-feature layout of `apps/galaxy/src/nav/` |

## Decisions

- **Q1 — recommended default, accepted when this PRD is approved:** Three sections: Workspace (Fleets, Repositories, Business), Agents (Jev, Playbook), Developers (API keys).
- **Q3 — recommended default, accepted when this PRD is approved:** No: every existing URL is kept.
- **Q4 — recommended default, accepted when this PRD is approved:** No: they stay where they are; a later roadmap can bring them in.
- **The map is data, not JSX**, so the menu, the shell and the search read the same thing.

## User stories

- As a member, I find a setting in the section its name suggests, and the menu and the page's own navigation say the same thing.
- As a developer, I add a settings page in one place and the menu, the trail and the search know it.

## Scope

In: `map.ts` and its types, the menu, the tab row, the landing and the trail reading it, the route-coverage test.

Out: the shell's layout (the shell PRD), any page's content, any address change, product-level settings.

## Test seams

- `apps/galaxy/src/settings/map.test.ts`: every settings route has an entry and no entry lacks a route (read from the file system); paths and labels unique; each section non-empty.
- `apps/galaxy/src/nav/sidebar.test.ts` and `section-tabs.test.ts`: the menu's settings pages and the tabs equal the map's, in its order; `pageTrail('/app/settings/api-keys')` ends on API keys.
- No network, no database.

## Risks

- **What merging publishes:** a changed order and grouping of the settings links; no address changes. Rolled back by reverting; nothing is stored.
- **The Legal entries:** none touched.
- **The locked laws:** none touched.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The menu and the tabs agree
  Given the settings map
  When the menu and the tab row are built
  Then they list the same pages in the same order, API keys included
```

### AC-2 · test

```gherkin
Scenario: A page missing from the map fails
  Given a directory under app/app/settings that holds a page and is not in the map
  When the coverage test runs
  Then it fails and names the directory
```

### AC-3 · test

```gherkin
Scenario: An entry with no page fails
  Given a map entry whose path has no page
  When the coverage test runs
  Then it fails and names the entry
```

### AC-4 · test

```gherkin
Scenario: No address changes
  Given the paths of every settings page before this change
  When they are compared to the map's paths
  Then each is unchanged and /app/settings still lands on Fleets
```

### AC-5 · test

```gherkin
Scenario: The trail reads the map
  Given a person on /app/settings/api-keys
  When the top bar's trail is built
  Then it reads Settings › Developers › API keys
```

### AC-6 · test

```gherkin
Scenario: Sections are grouped and ordered by the map
  Given the default map
  When its sections are read
  Then they are Workspace, Agents and Developers, each holding the pages Q1 names
```
