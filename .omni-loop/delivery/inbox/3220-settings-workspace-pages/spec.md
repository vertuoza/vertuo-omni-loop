---
prd: 3220
title: Fleets, Repositories and API keys on the settings kit
blocked-by: [3218]
spec: file
phase0: server
---

## Problem

Fleets, Repositories and API keys are three of the settings' busiest pages and each has its own stylesheet, heading, buttons and messages (`fleets.css`, the repositories screen's own, `api-keys.css`). Their destructive actions (retire a fleet, remove a repository, revoke a key) look and confirm differently; their empty states read differently; the design ratchet counts their breaches. Their screens are draft in the design library, so none is locked.

## Solution

### 1. Each page is built from the kit

`FleetsScreen`/`FleetsView`, `RepositoriesScreen` and `ApiKeysPage`/`ApiKeysView` draw inside `SettingsPage` with `SettingsSection`s, `SettingsRow`s, the shared field states, the shared danger zone and the shared empty state. Their own colours and spacing are removed from their stylesheets; what stays is only what is truly specific (the fleet card's mascot, the key's one-time reveal).

### 2. Sections with anchors

Each page names its sections (Fleets: *Your fleets*, *Retired fleets*; Repositories: *Connected*, *Add a repository*; API keys: *Keys*, *Create a key*) with stable anchors the navigation and search can link to.

### 3. One way to destroy

Retire, remove and revoke use the kit's danger zone: the same confirmation, the same wording pattern, the same undo where one exists today. No capability changes: who may act and what the action does stay as they are.

### 4. The library screens follow

The draft screens `fleet-settings`, `api-keys` and the repositories screen are updated in `.omni-loop/knowledge/design/screens/` to say what the page is now, as the design form asks.

Every URL is unchanged (Q3).

## Conventions

No name chosen.

## Decisions

- **Q3 — recommended default, accepted when this PRD is approved:** No: every existing URL is kept.
- **No capability changes**: this PRD moves how pages are drawn, not what they do.
- **Page-specific styling stays page-specific**, only where the kit has no block for it.

## User stories

- As a member, Fleets, Repositories and API keys look and confirm things the same way, so I trust what a button does.
- As an owner, retiring or revoking something always asks the same way.

## Scope

In: the three pages' rebuild on the kit, their section anchors, the shared danger zone and empty states, their stylesheets lightened, their draft library screens updated.

Out: new features on these pages; permissions; the other three pages (the next PRD); the design baseline is only lowered, never raised.

## Test seams

- Each page's existing view and screen tests keep passing (same states: demo, signed-out, no workspace, unreadable, ready), with assertions moved to the kit's markup where they named old classes.
- `*.render.test.ts` per page: its sections have their anchors; its destructive action renders through the danger zone; its empty state is the kit's.
- `pnpm design`: no new breach; the baseline shrinks for the lines removed.
- No network, no database.

## Risks

- **What merging publishes:** a new look for three pages; their actions and data are unchanged. Rolled back by reverting the pull request.
- **A destructive action that confirms less than before.** The tests keep each confirmation step of retire, remove and revoke.
- **The Legal entries:** L-GDPR-2: an API key is still shown once, never logged in clear; the one-time reveal is kept as is.
- **The locked laws:** none touched; the three design screens are draft.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The three pages use the kit
  Given the Fleets, Repositories and API keys pages
  When each renders
  Then each is drawn in SettingsPage with its named SettingsSections and no heading or tab row of its own
```

### AC-2 · test

```gherkin
Scenario: Sections have anchors
  Given each of the three pages
  When its sections render
  Then each section heading is reachable at its stable anchor
```

### AC-3 · test

```gherkin
Scenario: Destructive actions share one confirmation
  Given retire a fleet, remove a repository and revoke a key
  When each action is started
  Then each asks through the kit's danger zone and does nothing until confirmed
```

### AC-4 · test

```gherkin
Scenario: Capabilities are unchanged
  Given a member, an owner and a signed-out visitor
  When each opens each page
  Then what each can see and do equals today's
```

### AC-5 · test

```gherkin
Scenario: A key is still shown once
  Given a newly created API key
  When the page shows it
  Then it is revealed once, never logged in clear, and not shown again after leaving
```

### AC-6 · test

```gherkin
Scenario: The empty states are the kit's
  Given a workspace with no fleet, no repository and no key
  When the three pages render
  Then each shows the kit's empty state with its one action
```

### AC-7 · test

```gherkin
Scenario: The design baseline only shrinks
  Given the design ratchet
  When pnpm design runs
  Then no new breach and a baseline no larger than before
```

### AC-8 · test

```gherkin
Scenario: The library screens say what the pages are
  Given the three draft screen files
  When they are read
  Then each describes the page as it is after this change
```
