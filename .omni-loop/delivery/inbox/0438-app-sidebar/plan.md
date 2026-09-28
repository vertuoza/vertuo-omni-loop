# Plan: App sidebar navigation

PRD #438, with the spec beside this plan (`spec.md`). The feature branch `feat/app-sidebar` merges
into `main` with `Closes #438`. Each slice is a sub-PR from `feat/app-sidebar--<slice>` into the
feature branch, with `Part of #438`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every app page (`/app`, `/prd`, `/ask`, `/knowledge`) sits in one AppShell with the left sidebar: Work (Home, PRDs, Questions with For me and History, Knowledge), Omni (Docs ↗, Release notes ↗), the current item marked, the For me badge, and a footer showing the avatar and name when signed in and Sign in with GitHub when signed out. The old bars, the ask and prd bar links and /app's section cards are gone | `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/nav/viewer` `apps/galaxy/src/nav/AppShell` `apps/galaxy/app/app/layout.tsx` `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/app/prd/layout.tsx` `apps/galaxy/app/knowledge/layout.tsx` `apps/galaxy/src/ask/page/AskBar.tsx` `apps/galaxy/src/ask/page/ForMe.tsx` `apps/galaxy/src/ask/page/WorkspaceHistory.tsx` `apps/galaxy/src/ask/page/history-render.test.ts` `apps/galaxy/src/ask/page/share-render.test.ts` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/ask/page/history.css` `apps/galaxy/src/ask/page/share.css` `apps/galaxy/src/dossier/page/history.ts` `apps/galaxy/src/dossier/page/DossierHistory.tsx` `apps/galaxy/src/dossier/page/page.test.ts` `apps/galaxy/src/knowledge/KnowledgeScreen.tsx` `apps/galaxy/src/knowledge/render.test.ts` `apps/galaxy/src/knowledge/knowledge.css` `apps/galaxy/src/dashboard/` `apps/galaxy/src/switch/switch.ts` `apps/galaxy/src/switch/switch.test.ts` `apps/galaxy/src/switch/render.test.ts` `apps/galaxy/src/switch/headers.test.ts` | — | 1 |
| s2 | The avatar opens the user menu (the name and login, Theme, Game mode, Sign out) following the menu-button pattern. Game mode opens the existing dialog, and Sign out ends the session and lands on `/` | `apps/galaxy/src/nav/UserMenu` `apps/galaxy/src/nav/user-menu` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/switch/GameModeButton.tsx` `apps/galaxy/src/switch/switch.css` | s1 | 2 |
| s3 | Below 900px the sidebar hides, and a slim phone bar (☰, crest, the section's name, avatar or Sign in) opens it as a drawer that closes on Escape, a tap outside or choosing an item, with no sideways scroll | `apps/galaxy/src/nav/PhoneBar` `apps/galaxy/src/nav/phone` `apps/galaxy/src/nav/AppShell` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/nav/sidebar` | s1, s2 | 3 |
| s4 | The public bar on `/docs` and `/releases` loses Game mode and gains **Open the app →** to `/app`, shown to everyone. Its menu is unchanged | `apps/galaxy/src/nav/TopBar` `apps/galaxy/src/nav/menu.ts` `apps/galaxy/src/nav/nav.css` `apps/galaxy/src/switch/headers.test.ts` | s1 | 2 |

**Shared ground.**
- `src/nav/Sidebar` (`Sidebar.tsx` and its tests) is declared by s1, s2 and s3, one per wave (1, 2
  and 3). s2 mounts the user menu in its footer, and s3 adds the drawer behaviour.
- `src/nav/AppShell` and `src/nav/sidebar` (the data, its test and `sidebar.css`) are s1's and s3's,
  in waves 1 and 3.
- `src/switch/headers.test.ts` checks every page's header. It is s1's and s4's, in waves 1 and 2.
- s2 and s4 share wave 2 and no prefix: s2 owns the user menu and the Game mode dialog, and s4 owns
  the public bar.

## Per slice: done when

**s1: the sidebar and the shell**
- `sidebar.test.ts` pins `SIDEBAR`:
  - Work: Home `/app`, PRDs `/prd`, Questions `/ask` with For me `/ask/for-me` and History
    `/ask/history`, Knowledge `/knowledge`.
  - Omni: Docs `/docs` and Release notes `/releases`, both marked as leaving the app.
- `currentItem` gives:

  | Path | Result |
  | --- | --- |
  | `/app` | home |
  | `/prd`, `/prd/<id>` | prds |
  | `/ask`, `/ask/<session>`, `/ask/q/<round>` | questions |
  | `/ask/for-me` | for-me |
  | `/ask/history` | history |
  | `/knowledge`, `/knowledge?domain=x` | knowledge |
  | an unknown path | `null` |

- `viewer.test.ts`, with a fake client:
  - The full viewer.
  - No session means signed out.
  - A workspace read that throws means no workspace name.
  - A For me count that throws means `forMe: null`.
  - The viewer never throws.
- `Sidebar` render tests:
  - Signed out: Sign in with GitHub and no workspace name.
  - Signed in without a workspace.
  - Signed in with a workspace: its name.
  - For me shows a badge at 3, and none at 0 or `null`.
  - Exactly one `aria-current="page"`.
  - Docs and Release notes each carry ↗ and "(leaves the app)".
- Signed-out Sign in starts `startGithubSignIn` returning through `/app/callback`.
- The `app`, `ask`, `prd` and `knowledge` layouts render through `AppShell`, and no longer render
  `TopBar`. `AskBar` is deleted.
- `/ask` shows no History or For me bar links, and `/prd` shows no "All PRDs" link.
- `/knowledge` draws no bar of its own, and shows its repository chip in its heading.
- `/app` renders the You block and the notes with no section cards: `Cards.tsx` and `SECTIONS` are
  deleted.
- `pnpm test` is green.

**s2: the user menu**
- `UserMenu` render test:
  - The avatar button has `aria-haspopup="menu"` and `aria-expanded`.
  - The menu reads the name and login, Theme (Omni, Light, Dark), Game mode, Sign out, in that order.
- The Game mode item opens the dialog whose words are exactly `GAME_MODE`'s, and Switch goes to
  `GAME_HOME`.
- Sign out calls the browser client's `signOut({ scope: 'local' })`, then goes to `/`.
- Arrow keys move between items, Escape closes the menu, and focus returns to the avatar. This is
  covered by a test of the pure key handler, and by the manual pass.
- The signed-in sidebar footer opens this menu.
- `pnpm test` is green.

**s3: the phone drawer**
- Below 900px, the sidebar is hidden, and the phone bar shows ☰ ("Menu"), the crest, the current
  section's name and the avatar, or Sign in.
- ☰ opens the sidebar as a drawer. Focus moves into it, and Escape, a tap on the scrim, or choosing
  an item closes it and returns focus to ☰. This is covered by a test of the pure drawer state, and
  by the manual pass.
- At 375px wide, no app page scrolls sideways. This is checked by hand on a local run, in the Omni,
  Light and Dark themes.
- `pnpm test` is green.

**s4: the public bar**
- `TopBar.test.ts`:
  - No Game mode button.
  - An **Open the app →** link to `/app`, after the menu and the theme switch.
  - The menu is still Release notes then Docs.
- `/docs` and `/releases` render no sidebar, and their layouts read no session.
- `headers.test.ts` matches: the public bar on `/docs` and `/releases`, and the sidebar on the app
  pages.
- `pnpm test` is green.
