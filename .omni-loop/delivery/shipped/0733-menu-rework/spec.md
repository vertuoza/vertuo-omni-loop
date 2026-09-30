---
prd: 733
title: A tidier, collapsible main menu
blocked-by: none
spec: file
---

# A tidier, collapsible main menu

**Date:** 2026-09-30 · **PRD:** #733 · **Found by:** visual issue #732 · **Touches:** the app shell's
menu in `apps/galaxy/src/nav/` (the menu model, the sidebar, its styles), the Questions pages' header
(`/ask`, `/ask/for-me`, `/ask/history`), the two settings pages and one new redirect at
`/app/settings`, and one new 16×16 sprite in `packages/design`. No data, no migration, no API.

## Problem

The app's main menu (PRD 438, grown by PRDs 572, 612 and 627) reads as a list of everything, not as
a menu:

- The **Settings** group repeats what is above it: **Fleet** under Dashboard, **Fleets** under
  Settings, and Settings takes a group title of its own for two entries without sprites.
- **Questions** carries two nested lines, **Shared with me** and **History**, the only nested lines
  of the menu; they read as odd in the main menu.
- The menu is always 240 px wide on a computer, and **nothing folds it away**.

The sprites (issue 653) are liked and stay.

## Solution

Design **A** of the brainstorm (the before/after page shows it beside today).

**The menu.** Two groups, then the foot:

- **Dashboard:** Home, Fleet, Workspace, Engineering, as today.
- **Work:** PRDs, Bug Fixes, Visual Updates, Questions, Knowledge, as today, but Questions has no
  nested lines. Its badge already counts the questions shared with the person (`WaitingCounts.questions`),
  so it keeps it; the separate Shared with me badge goes with its line.
- **The foot:** one **Settings** entry with a new gear sprite, `menu-settings`, at `/app/settings`,
  above Docs and Release notes and the version line. The Settings group and its title are gone.

The top bar's trail (issue 704) follows: a settings page reads "Settings › Fleets" or
"Settings › Repositories"; a Questions page reads "Work › Questions › Shared with me" or
"Work › Questions › History", as today. The item a page falls under still carries
`aria-current="page"`: every settings page falls under Settings, every `/ask` page under Questions.

**Collapsing, on a computer (900 px and wider).**

- A **«** button in the menu's header, labelled "Collapse the menu", folds the menu to a **rail**,
  56 px wide: the crest, then each Dashboard and Work sprite (the two groups apart by a thin line),
  then the Settings gear at the foot. A **»** button in the rail, labelled "Expand the menu", opens
  it again. Each button carries `aria-expanded` and `aria-controls="app-sidebar"`.
- In the rail each entry is still a link to its page: its name is its `title` and its accessible
  name; the entry the page falls under is marked as today. An entry with a waiting count shows a
  yellow dot instead of the number, and its accessible name says "<name>: <n> waiting". Docs,
  Release notes, the workspace name and the version line are not shown in the rail.
- The choice is kept per browser in a cookie, `omni-menu=rail` (a year, path `/`, `SameSite=Lax`);
  opening again deletes it. A script before the first paint, the same pattern as the theme's
  (`src/ask/theme-script.tsx`), reads the cookie and marks the app shell `data-menu="rail"`, so a
  page load or a reload draws the rail straight away, with no flash of the open menu. The CSS draws
  the rail from that attribute. A soft navigation keeps it, because the layout stays.
- Below 900 px nothing changes: the menu is the phone drawer the top bar's ☰ opens (PRD 438), always
  open in full inside it, and the « button is not shown there.

**The Questions pages.** `/ask`, `/ask/for-me` and `/ask/history` each start with one row of section
tabs, above what they show today (on `/ask`, above the terminal list): **Open questions**,
**Shared with me**, **History**, links to those three addresses, the one showing marked
`aria-current="page"`. Open questions and Shared with me carry the counts the menu's badges carry
today (`questions − shared` and `shared`), none at 0. A page that shows a single shared question,
`/ask/q/<round>`, has no tab row.

**The Settings page.** `/app/settings` redirects to `/app/settings/fleets`. Both settings pages
start with one row of tabs, **Fleets** and **Repositories**, links to their pages, the one showing
marked. `/app/settings/fleets` and `/app/settings/repositories` keep their addresses, so every link
to them (the fleet board, the profile, the Engineering board) keeps working.

The tab rows are one small shared component, `SectionTabs`, drawn in the ask pages' tokens.

## Decisions

- Design A: two groups as today, Questions without nested lines, one Settings entry at the foot,
  « folds to a sprite rail. (Asked: picked A of five drawn directions.)
