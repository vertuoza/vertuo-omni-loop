---
prd: 3217
title: A settings kit in the design system
blocked-by: none
spec: file
phase0: server
---

## Problem

The mission requires that settings use the design system and that the system be improved where it falls short. It falls short in one place: it holds colours, fonts, sprites and tokens (`@omni/design`), but **no components**. Each settings page draws its own header, section, row, field and notice in its own stylesheet (`fleets.css`, `business.css`, `connect.css`, `omni-settings.css`, `api-keys.css`), so the same thing is built six ways and drifts. The design ratchet (`pnpm design`) already counts the breaches.

Today the six pages disagree on the heading's size, the width of the column, the spacing between sections, how a destructive button looks, and what a saved, a saving or a failed state says.

## Solution

### 1. The kit

`@omni/design` gains `settings`, plain React-free building blocks (CSS custom properties, class contracts and a markup contract, in the package's own style: no React in the package), and the galaxy app a thin React layer `apps/galaxy/src/settings-kit/` over them:

- **SettingsPage**: title, one-line summary, an optional actions slot; one column width for every page.
- **SettingsSection**: a titled block with its own anchor (`id`), a description, and its content; sections are what the shell and the search jump to.
- **SettingsRow**: a label, a help line, a control, and a right-aligned status; stacks on a narrow screen.
- **Field states**: idle, dirty, saving, saved, error, each with one wording and one visual, shared by every form of Settings.
- **Danger zone** and **Notice**: the destructive action's one look and the page-level message's one look.
- **Empty state**: one layout for "nothing here yet" with its one action.

### 2. Tokens only

The kit draws only with the design system's tokens (space, radius, type, role colours), in both themes and the anti mode. It declares no colour of its own, so `design-system.test.ts` stays green.

### 3. A page of examples

`/design` (the design system's page) shows each block in each state, so a designer reviews the kit once, in place.

### 4. No page moves yet

The kit is added, tested and shown. Pages adopt it in the PRDs that follow (the shell, then each page).

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | design | `settings` module of `@omni/design` | no written convention: follows `packages/design/src/tokens.ts` (one module, re-exported by `index.ts`) |
| vertuoza/vertuo-omni-loop | ui | `apps/galaxy/src/settings-kit/` | no written convention: follows the folder-per-feature layout of `apps/galaxy/src/skeleton/` |

## Decisions

- **The package stays React-free**; the React layer lives in the app, as `packages/design/README.md` requires.
- **Sections carry anchors from the start**, because the search and the shell's in-page navigation (later PRDs) need them.
- **One saved/error wording**, so a person learns it once.

## User stories

- As a member, every settings page looks and behaves the same, so I never relearn a screen.
- As a developer, I build a settings page from named blocks instead of a new stylesheet.

## Scope

In: the kit's blocks and their states, the examples on `/design`, tests for each block's markup contract and its tokens-only rule.

Out: moving any page onto the kit; the shell; new colours or fonts; a general component library for the rest of the app.

## Test seams

- `packages/design/src/settings.test.ts`: each block's class contract, and that no rule declares a colour literal (only role tokens).
- `apps/galaxy/src/settings-kit/*.render.test.ts`, following `SectionTabs.render.test.ts`: each block renders its markup; a section has its anchor id; a row stacks on a narrow viewport class; each field state renders its own wording.
- `apps/galaxy/src/design-system.test.ts` stays green; `pnpm design` is not made worse.

## Risks

- **What merging publishes:** a new module in the design package and new components nothing uses yet, plus a section on `/design`. Rolled back by reverting; nothing depends on them.
- **The Legal entries:** none touched.
- **The locked laws:** none touched. The design screens are all draft: no locked screen is changed.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The kit offers the six blocks
  Given the settings kit
  When its exports are read
  Then it exposes SettingsPage, SettingsSection, SettingsRow, the field states, the danger zone, the notice and the empty state
```

### AC-2 · test

```gherkin
Scenario: A section has an anchor
  Given a SettingsSection given the id "keys"
  When it renders
  Then its heading is reachable at #keys and carries that id
```

### AC-3 · test

```gherkin
Scenario: Every field state has one wording
  Given the five field states
  When each renders
  Then idle, dirty, saving, saved and error each show their one shared wording
```

### AC-4 · test

```gherkin
Scenario: Tokens only
  Given the kit's stylesheet
  When the design-system test reads it
  Then it declares no colour literal and no :root colour, only role tokens
```

### AC-5 · test

```gherkin
Scenario: Both themes and the anti mode pass contrast
  Given the kit's text and edge pairs
  When the token contrast test runs for each theme and the anti mode
  Then every pair meets its required ratio
```

### AC-6 · test

```gherkin
Scenario: The examples page shows every block
  Given /design
  When it renders
  Then each block appears in each of its states
```
