---
prd: 2490
title: "Anti-loop placeholder: a switch to an anti-loop mode with Anti-dashboard and Anti-work"
blocked-by: none
spec: file
phase0: server
---

## Problem

The anti-loop (concept #1964) is the loop turned backwards: the tech team's harness, architecture
and retro work, the work that keeps the forward loop honest. The app has no place for it yet. Every
page of the app shell belongs to the forward loop (Dashboard and Work), so there is no room the tech
team can call its own, and no way to show that the anti-loop exists. The person asked for a first,
small placeholder, not a roadmap: a door into the anti-loop that a later PRD fills.

## Solution

An **anti-loop mode** of the app shell, at its own routes, in the concept's colours.

- **The switch.** The top bar gets an **Anti-loop** button beside Game mode. In the forward loop it
  reads `Anti-loop` and opens `/anti`. In anti-loop mode it reads `Omni loop` and opens `/app`. It is
  a plain link, never a dialog: nothing is lost by switching, so nothing is asked.
- **The routes are the mode.** `/anti` is **Anti-dashboard** and `/anti/work` is **Anti-work**.
  Both use the same app shell as `/app`, read the viewer the same way, and are not indexed. Nothing
  is stored: a link to `/anti` opens anti-loop mode for anyone, and every other page is the forward
  loop, as today.
- **The menu.** In anti-loop mode the sidebar's Dashboard and Work groups are replaced by one group,
  **Anti-loop**, holding Anti-dashboard and Anti-work. The foot (Settings, Docs, Release notes) stays
  as it is. The top bar's trail reads `Anti-loop › Anti-dashboard` and `Anti-loop › Anti-work`.
- **The colours: Rewind Light** (concept #1964, round 4). Under each reading theme the anti-loop mode
  remaps these tokens and keeps every other one (ground, surface, sunk, ink, muted, cyan, green, red):

  | token | Omni | Light | Dark |
  |---|---|---|---|
  | line | `#3a1458` | `#ecd3e4` | `#4a1c66` |
  | lineStrong | `#b0489a` | `#a0558f` | `#c05aa8` |
  | plasma (the signal) | `#ff3ea5` | `#b0127a` | `#ff5fb4` |
  | plasmaSoft | `#3a1238` | `#fbe3f2` | `#3a1650` |
  | onPlasma | `#07061c` | `#ffffff` | `#0e0d33` |
  | yellow (the Recommended badge) | `#ffd84a` | `#ffd84a` | `#ffd84a` |
  | onYellow | `#07061c` | `#3a2c00` | `#3a2c00` |

  Magenta takes the signal, the Recommended badge takes yellow, errors stay red. The values live in
  `@omni/design` beside `ASK`, and every text and edge pair the reading surface tests for the three
  themes is tested for their anti-loop variants too, at the same WCAG AA thresholds. A value that
  fails is darkened or lightened until it passes, and the change is named in **Decisions** by the
  slice that makes it.
- **The logo.** In anti-loop mode the sidebar's lockup reads `ANTI LOOP` then the crest mirrored, its
  ring in the anti-loop signal colour. The mirror is drawn by `@omni/design` as pixels, at
  whole-number scales, never by a CSS transform. It still links home, to `/anti`. The concept's
  360 ms wipe is not part of this PRD.
- **The pages.** Each page holds its title and two short lines, and nothing else:
  - Anti-dashboard: `Harness, architecture and retros, at a glance.` then `Not open yet.`
  - Anti-work: `The tech team's harness, architecture and retros.` then `Not open yet.`
  Each line stays under eight words, as the design form's word pass asks of a screen.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | ui | route `/anti`, `/anti/work` | no written convention: follows `apps/galaxy/app/app/runners/page.tsx` (a route folder per page under `app/`) |
| vertuo-omni-loop | ui | sidebar ids `anti-dashboard`, `anti-work`; group id `anti` | `SidebarId` ← `apps/galaxy/src/nav/sidebar.ts:24`, `SidebarGroup` ← `apps/galaxy/src/nav/sidebar.ts:47` |
| vertuo-omni-loop | ui | `ANTI_SIDEBAR` | `SIDEBAR` ← `apps/galaxy/src/nav/sidebar.ts:60` |
| vertuo-omni-loop | ui | `AntiLoopButton` | no written convention: follows `GameModeButton` ← `apps/galaxy/src/switch/GameModeButton.tsx:21` |
| vertuo-omni-loop | design | `ASK_ANTI` | `ASK` ← `packages/design/src/tokens.ts:69` |
| vertuo-omni-loop | ui | attribute `data-ask-mode="anti"` | no written convention: follows `data-ask-theme` ← `apps/galaxy/src/ask/theme-tokens.ts:33` |
| vertuo-omni-loop | ui | `AppShell`'s `mode` prop, `'omni' \| 'anti'` | no written convention: follows `AppShellProps` ← `apps/galaxy/src/nav/AppShell.tsx:21` |

## Decisions

- **A placeholder on purpose.** Both pages are empty but for two short lines; no data, no table, no API.
  The person asked for a first, small place, not a roadmap.
- **The URL is the mode.** Anti-loop mode is its own routes, never a stored toggle: links share it,
  nothing is kept in a cookie or in local storage, and every page outside `/anti` stays as it is.
- **The switch sits in the top bar,** beside Game mode, as the person chose.
- **The look is concept #1964's Rewind Light with the mirrored ANTI LOOP lockup,** chosen by the
  person after seeing it beside today's Omni and an inverted palette. The inverted palette was
  rejected: it leaves the concept behind.
- **The 360 ms wipe is left out,** to keep the placeholder small; the lockup simply reads ANTI LOOP
  on the anti-loop pages.
- **The foot stays** (Settings, Docs, Release notes) in both modes.
- **This PRD fills no area of concept #1964.** Its areas (retro-echo, lesson-check, lessons-hub,
  rewind-tab, breach-night) stay open; lessons-hub will reuse the mode this PRD builds.
- **The voice's objection.** *B-E DEv* (`persona:B-E DEv`): "A mode with two empty pages and a
  mirrored logo is exactly the fluff I expect from this tool." Settled `none`: the person approved
  the design as it was, a placeholder on purpose.

## User stories

- As a member of the tech team, I press **Anti-loop** in the top bar and land on Anti-dashboard, in
  the anti-loop's colours, so I know the anti-loop has its own place.
- As a member in anti-loop mode, I see Anti-dashboard and Anti-work in the menu, and each says what
  it will hold.
- As a member in anti-loop mode, I press **Omni loop** and am back on my dashboard, in the forward
  loop's colours.
- As a member, I send a teammate a link to `/anti/work`, and it opens in anti-loop mode for them.

## Scope

In:

- the routes `/anti` and `/anti/work`, in the app shell;
- the top bar's Anti-loop / Omni loop switch;
- the anti-loop menu group and its trail;
- the Rewind Light tokens for the three themes, with their contrast tests;
- the mirrored ANTI LOOP lockup;
- the two placeholder pages;
- the screen library: the `app-shell` draft brought up to date, and drafts `anti-dashboard` and
  `anti-work`.

Out:

- anything on the pages beyond their title and two lines: no data, no counts, no links to retros;
- the 360 ms wipe;
- the arcade, HOME and the PRD page: anti-loop mode is the app shell only;
- concept #1964's areas (lessons, rewind tab, Breach Night);
- a stored preference, or anti-loop mode on any route but `/anti`.

## Test seams

Per `omni kb show testing`: vitest, beside the code, no network and no GitHub.

- `apps/galaxy/src/nav/sidebar.test.ts`: `ANTI_SIDEBAR` holds the one Anti-loop group with
  Anti-dashboard (`/anti`) and Anti-work (`/anti/work`), each with a 16 px sprite; `currentItem`
  and `pageTrail` read `/anti` and `/anti/work` as those items and `Anti-loop › …`; `/app` and every
  forward page still read as today.
- The top bar's test: the switch reads `Anti-loop` with `href="/anti"` on a forward page, and
  `Omni loop` with `href="/app"` on an anti-loop page.
- `packages/design`'s token tests: every pair of `ASK_TEXT_PAIRS` reaches 4.5:1 and every pair of
  `ASK_UI_PAIRS` reaches 3:1 under each theme's anti-loop tokens.
- `apps/galaxy/src/ask/theme-tokens.test.ts`: `themeCss()` emits the anti-loop declarations only for
  a root marked `data-ask-mode="anti"`, for each theme, and an unmarked root is unchanged.
- `@omni/design`'s logo tests: the mirrored lockup is the mark's pixels reversed column for column,
  its ring in the anti-loop colour, at whole-number scales only.
- A render test of each page: its title and its two lines, and the shell marked `data-ask-mode="anti"`.
- The existing guards stay green: `design-system.test.ts` (no colour on `:root` outside
  `@omni/design`) and `page-width.test.ts`.

## Risks

- **What merging publishes.** The arcade's Vercel project (`apps/galaxy`) deploys to production
  through the release commit, with `@omni/design`'s new tokens and logo option. No migration, no kit
  change, no GitHub App change. Rolled back by reverting the feature PR; nothing is stored, so
  nothing is left behind.
- **A new route anyone can open.** `/anti` and `/anti/work` show no workspace data, only the shell
  every app page already shows (the viewer and the bell), so they reveal nothing `/app` does not.
- **Contrast.** A concept value could fall short of AA on a pair the concept never drew; the
  contrast tests catch it before merge, and the fix is named in Decisions.
- **The locked laws it touches.** `omni kb laws` names the ask domain's laws because
  `apps/galaxy/src/ask/theme-tokens.ts` lives in that domain. The change only adds colours to it;
  no question, answer, session or hook changes.
  - BR-PRODUCT-12: an answer that changes after it is given lets the terminal act on words the
    person no longer stands behind. Changing it needs @pierrederval or @dervalp to approve the pull
    request on GitHub.
  - BR-PRODUCT-29: an ask mode that lets in a non-member lets a stranger read a team's questions and
    answers. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-39: reading or deleting a session of no workspace leaks a question or loses it for its
    owner. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-94: a terminal token that marks an answer as given lets an agent answer in a person's
    name. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - N-PRODUCT-7: a broken hook that blocks a message locks a person out of their own terminal.
    Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - N-PRODUCT-8: an ask hook that calls another address sends a person's questions and answers to a
    server they never chose. Changing it needs @pierrederval or @dervalp to approve the pull request
    on GitHub.
- **The Legal entries:** none touched.

## Acceptance criteria

- On any forward page of the app shell, the top bar shows a button reading `Anti-loop` that opens
  `/anti`.
- `/anti` shows Anti-dashboard: the ANTI LOOP lockup with the mirrored crest, a menu whose only group
  is Anti-loop with Anti-dashboard and Anti-work, the trail `Anti-loop › Anti-dashboard`, its title
  and its two lines, in the Rewind Light colours of the chosen theme.
- `/anti/work` shows Anti-work the same way, with its own lines and the trail
  `Anti-loop › Anti-work`.
- On both anti-loop pages the top bar's button reads `Omni loop` and opens `/app`, which shows the
  forward menu and colours as today.
- Settings, Docs and Release notes stay in the menu's foot in both modes.
- Every anti-loop text and edge pair reaches WCAG AA (4.5:1 for text, 3:1 for edges) in Omni, Light
  and Dark.
- No page outside `/anti` changes, and nothing is stored in a cookie or in local storage.
