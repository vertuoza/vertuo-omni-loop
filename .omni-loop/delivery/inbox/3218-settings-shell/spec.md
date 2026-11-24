---
prd: 3218
title: The settings shell: one frame, grouped navigation
blocked-by: [3216, 3217]
spec: file
phase0: server
---

## Problem

Each settings page draws its own `SectionTabs` row (six screens, six copies of the same line) and its own heading, and `/app/settings` has no layout of its own. Consequences a person feels:

- The six tabs are one flat row; as pages are added the row grows and wraps, and nothing says what a tab holds before clicking it.
- Moving between pages re-renders the whole page, tabs included, and the `loading.tsx` of each page paints its own skeleton, so the frame flickers.
- A narrow screen gets a scrolling row of tabs; the page the person is on can sit off-screen.
- On a page that cannot load (signed out, no workspace, unreadable) the tabs are drawn by hand in every screen's `kind` branch.

## Solution

### 1. One layout for Settings

`app/app/settings/layout.tsx` draws the frame once: the page heading area, the grouped navigation, and the content column. Pages stop drawing `SectionTabs`; they draw their content in a `SettingsPage` (from the kit). Moving between settings pages keeps the frame in place; only the content changes.

### 2. Grouped navigation (Q2)

On a wide screen, a left rail lists the map's sections and their pages, the current page marked `aria-current="page"`, each page with its one-line summary on hover or focus. On a narrow screen the rail becomes a single "Settings: <current page>" control that opens the same list. The rail is a real list of links: keyboard and screen-reader complete, no script needed to navigate.

### 3. The frame survives loading and failure

The layout owns the frame, so a page's `loading.tsx` paints only its content skeleton and a page that cannot load (signed out, no workspace, unreadable, closed) shows its notice **inside** the frame. The hand-drawn `kind` branches stop drawing tabs.

### 4. The old tab row retires

`SectionTabs` stays for Questions (its other user). `SETTINGS_TABS` is deleted once nothing reads it; the map is the only source.

Every URL is unchanged (Q3).

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | ui | `app/app/settings/layout.tsx` | no written convention: follows `apps/galaxy/app/app/layout.tsx` |
| vertuoza/vertuo-omni-loop | ui | `SettingsNav`, `SettingsFrame` | no written convention: follows `apps/galaxy/src/nav/SectionTabs.tsx` |

## Decisions

- **Q2 — recommended default, accepted when this PRD is approved:** A left rail of the map's sections on a wide screen, one "Settings: <page>" control on a narrow screen.
- **Q3 — recommended default, accepted when this PRD is approved:** No: every existing URL is kept.
- **The frame is the layout's**, not each page's, so it persists across navigation and across loading and failure states.
- **Pages keep their loaders**; moving the shared read into the layout is the fast-loads PRD's job, so this PRD changes no read.

## User stories

- As a member, I see where I am in Settings and what else is there, on any page and on a phone.
- As a member, moving between pages does not flash the frame.

## Scope

In: the settings layout, the rail and its narrow form, removing the per-page tab row, pages drawing inside `SettingsPage`, the notices inside the frame, deleting `SETTINGS_TABS`.

Out: restyling a page's content (the two page PRDs); changing what a page reads; search; product-level settings.

## Test seams

- `apps/galaxy/src/settings/SettingsNav.render.test.ts`: sections and pages from the map, in order; the current page has aria-current; the narrow control names the current page; every entry is a link.
- `apps/galaxy/src/anti/anti-shell.test.ts` and `nav/*.test.ts` stay green.
- A test that no page under `app/app/settings` imports `SectionTabs` or `SETTINGS_TABS`.
- Each screen's view tests (`FleetsScreen`, `JevScreen`, …) assert the notice for each non-ready kind has no tab row of its own.
- No network, no database.

## Risks

- **What merging publishes:** a new frame and navigation on every settings page; no address, data or permission changes. Rolled back by reverting the pull request.
- **A route that loses its frame** (a page not under the layout). The coverage test from the map PRD names any settings page outside it.
- **The Legal entries:** none touched.
- **The locked laws:** none touched.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The frame is drawn once
  Given any settings page
  When it renders
  Then the navigation and heading area come from the settings layout and the page draws none of its own
```

### AC-2 · test

```gherkin
Scenario: The rail groups pages as the map does
  Given the settings map
  When the rail renders on a wide screen
  Then it lists Workspace, Agents and Developers with their pages in the map's order
```

### AC-3 · test

```gherkin
Scenario: The current page is marked
  Given a person on /app/settings/jev
  When the rail renders
  Then Jev has aria-current="page" and no other entry does
```

### AC-4 · test

```gherkin
Scenario: A narrow screen gets one control
  Given a viewport below the narrow breakpoint
  When the navigation renders
  Then it shows one control named "Settings: <current page>" that lists the same links
```

### AC-5 · test

```gherkin
Scenario: A failure stays in the frame
  Given a signed-out visitor, a person in no workspace, an unreadable page or a closed deployment
  When a settings page renders
  Then its notice appears inside the frame with the navigation present
```

### AC-6 · test

```gherkin
Scenario: Loading keeps the frame
  Given a settings page that is loading
  When its loading.tsx renders
  Then only the content skeleton is drawn and the frame is not repainted
```

### AC-7 · test

```gherkin
Scenario: No address changes
  Given the settings URLs before this change
  When each is requested
  Then each still answers with its page, and /app/settings lands on Fleets
```

### AC-8 · test

```gherkin
Scenario: The old tab row is gone from Settings
  Given the repository after this change
  When a test searches app/app/settings and src for SETTINGS_TABS
  Then no settings page uses it and the constant is removed
```
