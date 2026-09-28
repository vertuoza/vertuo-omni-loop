---
prd: 438
title: App sidebar navigation
blocked-by: none
spec: file
---

# App sidebar navigation

**Date:** 2026-09-28 · **PRD:** #438 · **Follows:** PRD 346 (the shared TopBar), PRD 238 (Game mode)
· **Touches:** the galaxy app's shell only:
- `apps/galaxy/app/{app,ask,prd,knowledge,docs,releases}/layout.tsx`
- `apps/galaxy/src/nav/`, `src/switch/`, `src/dashboard/`
- `src/knowledge/KnowledgeScreen.tsx`, `src/ask/page/AskBar.tsx`

No migration, no change to the kit, the game or the GitHub App.

## Problem

The classic app is the reading pages at `/app`, `/prd`, `/ask` and `/knowledge`. It has one top
bar, the shared `TopBar` (`src/nav/TopBar.tsx`), which puts three concerns in one row with no clear
order:

- **The workspace's work.** Questions, For me, History, the Knowledge map and PRDs are not in the
  bar. They are cards at the foot of `/app` (`SECTIONS`, `src/switch/switch.ts`), or links that only
  one page adds as its bar extras: History and For me on `/ask`, All PRDs on `/prd`. **PRDs cannot be
  reached from the navigation at all**, only from a link someone shared.
- **Omni's own pages.** Release notes and Docs are the bar's only menu items, so the product's help
  pages look like the app's sections.
- **The person's account.** There is no user menu, and **no way to sign out** anywhere in the
  classic app: sign-out lives only in the arcade's menu.

