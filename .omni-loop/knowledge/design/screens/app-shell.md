---
screen: app-shell
status: draft
kind: shared
mock: app-shell.html
implements: [apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/Sidebar.tsx, apps/galaxy/src/nav/AppBar.tsx, apps/galaxy/src/nav/BrandLogo.tsx, apps/galaxy/src/nav/UserMenu.tsx, apps/galaxy/src/nav/sidebar.ts, apps/galaxy/src/nav/sidebar.css, apps/galaxy/src/nav/app-bar.css, apps/galaxy/src/nav/brand-logo.css, apps/galaxy/src/nav/drawer.css, apps/galaxy/src/nav/user-menu.css, apps/galaxy/src/switch/AntiLoopButton.tsx]
reads: [apps/galaxy/src/nav/, apps/galaxy/app/app/layout.tsx, apps/galaxy/app/prd/layout.tsx, apps/galaxy/app/ask/(shell)/layout.tsx, apps/galaxy/app/knowledge/layout.tsx, apps/galaxy/app/roadmaps/layout.tsx, apps/galaxy/app/concepts/layout.tsx, apps/galaxy/app/bugs/layout.tsx, apps/galaxy/app/visual/layout.tsx, apps/galaxy/app/ideas/layout.tsx, apps/galaxy/app/anti/layout.tsx, apps/galaxy/src/ideas/IdeasFrame.tsx, apps/galaxy/src/ask/theme-switch.tsx, apps/galaxy/src/switch/GameModeButton.tsx, apps/galaxy/src/waiting/]
routes: [/app, /app/runners, /app/waiting, /prd/<id>, /ask, /knowledge, /roadmaps, /concepts, /bugs, /visual, /ideas/<owner>/<repo>, /anti, /anti/work]
supersedes: null
---

## Purpose

The frame around every app page: the sidebar on the left (where a person can go) and the top bar
over the page (where they are and how they see it). One wrapper, `AppShell`
(`apps/galaxy/src/nav/AppShell.tsx`), used by the layout of each app section, so a change here
changes what a person sees on every page listed in `routes`. Each of those pages lists these files
in its `reads`, never in its `implements`. The pages a person meets before the app,
`/ask/device`, `/ask/signin` and `/signup`, are outside it: they sit in the `doorway` frame
(PRD 1705), mounted by `apps/galaxy/app/ask/(doorway)/layout.tsx`.

## Regions

- **The sidebar** (`nav/Sidebar.tsx`, `nav/sidebar.ts`): the OMNI LOOP logo (the crest and the
  wordmark, `nav/BrandLogo.tsx`) linked to /app, « to fold it, the workspace's name; the
  **Dashboard** group (Home, Fleet, Loop, Runners, Workspace, Engineering) and the **Work** group (Products,
  Roadmaps, Ideas, Concepts, PRDs, Waiting, Bug Fixes, Visual Updates, Questions, Knowledge), each entry with
  its 16 px sprite, the current one marked; Questions and PRDs carry a count badge, and Runners one
  for the workspace's jobs waiting for an answer, spoken `Runners: <n> waiting` (PRD 2255); Waiting
  one for the reviews, merges and laws whose turn is yours, spoken `Waiting: <n> yours` (PRD 2377); at the foot
  Settings, then Docs · Release notes (each opening a new tab), then `Omni Loop v<version>`.
- **The top bar** (`nav/AppBar.tsx`): the section's sprite at 2× in a tile and the trail to the page
  (`Work › PRDs`); then the theme switch (Omni, Light, Dark), Game mode, the Anti-loop switch (PRD 2490: `Anti-loop` to /anti, `Omni loop` back to /app in anti-loop mode), the bell (its own shared
  screen, `notifications`) and you (the avatar opening the user menu: your name and login, My
  profile, Sign out; `nav/UserMenu.tsx`).
- **The page** in `<main class="ask-main">`, drawn by each page's own screen.

## States

- **Folded to the rail** (from 900 px, the `omni-menu` cookie): a 56 px rail with the crest, each
  section's sprite, a dot for a count and the Settings gear; » opens it again (`nav/menu-rail.ts`).
- **Phone, below 900 px:** no sidebar; the bar opens with ☰, which slides the sidebar in as a
  drawer over a scrim (`nav/drawer.ts`, `nav/drawer.css`). The theme switch, Game mode and the bell
  wrap to a second row.
