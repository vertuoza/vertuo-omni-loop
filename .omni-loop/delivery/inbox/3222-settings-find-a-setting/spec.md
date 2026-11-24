---
prd: 3222
title: Find a setting from anywhere in Settings
blocked-by: [3220, 3221]
spec: file
phase0: server
---

## Problem

Even with sensible sections, a person who does not know which section holds "webhook", "retire a fleet" or "secrets key" has to open pages and scroll. Once the pages are split into named, anchored sections (the two page PRDs), the map knows where every setting is, but offers no way to ask. Deep in a page, the top bar's trail says where the person is but offers no way back to the section list other than the rail.

## Solution

### 1. A search in the shell

The settings frame gets a search field (keyboard shortcut `/`, and a button on a narrow screen). Typing filters the map's **pages and their sections** by label, summary and keywords; choosing a result goes to the page's anchor and focuses the section's heading. It reads only the settings map, in the browser: no query leaves the page.

### 2. Results say where they are

Each result shows the section and page it lives in (*Workspace › Fleets › Retired fleets*), so a person learns the map by using it.

### 3. Keywords come from the map

Each page and section carries the keywords a person might type (including old names), kept in the map beside its label. A test fails on a section without a summary.

### 4. A trail inside a page

The shell shows the trail `Settings › <section> › <page>` above the title, each part a link, and a "Jump to" list of the page's own sections when it has more than three.

Product-level settings stay out of the index (Q4).

## Conventions

No name chosen.

## Decisions

- **Q4 — recommended default, accepted when this PRD is approved:** No: they stay where they are; a later roadmap can bring them in.
- **The index is the map**, one source: no second list to keep in step.
- **Client-side only**: no request is made while typing, so nothing about what a person looks for is sent anywhere.

## User stories

- As a member, I type what I want to change and land on its section.
- As a member deep in a page, I jump to another section of the same page without scrolling.

## Scope

In: the shell's search, its results, the keywords and summaries in the map, the trail and the in-page "Jump to".

Out: searching outside Settings; searching a page's data (claims, fleets); product-level settings.

## Test seams

- `apps/galaxy/src/settings/search.test.ts`: filtering by label, summary and keyword; ranking (label match first); an empty query lists nothing; no match says so.
- `SettingsSearch.render.test.ts`: the field, the `/` shortcut, results with their trail, choosing a result links to the anchor.
- A test that every page and section of the map has a summary and at least one keyword.
- A test that no network call is made while typing.

## Risks

- **What merging publishes:** a search field and a trail in Settings; no data is read or sent. Rolled back by reverting the pull request.
- **A shortcut that steals typing.** `/` only focuses the search when no field or editor has focus; a test holds this.
- **The Legal entries:** none touched: nothing typed leaves the browser.
- **The locked laws:** none touched.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: A search finds a section by a keyword
  Given the settings map with keywords
  When a person types "webhook" or a keyword of a section
  Then the results list that section with its trail
```

### AC-2 · test

```gherkin
Scenario: Results say where they are
  Given a search result
  When it renders
  Then it shows the section and page it lives in
```

### AC-3 · test

```gherkin
Scenario: Choosing a result goes to its anchor
  Given a search result for a section
  When the person chooses it
  Then the page opens at the section's anchor and its heading has focus
```

### AC-4 · test

```gherkin
Scenario: The shortcut never steals typing
  Given a person typing in a field or an editor
  When they press the slash key
  Then the character is typed and the search does not take focus
```

### AC-5 · test

```gherkin
Scenario: Nothing leaves the browser
  Given a person typing in the search
  When each keystroke is handled
  Then no network call is made
```

### AC-6 · test

```gherkin
Scenario: Every section can be found
  Given the settings map
  When the index test runs
  Then every page and section has a summary and at least one keyword
```

### AC-7 · test

```gherkin
Scenario: A page lists its own sections
  Given a page with more than three sections
  When it renders
  Then a Jump to list links each of its sections
```
