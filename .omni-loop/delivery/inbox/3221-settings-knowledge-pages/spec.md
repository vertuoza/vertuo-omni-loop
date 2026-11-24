---
prd: 3221
title: Business, Jev and Playbook on the settings kit
blocked-by: [3218]
spec: file
phase0: server
---

## Problem

Business (about 1,300 lines across its screen, view, page, personas and constituents), Jev (a settings form with a secrets key and an owner-only edit) and Playbook (an editor of the repository's rules) are the longest and densest settings pages. Each one is a single long scroll: Business holds the products, the claims, the agent questions and the connect-an-agent card; a person looking for one of them scrolls and guesses. Their forms report saving and errors in three different ways.

## Solution

### 1. Split into named sections

Each page is rebuilt on the kit and divided into **named sections with anchors**: Business (*Products*, *What you sell*, *Agent questions*, *Connect an agent*), Jev (*Provider*, *Keys*, *Behaviour*) and Playbook (*Repository*, *Forms*, *Editor*), as the pages' own content already groups. The shell's navigation and the later search link to each.

### 2. One saving language

Their forms use the kit's field states (dirty, saving, saved, error) and the same Save/Cancel placement. A failed save keeps the person's edits and says what failed.

### 3. Dense content, calmer

Long lists (claims, agent questions) show the first items and a "Show all" control instead of the full list; the full list stays one click away and keeps its order.

### 4. The library screens follow

The draft screens `business-settings` and `settings-playbook`, and Jev's, are updated to say what the pages are now.

No capability or data change; every URL is unchanged (Q3).

## Conventions

No name chosen.

## Decisions

- **Q3 — recommended default, accepted when this PRD is approved:** No: every existing URL is kept.
- **No capability changes.**
- **Section names are taken from what each page already groups**, so no content is invented; the names can be edited in one place per page.
- **Collapsing long lists** never hides a count: the total is always shown.

## User stories

- As a member, I jump to "Connect an agent" or "Agent questions" without scrolling through the rest of Business.
- As an owner, saving Jev or the Playbook says saved or says what failed, the same way everywhere.

## Scope

In: the three pages rebuilt on the kit, their named sections with anchors, the shared field states, "Show all" on long lists, their library screens updated.

Out: new settings; changes to claims, personas or constituents themselves; permissions; Fleets, Repositories and API keys (the sibling PRD).

## Test seams

- Existing view and screen tests of Business, Jev and Playbook keep passing for each state (demo, signed-out, no workspace, unreadable, unavailable, ready), with assertions moved to the kit's markup.
- `*.render.test.ts` per page: sections and anchors; a long list shows its first items, the total, and Show all; a failed save keeps the edit and shows the error state.
- `pnpm design`: no new breach.
- No network, no database, no real secrets key.

## Risks

- **What merging publishes:** a new layout for three pages; same data and actions. Rolled back by reverting the pull request.
- **A secret shown or logged.** Jev's keys stay masked and are never logged; the tests keep that, as L-GDPR-2 requires.
- **A long list hiding something important.** The total is always visible and the full list is one click away.
- **The Legal entries:** L-GDPR-1 and L-GDPR-2: unchanged, no read widens, no credential is shown in clear.
- **The locked laws:** none touched; the screens are draft.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: Each page has named sections with anchors
  Given Business, Jev and Playbook
  When each renders
  Then each is divided into the sections named in the spec, each reachable at its anchor
```

### AC-2 · test

```gherkin
Scenario: The pages use the kit
  Given the three pages
  When each renders
  Then each is drawn in SettingsPage with kit rows and fields and no heading or tab row of its own
```

### AC-3 · test

```gherkin
Scenario: A failed save keeps the edit
  Given a Jev or Playbook form whose save fails
  When the person saves
  Then the field shows the error state, says what failed and keeps the person's edit
```

### AC-4 · test

```gherkin
Scenario: Long lists collapse without hiding the total
  Given a workspace with many claims and agent questions
  When Business renders
  Then the first items show with the total count and a Show all control that reveals the full list in order
```

### AC-5 · test

```gherkin
Scenario: Secrets stay masked
  Given Jev with a saved key
  When the page renders and a save runs
  Then the key is masked on screen and never appears in a log
```

### AC-6 · test

```gherkin
Scenario: Capabilities are unchanged
  Given an owner, a member and a signed-out visitor
  When each opens each page
  Then what each can see and do equals today's
```

### AC-7 · test

```gherkin
Scenario: The library screens say what the pages are
  Given the draft screen files for Business, Jev and Playbook
  When they are read
  Then each describes its page as it is after this change
```