- **Signed out:** no bell; Sign in with GitHub in the avatar's place (`nav/UserMenu.tsx`).
- **An ideas board** (`/ideas/<owner>/<repo>`, public): a signed-in person sees it in the shell, Ideas
  marked current; a visitor on a shared link sees the public page with the top bar only, no shell
  (`src/ideas/IdeasFrame.tsx`, issue 1996).
- **No workspace name:** the line under the logo is not drawn.
- **Anti-loop mode** (`/anti`, `/anti/work`, PRD 2490): the root is marked `data-ask-mode="anti"`
  and the theme's Rewind Light tokens apply (`ASK_ANTI` in `@omni/design`); the logo reads ANTI
  LOOP then the mirrored crest, linked to /anti; the sidebar's only group is **Anti-loop**
  (Anti-dashboard, Anti-work), the foot unchanged; the trail reads `Anti-loop › …`; the switch reads
  `Omni loop`.
- **A path under no entry:** the tile shows the OMNI LOOP mark and the bar has no trail.

## Words

OMNI LOOP · Dashboard · Home · Fleet · Loop · Runners · Workspace · Engineering · Work · Products · Roadmaps ·
Ideas · Concepts · PRDs · Waiting · Bug Fixes · Visual Updates · Questions · Knowledge · Settings · Docs ·
Release notes · Omni Loop v<version> · Collapse the menu · Expand the menu · Menu · Omni · Light ·
Dark · Game mode · My profile · Sign out · Sign in with GitHub · Runners: <n> waiting · Waiting: <n> yours · Anti-loop · Omni loop · ANTI LOOP · Anti-dashboard ·
Anti-work.

## Refusals

- No entry has nested lines: an entry's own pages (Questions' Shared with me, Settings' Fleets)
  show as tabs on those pages, never as menu lines (`nav/sidebar.ts`).
- Every entry is a client-side link, so the shell, the waiting polls and the bell's count stay
  across a page change; Docs and Release notes, which leave the app, are not prefetched.
- The shell adds no colour of its own: every colour is a token of `src/ask/theme-tokens.ts`.

## Open questions

- In anti-loop mode, the concept's 360 ms wipe of the lockup is not drawn (PRD 2490 leaves it out):
  does a later PRD bring it?

- The shell has no one primary action, and the mockup marks none: is a shared frame meant to carry
  a primary at all, or only the page inside it?
- Each section's `layout.tsx` wires the shell to its pages and also imports the page's own
  stylesheet: is a layout part of the shell, or of each page? Here it sits in `reads` on both.
- The theme switch and Game mode are drawn by the public bar of /docs and /releases too: they are
  `reads` here, a view two bars share, by the rule's fourth line.

## Source

- apps/galaxy/src/nav/AppShell.tsx
- apps/galaxy/src/nav/Sidebar.tsx
- apps/galaxy/src/nav/sidebar.ts
- apps/galaxy/src/nav/AppBar.tsx
- apps/galaxy/src/nav/BrandLogo.tsx
- apps/galaxy/src/nav/UserMenu.tsx
- apps/galaxy/src/nav/sidebar.css, app-bar.css
- apps/galaxy/app/app/layout.tsx, apps/galaxy/app/prd/layout.tsx
- PRD 1584 s4, 2026-10-11 (drawn by `/omni:pixel-perfect mock`, from the source)
- /omni:brainstorm, PRD 1705: .omni-loop/delivery/shipped/1705-doorway/before-after.html (the `/ask` pages it no longer frames)
- /omni:brainstorm, PRD 1830: .omni-loop/delivery/shipped/1830-runners/before-after.html (the Runners entry)
- /omni:brainstorm, PRD 2255: .omni-loop/delivery/shipped/2255-need-human/before-after.html (the Runners badge)
- /omni:visual-fix #1996, pick B by @pierrederval on 2026-10-15: .omni-loop/delivery/visual/1996-ideas-keeps-menu/before-after.html
- /omni:brainstorm, PRD 2377: .omni-loop/delivery/shipped/2377-waiting-board/before-after.html (the Waiting entry and its badge)
- /omni:brainstorm, PRD 2490: .omni-loop/delivery/inbox/2490-anti-loop-placeholder/before-after.html (the Anti-loop switch and anti-loop mode)