Every page also draws the bar differently. Its sub-title changes ("App", "Claude asks", "PRD
dossier", "Knowledge map"), `/knowledge` draws its own bar, and `/ask` wraps it in `AskBar`. The same
layout wrapper is copied into four `layout.tsx` files.

## Solution

A conventional app shell, in the style of Linear or Vercel:

- a **left sidebar** for where you can go: the **Work** group, then the **Omni** group
- a **top bar** over the content for where you are and how you see it: the page's title on the left;
  the theme switch, Game mode and your avatar on the right

### 1. What the sidebar holds

From top to bottom:

| Part | Contents |
|---|---|
| Header | The OMNI LOOP crest and wordmark, linked to `/app`. Under it, when the person is signed in and in a workspace, the workspace's name as a plain label, with no switcher. |
| **Work** | **Home** `/app` · **PRDs** `/prd` · **Questions** `/ask`, with **For me** `/ask/for-me` and **History** `/ask/history` nested under it · **Knowledge** `/knowledge` |
| **Omni** | **Docs** `/docs` · **Release notes** `/releases`. Each is marked as leaving the app with a ↗ glyph, and has an accessible name ending "(leaves the app)". |

- **For me** carries the count of questions waiting for the person as a badge. A count of 0, or a
  count that could not be read, shows no badge.
- The current item is highlighted and carries `aria-current="page"`. A page below a section
  highlights that section's item:
  - `/prd/<id>` highlights PRDs.
  - `/ask/<session>` and `/ask/q/<round>` highlight Questions.
  - `/ask/for-me` highlights For me, and `/ask/history` highlights History.
  - `/knowledge?domain=…` highlights Knowledge.
  - A path that matches no item highlights nothing.
- Nothing is scoped to one repository. The navigation is workspace-wide, and a repository stays a
  filter inside a page (as `/prd?repo=` already does).

### 2. The top bar

A bar above the page's content, to the right of the sidebar. It holds, in order:

1. **The page's title**, on the left: the current sidebar item's label, with its parent before it
   when it is nested ("Questions / For me"). A path that matches no item shows no title.
2. **The theme switch**: the existing `ThemeSwitch` (Omni, Light, Dark), unchanged.
3. **Game mode**: the existing `GameModeButton` and its confirm dialog, unchanged ("Switch to game
   mode?" / "The arcade opens on its menu." / Stay / Switch), which goes to `GAME_HOME`.
4. **You**, on the far right:
   - Signed in: the person's GitHub avatar, as a button that opens the user menu (section 3).
   - Signed out: **Sign in with GitHub**. It starts the same GitHub sign-in `/app`'s card starts
     (`startGithubSignIn`), returning through `/app/callback` to `/app`.

### 3. The user menu

The avatar button opens a menu that follows the WAI-ARIA menu-button pattern: arrow keys move between
items, Escape closes the menu, and focus returns to the button. It holds, in order:

1. The person's name and GitHub login, as a heading that cannot be chosen.
2. **Sign out**: signs out of Supabase in the browser (`scope: 'local'`, as the arcade does), then
   goes to `/` (HOME).

### 4. Docs and Release notes keep their own public bar

`/docs` and `/releases` are public pages: HOME links to them, and signed-out visitors read them.
`/docs` already has its own Guide sidebar. They keep the public `TopBar` as it is (its menu, the
theme switch and Game mode), with one addition:

- An **Open the app →** link to `/app`, shown to everyone.

The public pages never read the session, so they stay static. A signed-out visitor who follows the
link lands on `/app`'s sign-in card.

### 5. The pages

- **`/app` (Home)** keeps the You block and the notes, and **drops the section cards**: the sidebar
  does their job. `SECTIONS` and `src/dashboard/Cards.tsx` are deleted.
- **`/ask`** loses `AskBar`. Its History and For me links are sidebar items now. The terminal tabs of
  a session stay inside the page.
- **`/prd`** loses its "All PRDs" bar link: the PRDs item in the sidebar is that link.
- **`/knowledge`** no longer draws its own bar:
  - The repository chip, shown in the brand today, moves into the page's own heading.
  - The link "Open the star chart →" stays in the page.
- HOME `/`, `/play`, `/signup` and `/design` do not change. The arcade's APP MODE still lands on `/app`.

### 6. Phone

Below 900px wide, the sidebar is hidden, and the top bar gains a ☰ button labelled "Menu" at its
left:

- **First row:** ☰, the crest, the page's title and the avatar (or Sign in).
- **Second row:** the theme switch and Game mode, where they do not fit on the first.

☰ opens the sidebar as a drawer over the page, and focus moves into it. Escape, a tap outside, or
choosing an item closes the drawer and returns focus to ☰. Nothing scrolls the page sideways.

### 7. How it is built

These units live in `apps/galaxy/src/nav/`, one job per unit:

| Unit | Job |
|---|---|
| `sidebar.ts` | Pure data and two pure functions. `SIDEBAR` holds the groups and items, in order (`{ id, label, path, children?, leavesApp? }`), so a new section is one entry. `currentItem(pathname)` returns the id of the item the path falls under, by the longest matching path, or `null`. `pageTitle(pathname)` returns the top bar's title ("Questions / For me"), or `null`. |
| `viewer.ts` | Server-only, one read per request: `{ signedIn, name, login, avatarUrl, workspaceName, forMe }`, built from the Supabase server session (`src/data/supabase-server.ts`), `firstWorkspace()` and `forMeCount()`. Each part that fails to read falls back on its own, and the read never throws: no session means signed out, no workspace means no name, and no count means `forMe: null`. |
| `AppShell.tsx` | The one layout wrapper for `/app`, `/prd`, `/ask` and `/knowledge`, in order: the theme CSS; the `ask` root with `ThemeScript` as its first child; the sidebar; the app bar; then `<main class="ask-main">`. It replaces the wrapper those four `layout.tsx` files copy today. |
| `Sidebar.tsx` | Client component. Draws the sidebar from `SIDEBAR` and the viewer, and marks the current item with `usePathname()` and `currentItem()`. It is also the phone drawer. |
| `AppBar.tsx` | Client component: the top bar (section 2). It reuses `ThemeSwitch` and `GameModeButton` unchanged, and holds ☰ on a phone. |
| `UserMenu.tsx` | Client component: the avatar button and its menu (section 3). |
| `TopBar.tsx` | Kept for `/docs` and `/releases` only, gaining **Open the app →**. |

`menu.ts` keeps Release notes and Docs for the public bar. The colours come from the ask tokens
(`--ask-*`, `src/ask/theme-tokens.ts`), so Omni, Light and Dark all follow the theme switch. The
shell adds no colour of its own.

## Decisions

- **A left sidebar for the sections, and a top bar for the view.** The sidebar was chosen from five
  drawn directions (top tabs, sidebar, two bars, icon rail, breadcrumb): it gives the clearest
  grouping, and has room for the sections still to come (fleets, settings, an admin app).
- **The theme switch and Game mode stay in a top bar,** in view on every page rather than inside a
  menu. The person amended the design to keep them there after reviewing it.
- **The avatar sits at the right end of the top bar,** and its menu holds only the person's name and
  Sign out.
- **Workspace-wide, with no repository switcher.** The repository stays a filter inside the pages.
- **No workspace switcher.** The workspace name is a label; switching is its own future PRD.
- **`/app` stays as Home**, and loses only its cards.
- **Docs and Release notes keep a public layout** with its own bar, rather than the app shell. That
  avoids a sidebar inside a sidebar, and keeps them static for signed-out visitors. Their bar keeps
  its theme switch and Game mode, like the app bar.
- **"Open the app →" is shown to everyone** on the public bar, rather than a signed-in-only "Back to
  the app", so those pages never read the session.
- **Sign out lands on HOME `/`.**
- **The phone drawer opens below 900px.** On a phone, the top bar wraps to a second row rather than
  hiding the theme switch or Game mode.

## User stories

1. As a member of a workspace, from any app page I open PRDs, Questions, For me, History or
   Knowledge in one click, and I see which one I am on.
2. As a member, I see how many questions wait for me on For me without opening `/ask`.
3. As a member, I switch the theme or go to Game mode from the top bar of any page, as today.
4. As a member, I sign out of the classic app from my avatar, without going through the game.
5. As a signed-out visitor on an app page, I see what the app holds, and sign in with GitHub from the
   top bar.
6. As a reader of Docs or Release notes, I reach the app from the bar with **Open the app →**.
7. As a person on a phone, I open the same navigation from ☰, and nothing scrolls sideways.

## Scope

**In:**
- The sidebar, the top bar, the user menu and the phone drawer on `/app`, `/prd/*`, `/ask/*` and
  `/knowledge`.
- `AppShell` replacing those four layouts' wrapper.
- The public bar's **Open the app →**.
- The removal of `AskBar`, `Cards` and `SECTIONS`, the knowledge page's own bar, and `/prd`'s "All
  PRDs" link.
- Tests, updated to match.

**Out:**
- A workspace switcher and a repository switcher.
- Settings, fleets and admin pages.
- Any change to HOME, `/play`, the arcade, `/signup` or `/design`, or to the content of any page
  beyond the removals above.
- A collapsible desktop sidebar, keyboard shortcuts and a command palette.
- A new colour or font.

## Test seams

Vitest, beside the code (`apps/galaxy/src/**`), in the style of `src/nav/TopBar.test.ts`
(`renderToStaticMarkup`). Following `omni kb show testing`, **no test calls GitHub or Supabase**: the
viewer read is tested with a fake client.

- **`sidebar.test.ts`:**
  - `SIDEBAR` pins the groups, their items, their order and their paths.
  - `currentItem` and `pageTitle` are checked on `/app`, `/prd`, `/prd/<id>`, `/ask`,
    `/ask/<session>`, `/ask/q/<round>`, `/ask/for-me`, `/ask/history`, `/knowledge`,
    `/knowledge?domain=x`, and an unknown path (`null`).
- **`Sidebar` render tests:**
  - Signed out, it shows no workspace name. Signed in with a workspace, it shows the workspace's name.
  - For me shows a badge at 3, and no badge at 0 or `null`.
  - The current item carries `aria-current="page"`, and only it does.
  - Docs and Release notes are marked as leaving the app.
- **`AppBar` render tests:**
  - It shows the title, then Omni/Light/Dark, then Game mode, then the avatar, in that order.
  - Signed out, **Sign in with GitHub** takes the avatar's place.
  - The Game mode dialog's words are exactly `GAME_MODE`'s.
- **`UserMenu` render test:** the items are the name and login, then Sign out.
- **`viewer.test.ts`**, with a fake client:
  - It returns the full viewer.
  - No session gives a signed-out viewer.
  - A workspace read that throws gives a viewer with no workspace name.
  - A For me count that throws gives `forMe: null`.
- **`TopBar.test.ts`**, updated: **Open the app →** links to `/app`, and the menu, the theme switch
  and Game mode are unchanged.
- **Dashboard and switch render tests**, updated: no section cards, and the You block and notes
  still render.
- **A manual browser pass**, in all three themes:
  - The shell on every app route.
  - The phone drawer at 375px.
  - The user menu by keyboard only.
  - Sign out, then sign in again.

## Risks

- **What a merge publishes.** A merge to `main` redeploys the galaxy app (`omni kb show
  releasing`). It adds no database migration and changes no kit or GitHub App file. **Rollback** is
  reverting the feature PR's merge commit.
- **Sign-out or the user menu breaks**, and someone cannot switch account from the classic app. The
  render tests and the manual pass cover it, and the arcade's sign-out still works.
- **Every app page changes layout at once.** Each route is checked by hand on a local run, because
  the Vercel previews answer 401 to anyone not signed in to Vercel.
- **The viewer read adds a request on every app page.** `forMeCount` already runs on every `/ask`
  page. The viewer adds one session read, one workspace read and one count, and a read that fails
  leaves the page rendering as signed out.

## Acceptance criteria

1. The pages `/app`, `/prd`, `/prd/<id>`, `/ask`, `/ask/<session>`, `/ask/for-me`, `/ask/history`
   and `/knowledge` each show the sidebar, with these items in order:
   - Work: Home, PRDs, Questions (For me, History), Knowledge
   - Omni: Docs ↗, Release notes ↗
2. On each of those pages, exactly one sidebar item is marked current: the one section 1 names for
   that path.
3. On each of those pages, the top bar shows, in order:
   - the page's title (for example "Questions / For me" on `/ask/for-me`)
   - Omni / Light / Dark
   - Game mode
   - the avatar, or **Sign in with GitHub** when signed out
4. Choosing a theme in the top bar changes the page's theme, as today. Choosing Game mode, then
   Switch, opens the arcade on its menu.
5. Signed in with 3 questions waiting, For me shows a badge reading 3. With none, it shows no badge.
6. Signed in, choosing the avatar opens a menu reading the name, then Sign out. Escape closes it and
   returns focus to the avatar.
7. Choosing Sign out ends the session and lands on `/`. Opening `/app` afterwards shows the sign-in
   card.
8. Signed out, **Sign in with GitHub** in the top bar starts the GitHub sign-in.
9. `/app` shows no section cards, and still shows the You block and the notes.
10. `/docs` and `/releases` show no sidebar. Their bar keeps its menu, the theme switch and Game mode,
    and adds **Open the app →**, which links to `/app`.
11. At 375px wide:
    - The sidebar is hidden, and ☰ opens it as a drawer.
    - Choosing an item navigates and closes the drawer.
    - The page never scrolls sideways.
12. `/ask` no longer shows History and For me in a bar, `/prd` no longer shows "All PRDs", and
    `/knowledge` shows its repository chip in its heading.
13. `pnpm test` is green.
