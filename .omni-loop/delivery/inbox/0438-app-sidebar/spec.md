---
prd: 438
title: App sidebar navigation
blocked-by: none
spec: file
---

# App sidebar navigation

**Date:** 2026-09-28 · **PRD:** #438 · **Follows:** PRD 346 (the shared TopBar), PRD 238 (Game mode)
· **Touches:** the galaxy app's shell only (`apps/galaxy/app/{app,ask,prd,knowledge,docs,releases}/layout.tsx`,
`apps/galaxy/src/nav/`, `src/switch/`, `src/dashboard/`, `src/knowledge/KnowledgeScreen.tsx`,
`src/ask/page/AskBar.tsx`). No migration, no change to the kit, the game or the GitHub App.

## Problem

The classic app (the reading pages at `/app`, `/prd`, `/ask` and `/knowledge`) has one top bar, the
shared `TopBar` (`src/nav/TopBar.tsx`). That bar mixes three concerns in one row, in no clear order:

- **The workspace's work.** Questions, For me, History, the Knowledge map and PRDs are not in the
  bar. They are cards at the foot of `/app` (`SECTIONS`, `src/switch/switch.ts`), or links that only
  one page adds as its bar extras: History and For me on `/ask`, All PRDs on `/prd`. **PRDs cannot be
  reached from the navigation at all**, only from a link someone shared.
- **Omni's own pages.** Release notes and Docs are the bar's only menu items, so the product's help
  pages look like the app's sections.
- **The person's account.** The theme switch and the Game mode button sit in the same row as the
  menu. There is no user menu, and **no way to sign out** anywhere in the classic app: sign-out lives
  only in the arcade's menu.

