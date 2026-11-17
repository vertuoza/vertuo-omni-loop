---
prd: 3035
title: The Pixel perfect tab shows every changed screen, whatever is configured
blocked-by: none
spec: file
phase0: server
---

## Problem

The before/after page `/omni:brainstorm` writes for a PRD has a Pixel perfect tab, where the screens
the PRD changes are drawn whole, today beside after. It is what the person approving the PRD looks at
to approve the real target page.

With design craft off (`design.enabled` false), step 5 of the skill leaves that tab as the one line
`N/A — design craft is off here`, even when the PRD changes a screen
(`kit/plugin/skills/brainstorm/SKILL.md`, the **Pixel perfect** bullet of **Three tabs**). A downstream
repository with design off approved a PRD that added a unit to a figures page, and its approver saw
no screen at all. The rule came from PRD 2239 and PRD 2850; no knowledge entry asks for it, and
`omni check inbox` never reads the design flag, so drawn screens already pass the grader with design
off.

## Solution

### 1. A changed screen is always drawn

In `/omni:brainstorm` step 5, the **Pixel perfect** section draws every screen the PRD changes, today
beside after, whatever is configured for design: the design flag on or off, `design.paths` set or
empty, a screen library or none. Each screen is drawn whole at its real width and carries the marks
the grader reads (`data-screen`, `data-ref`, `data-when`, `data-viewport`, its markup in a
`<template>`), named by the section's `screens:` line, as today.

**Which screens:** each screen the approved design changes what a person sees on. When
`design.paths` lists globs, a file the design will change that one matches also means a screen
changes; with none, the design alone says so.

### 2. With nothing configured, a best effort from the app's own code

When design craft is off, the agent draws as best it can from what the repository holds:

- **today** is the page as the app shows it now: its markup, its styles and its real words, read
  from the page's code and the stylesheets it uses, at the width the app lays it out for;
- **after** is that same screen with only what the approved design changes.

No design form, no screen library, no word pass and no draft screen is read or written: those stay
design craft's. A screen whose code cannot be read well enough to draw is still drawn from what can
be read, and the page says under it, in one line, what was guessed.

With design craft on, step 5 is unchanged: the library screen's mockup, the design form, the word
pass and the drafts, as today.

### 3. The N/A line is retired

`N/A — design craft is off here` is removed from the skill. A PRD that changes no screen says the one
line `Pixel perfect: no screen changes`, whatever the flag, as it already does with design on. Step
0's **The design flag** paragraph says the page still draws changed screens when the flag is off.
**Rework** and `/omni:mega-brainstorm` write the page as step 5 writes it, so they follow with no
change of their own.

### 4. The guide says so

`docs/guide/design.md`, **The before/after: three tabs**, says the Pixel perfect tab draws a changed
screen whether or not design craft is on, and what "best effort" means with it off.

## Conventions

No name chosen.

## Decisions

- **Best effort over refusal.** With nothing configured, the page draws what it can read and says
  what it guessed, rather than leaving the tab empty: the approver asked to see the target page.
- **Design craft's extras stay off.** Drawing screens is not turning design craft on: no library, no
  word pass, no drafts, no `ui: yes` marks in `/omni:plan`, no design review in `/omni:do-work`.
- **The voice's objection** (persona:F-E Developer): "Redrawing a page by hand from its code, with no
  design system to read, is how you get a mockup that looks like the app but isn't." Settled `none`:
  the person approved the design as shown; "today" is copied from the page's own markup and styles,
  "after" changes only what the design names, and a guess is said under the screen.

## User stories

- As the person approving a PRD that changes a screen, I see that screen today beside after on its
  page, in a repository that never turned design craft on.
- As an agent writing the page, I know to draw the screen from the app's own code when no library or
  design form exists, and to say what I guessed.

## Scope

In: the brainstorm skill's step 0 design flag paragraph and step 5's Pixel perfect rules, the test
that pins them, and the design guide's three-tabs section.

Out: turning any other design craft feature on with the flag off (the library, the word pass, the
drafts, `/omni:plan`'s `ui: yes`, `/omni:do-work`'s design review); the grader, which already reads
no flag; pages already written.

## Test seams

Unit tests in vitest over the skill and guide text, as `kit/test/design-skills.test.ts` already reads
them (`section('brainstorm/SKILL.md', '5.')`): what the skill says, never a run of the skill. No test
calls GitHub or a model.

## Risks

- Merging publishes new skill text: the next `/omni:brainstorm` in a repository with design off draws
  screens instead of writing N/A. Pages already written keep their N/A line. Rolled back by reverting
  the feature PR; the release workflow cuts the next version.
- The brainstorm skill sits under a context ceiling (`omni check context`): the slice trims what it
  adds rather than raising the ceiling.
- The Legal entries: none touched.
- N-PRODUCT-15: an agent merging into the main branch would ship unreviewed work to every user;
  nothing here merges. Changing it needs @pierrederval or @dervalp to approve the pull request on
  GitHub.
- The business laws:
  - BL-APPROVALS-1 (an approval covers exactly the files the approver read): kept; the page an
    approver reads now shows the screens they approve, and nothing changes how an approval is voided.
  - BL-ASK-1 (a person's answer is never changed afterwards): kept, not touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: a changed screen is drawn whatever the design flag says
  Given the brainstorm skill's step 5
  When it says what the Pixel perfect section holds
  Then a PRD that changes a screen draws it today beside after, design flag on or off
```

### AC-2 · test

```gherkin
Scenario: the N/A line is gone
  Given the brainstorm skill
  When it is read whole
  Then it never writes "N/A — design craft is off here"
  And a PRD that changes no screen says "Pixel perfect: no screen changes"
```

### AC-3 · test

```gherkin
Scenario: with design craft off, a best effort and no design extras
  Given the brainstorm skill's step 5 with the design flag off
  When it says how a changed screen is drawn
  Then today is read from the page's own code and styles and after changes only what the design changes
  And no design form, screen library, word pass or draft screen is used
  And a guess is said under the screen
```

### AC-4 · test

```gherkin
Scenario: the guide says the tab draws changed screens with design off
  Given the design guide's section on the before/after's three tabs
  When it describes the Pixel perfect tab
  Then it says a changed screen is drawn whether or not design craft is on
```