- The collapse is remembered per browser, in a cookie, drawn before the first paint. (Asked.)
- Shared with me and History become tabs on the Questions pages; Settings becomes one page with a
  tab per setting. (Asked, in the approved design.)
- `/app/settings` is a redirect to the Fleets tab, not a page of its own: one page to open, two
  addresses kept, nothing new to draw.
- A new `menu-settings` gear sprite joins the menu sprites in `@omni/design`, so Settings carries a
  sprite like every entry that stays in the rail.
- The dot, not the number, in the rail: a number does not fit 56 px beside a 16 px sprite; the
  accessible name keeps the number.

## User stories

- As anyone in the app, the menu shows two groups and one Settings entry, with no name repeated.
- As someone who wants room, I click « and the menu becomes a rail of sprites; it stays a rail on
  every page and after a reload, until I click ».
- As someone in the rail, I still see where I am and that something waits (a dot), and a hover or a
  screen reader tells me each entry's name.
- As someone answering questions, I reach Shared with me and History from tabs on the Questions page.
- As a workspace owner, Settings opens Fleets, and a tab takes me to Repositories.

## Scope

In: the menu model and sidebar (entries, foot, rail, « and »), the pre-paint cookie script, the
sidebar styles, the `menu-settings` sprite, `SectionTabs` on the three Questions pages and the two
settings pages, the `/app/settings` redirect, the trail and `aria-current` for both.

Out: a setting stored with the person's account; folding a group on its own; changes to the phone
drawer; a Settings page with content of its own; moving Settings into the avatar menu; any data,
route other than `/app/settings`, or API.

## Test seams

Everything runs in `pnpm test` (vitest), beside the code, as `apps/galaxy/src/nav/` already does:

- `src/nav/sidebar.test.ts` (the model): the groups are Dashboard and Work, then the foot; Questions
  has no children; Settings is at `/app/settings` with sprite `menu-settings`; `currentItem` puts
  `/app/settings/fleets` and `/app/settings/repositories` under Settings and `/ask/for-me` and
  `/ask/history` under Questions; `pageTrail` gives "Settings › Fleets" and
  "Work › Questions › History"; `badgeOf` gives no count for the removed lines.
- `src/nav/Sidebar.render.test.ts` (render): the « button with its label and `aria-expanded`; the
  rail's entries each with a name; the dot on an entry with a count, and its spoken name with the
  number; no Settings group title.
- A pure test of the menu script and cookie helper (new `src/nav/menu-rail.ts`): the script marks
  the root when the cookie says `rail` and not otherwise, and never throws without `document.cookie`;
  collapsing writes the cookie, expanding deletes it.
- `SectionTabs` render test: the three Questions tabs and the two Settings tabs, the current one
  marked, counts only above 0.
- `packages/design`: `menu-settings` is a 16×16 sprite drawn like the other menu sprites (the
  existing sprite tests cover it once it is listed).
- The `/app/settings` redirect: a test of the route's target.
- A manual browser pass, light and dark, at 1280 px and at 390 px: the rail, a reload in the rail,
  the tab rows, the phone drawer unchanged.

## Risks

- **What merging publishes:** a merge to `main` deploys the arcade (`apps/galaxy`); nothing touches
  the database, the kit or the plugin. Roll back by reverting the feature PR; a leftover
  `omni-menu` cookie is then ignored.
- **The rail hides names:** a person who does not know the sprites needs the hover names; the
  accessible names and titles are part of done.
- **Links into removed menu lines:** none are removed from the site; only the menu lines go.
- **Pre-paint script:** a script error would leave the menu open (never break the page): it is
  wrapped as the theme's is.

## Acceptance criteria

- On a computer, the menu shows the Dashboard and Work groups and, at its foot, one Settings entry
  with a gear sprite; there is no Settings group title and no Fleets or Repositories entry.
- Questions has no nested Shared with me or History lines in the menu.
- Clicking « turns the menu into a 56 px rail of sprites; clicking » opens it again.
- After « and a reload, the page draws the rail from its first paint, with no open menu shown first;
  after », a reload draws the open menu.
- In the rail, each entry is a link with its name as hover title and accessible name; the current
  entry is marked; an entry with a waiting count shows a dot and says its count to a screen reader.
- Below 900 px the menu is today's phone drawer, open in full, with no « button.
- `/ask`, `/ask/for-me` and `/ask/history` show the Open questions · Shared with me · History tabs,
  the current one marked, counts shown only above 0.
- `/app/settings` lands on `/app/settings/fleets`; both settings pages show the Fleets ·
  Repositories tabs; the old links from the fleet board, the profile and the Engineering board work.
- The top bar reads "Settings › Fleets" on the Fleets settings page.
- `pnpm test` is green.