Every page also draws the bar differently: its sub-title changes ("App", "Claude asks", "PRD
dossier", "Knowledge map"). `/knowledge` draws its own bar, and `/ask` wraps the bar in `AskBar`.
The same layout wrapper is copied into four `layout.tsx` files.

## Solution

A conventional **left sidebar** on every page of the classic app, in the style of Linear or Vercel.
It separates the three concerns into three places: the **Work** group, the **Omni** group, and a
**You** menu at the foot of the sidebar.

### 1. What the sidebar holds

From top to bottom:

| Part | Contents |
|---|---|
| Header | The OMNI LOOP crest and wordmark, linked to `/app`. Under it, when the person is signed in and in a workspace, the workspace's name as a plain label: no switcher. |
| **Work** | **Home** `/app` · **PRDs** `/prd` · **Questions** `/ask`, with **For me** `/ask/for-me` and **History** `/ask/history` nested under it · **Knowledge** `/knowledge` |
| **Omni** | **Docs** `/docs` · **Release notes** `/releases`. Each is marked as leaving the app with a ↗ glyph, and has an accessible name ending "(leaves the app)". |
| Footer, **You** | Signed in: the person's GitHub avatar and name, as a button that opens the user menu. Signed out: **Sign in with GitHub**. |

- **For me** carries the count of questions waiting for the person as a badge. A count of 0, or a
  count that could not be read, shows no badge.
- The current item is highlighted and carries `aria-current="page"`. A page below a section
  highlights that section's item:
  - `/prd/<id>` highlights PRDs.
  - `/ask/<session>` and `/ask/q/<round>` highlight Questions.
  - `/ask/for-me` highlights For me, and `/ask/history` highlights History.
  - `/knowledge?domain=…` highlights Knowledge.
  - A path that matches no item highlights nothing.
- Nothing is scoped to one repository: the navigation is workspace-wide, and a repository stays a
  filter inside a page (as `/prd?repo=` already does).

### 2. The user menu

The avatar button opens a menu. It follows the WAI-ARIA menu-button pattern: arrow keys move between
items, Escape closes the menu, and focus returns to the button. The menu holds, in order:

1. The person's name and GitHub login, as a heading that cannot be chosen.
2. **Theme**: the existing `ThemeSwitch` (Omni, Light, Dark), unchanged.
3. **Game mode**: opens the existing confirm dialog, with the same words ("Switch to game mode?" /
   "The arcade opens on its menu." / Stay / Switch), which goes to `GAME_HOME`.
4. **Sign out**: signs out of Supabase in the browser (`scope: 'local'`, as the arcade does), then
   goes to `/` (HOME).

Signed out, **Sign in with GitHub** starts the same GitHub sign-in `/app`'s card starts
(`startGithubSignIn`), returning through `/app/callback` to `/app`.

### 3. Docs and Release notes keep their own public bar

`/docs` and `/releases` are public pages: HOME links to them, and signed-out visitors read them.
`/docs` already has its own Guide sidebar. They keep the public `TopBar`, with two changes:

- **Game mode leaves that bar.** It lives in the user menu now.
- The bar gains an **Open the app →** link to `/app`, shown to everyone. The public pages never read
  the session, so they stay static. A signed-out visitor who follows the link lands on `/app`'s
  sign-in card.

### 4. The pages

- **`/app` (Home)** keeps the You block and the notes, and **drops the section cards**: the sidebar
  does their job. `SECTIONS` and `src/dashboard/Cards.tsx` are deleted.
- **`/ask`** loses `AskBar`. Its History and For me links are sidebar items now. The terminal tabs of
  a session stay inside the page.
- **`/prd`** loses its "All PRDs" bar link: PRDs in the sidebar is that link.
- **`/knowledge`** no longer draws its own bar. The repository chip, shown in the brand today, moves
  into the page's own heading. The link "Open the star chart →" stays in the page.
- HOME `/`, `/play`, `/signup` and `/design` do not change. The arcade's APP MODE still lands on `/app`.

### 5. Phone

Below 900px wide, the sidebar is hidden and a slim top bar shows:

- a ☰ button, labelled "Menu"
- the crest
- the current section's name
- the avatar button, or Sign in

☰ opens the sidebar as a drawer over the page. Focus moves into the drawer, and Escape, a tap
outside, or choosing an item closes it and returns focus to ☰. Nothing scrolls the page sideways.

### 6. How it is built

In `apps/galaxy/src/nav/`, one job per unit:

| Unit | Job |
|---|---|
| `sidebar.ts` | Pure data and one pure function. `SIDEBAR` is the groups and items, in order (`{ id, label, path, children?, leavesApp? }`): a new section is one entry. `currentItem(pathname)` returns the id of the item the path falls under, by the longest matching path, or `null`. |
| `viewer.ts` | Server-only, one read per request: `{ signedIn, name, login, avatarUrl, workspaceName, forMe }`. It is built from the Supabase server session (`src/data/supabase-server.ts`), `firstWorkspace()` and `forMeCount()`. Each part that fails to read falls back on its own, and it never throws: no session means signed out, no workspace means no name, and no count means `forMe: null`. |
| `AppShell.tsx` | The one layout wrapper for `/app`, `/prd`, `/ask` and `/knowledge`: the theme CSS, the `ask` root with `ThemeScript` as its first child, the sidebar, then `<main class="ask-main">`. It replaces the wrapper those four `layout.tsx` files copy today. |
| `Sidebar.tsx` | Client component. It draws the sidebar from `SIDEBAR` and the viewer, marks the current item with `usePathname()` and `currentItem()`, and runs the phone drawer. |
| `UserMenu.tsx` | Client component: the avatar button and its menu (section 2). It reuses `ThemeSwitch` and the Game mode dialog. |
| `TopBar.tsx` | Kept for `/docs` and `/releases` only: Game mode is removed, and **Open the app →** is added. |

`menu.ts` keeps Release notes and Docs for the public bar. The colours come from the ask tokens
(`--ask-*`, `src/ask/theme-tokens.ts`), so Omni, Light and Dark all follow the theme switch. The
sidebar adds no colour of its own.

## Decisions

- **A left sidebar, not top tabs.** Chosen from five drawn directions (top tabs, sidebar, two bars,
  icon rail, breadcrumb). It gives the clearest grouping, and room for sections still to come:
  fleets, settings, an admin app.
- **Workspace-wide, no repository switcher.** The repository stays a filter inside the pages.
- **No workspace switcher.** The workspace name is a label. Switching workspaces is its own future
  PRD.
- **Game mode goes in the user menu.** It is a personal view choice, like the theme.
- **`/app` stays as Home** and loses only its cards.
- **Docs and Release notes keep a public layout** with its own bar, rather than the app shell: no
  sidebar inside a sidebar, and they stay static for signed-out visitors.
- **"Open the app →" is shown to everyone** on the public bar, rather than a signed-in-only "Back to
  the app", so those pages never read the session.
- **Sign out lands on HOME `/`.**
- **The phone drawer opens below 900px.**

## User stories

1. As a member of a workspace, from any app page I open PRDs, Questions, For me, History or
   Knowledge in one click, and I see which one I am on.
2. As a member, I see how many questions wait for me on For me without opening `/ask`.
3. As a member, I find my theme, Game mode and Sign out in one place: my avatar.
4. As a member, I can sign out of the classic app without going through the game.
5. As a signed-out visitor on an app page, I see what the app holds and sign in with GitHub from the
   sidebar.
6. As a reader of Docs or Release notes, I reach the app from the bar with **Open the app →**.
7. As a person on a phone, I open the same navigation from ☰, and nothing scrolls sideways.

## Scope

**In:**
- The sidebar, the user menu and the phone drawer on `/app`, `/prd/*`, `/ask/*` and `/knowledge`.
- `AppShell` replacing those four layouts' wrapper.
- The public bar's two changes.
- The removal of `AskBar`, `Cards` / `SECTIONS`, the knowledge page's own bar and `/prd`'s "All
  PRDs" link.
- Tests, updated to match.

**Out:**
- A workspace switcher and a repository switcher.
- Settings, fleets and admin pages.
- Any change to HOME, `/play`, the arcade, `/signup`, `/design`, or the content of any page beyond
  the removals above.
- A collapsible desktop sidebar.
- Keyboard shortcuts and a command palette.
- A new colour or font.

## Test seams

Vitest, beside the code (`apps/galaxy/src/**`), in the style of `src/nav/TopBar.test.ts`
(`renderToStaticMarkup`). Following `omni kb show testing`, **no test calls GitHub or Supabase**:
the viewer read is tested with a fake client.

- **`sidebar.test.ts`:**
  - `SIDEBAR` pins the groups, their items, their order and their paths.
  - `currentItem` is checked on `/app`, `/prd`, `/prd/<id>`, `/ask`, `/ask/<session>`,
    `/ask/q/<round>`, `/ask/for-me`, `/ask/history`, `/knowledge`, `/knowledge?domain=x`, and an
    unknown path (`null`).
- **`Sidebar` render tests:**
  - It renders signed out (Sign in, no workspace name), signed in without a workspace, and signed in
    with a workspace (its name).
  - For me shows the badge at 3, and no badge at 0 or `null`.
  - The current item carries `aria-current="page"`, and only it.
  - Docs and Release notes are marked as leaving the app.
- **`UserMenu` render test:**
  - The items are name, Theme, Game mode, Sign out, in that order.
  - The Game mode dialog's words are exactly `GAME_MODE`'s.
- **`viewer.test.ts`**, with a fake client:
  - The full viewer.
  - No session.
  - A workspace read that throws, which gives a viewer with no workspace name.
  - A For me count that throws, which gives `forMe: null`.
- **`TopBar.test.ts`**, updated: no Game mode, **Open the app →** to `/app`, the menu unchanged.
- **Dashboard and switch render tests**, updated: no section cards, and the You block and notes
  still render.
- **A manual browser pass**, in each of the three themes:
  - The sidebar on every app route.
  - The phone drawer at 375px.
  - The user menu by keyboard only.
  - Sign out, then sign in again.

## Risks

- **What a merge publishes.** A merge to `main` redeploys the galaxy app (see `omni kb show
  releasing`). It touches no database migration, no kit file and no GitHub App code. **Rollback**
  is reverting the feature PR's merge commit.
- **Sign-out or the menu breaks**, and someone cannot switch account from the classic app. The render
  tests and the manual pass cover it, and the arcade's sign-out still works.
- **Every app page changes layout at once.** Each route is checked by hand on a local run, because
  the Vercel previews answer 401 to anyone who is not signed in to Vercel.
- **The viewer read adds a request on every app page.** `forMeCount` already runs on every `/ask`
  page, and the viewer's reads are one session read, one workspace read and one count. If one of
  them fails, the page still renders, as signed out.

## Acceptance criteria

1. On `/app`, `/prd`, `/prd/<id>`, `/ask`, `/ask/<session>`, `/ask/for-me`, `/ask/history` and
   `/knowledge`, the page shows the sidebar with, in order:
   - Work: Home, PRDs, Questions (For me, History), Knowledge
   - Omni: Docs ↗, Release notes ↗
   - the You footer
2. On each of those pages, exactly one sidebar item is marked current, the one section 1 names for
   that path.
3. Signed in with 3 questions waiting, For me shows a badge reading 3. With none, it shows no badge.
4. Signed in, choosing the avatar opens a menu reading the name, Theme, Game mode, Sign out. Escape
   closes it and returns focus to the avatar.
5. Choosing Sign out ends the session and lands on `/`. Opening `/app` afterwards shows the sign-in
   card.
6. Choosing Game mode, then Switch, opens the arcade on its menu.
7. Signed out, the sidebar's footer reads **Sign in with GitHub**, and it starts the GitHub sign-in.
8. `/app` shows no section cards, and still shows the You block and the notes.
9. `/docs` and `/releases` show no sidebar and no Game mode button, and their bar has **Open the app
   →** linking to `/app`.
10. At 375px wide, the sidebar is hidden:
    - ☰ opens it as a drawer.
    - Choosing an item navigates and closes the drawer.
    - The page never scrolls sideways.
11. `/ask` no longer shows History and For me in a bar, `/prd` no longer shows "All PRDs", and
    `/knowledge` shows its repository chip in its heading.
12. `pnpm test` is green.
